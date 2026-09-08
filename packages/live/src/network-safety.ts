import http from 'node:http';
import https from 'node:https';
import net, { BlockList, isIP, type Socket } from 'node:net';
import { lookup } from 'node:dns/promises';
import type { Duplex } from 'node:stream';

export const PRIVATE_NETWORK_ERROR =
  'Локальные и private-network URL запрещены. Используйте --allow-private-network осознанно.';

export type ResolvedAddress = { address: string; family: number };
export type ResolveHostname = (hostname: string) => Promise<ResolvedAddress[]>;

const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv4');
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv6');
}

function normalizedHostname(value: string): string {
  return value.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

export function isBlockedNetworkAddress(address: string): boolean {
  const normalized = normalizedHostname(address).replace(/%.+$/, '');
  const family = isIP(normalized);
  if (family === 0) return true;
  return blockedAddresses.check(normalized, family === 4 ? 'ipv4' : 'ipv6');
}

export const systemResolver: ResolveHostname = async (hostname) => {
  const addresses = await lookup(normalizedHostname(hostname), { all: true, verbatim: true });
  return addresses.map(({ address, family }) => ({ address, family }));
};

export async function resolvePublicAddress(
  hostname: string,
  resolver: ResolveHostname = systemResolver,
): Promise<ResolvedAddress> {
  const normalized = normalizedHostname(hostname);
  if (!normalized || normalized === 'localhost' || normalized.endsWith('.localhost')) {
    throw new Error(PRIVATE_NETWORK_ERROR);
  }

  const directFamily = isIP(normalized);
  const addresses = directFamily
    ? [{ address: normalized, family: directFamily }]
    : await resolver(normalized);

  if (addresses.length === 0) throw new Error(`Не удалось разрешить адрес сайта: ${normalized}`);
  if (addresses.some(({ address }) => isBlockedNetworkAddress(address))) {
    throw new Error(PRIVATE_NETWORK_ERROR);
  }

  const selected = addresses.find(({ family }) => family === 4) ?? addresses[0];
  if (!selected) throw new Error(`Не удалось разрешить адрес сайта: ${normalized}`);
  return selected;
}

export async function assertPublicHttpUrl(
  value: string,
  resolver: ResolveHostname = systemResolver,
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Укажите URL сайта');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Укажите URL сайта');
  }
  try {
    await resolvePublicAddress(parsed.hostname, resolver);
  } catch (error) {
    if ((error as Error).message === PRIVATE_NETWORK_ERROR) throw error;
    throw new Error(`Не удалось разрешить адрес сайта: ${normalizedHostname(parsed.hostname)}`);
  }
  return parsed;
}

export interface PinnedProxy {
  server: string;
  close(): Promise<void>;
}

function requestTarget(value: string | undefined): URL {
  if (!value) throw new Error('Proxy request has no target URL');
  const target = new URL(value);
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('Unsupported proxy protocol');
  }
  return target;
}

function cleanProxyHeaders(headers: http.IncomingHttpHeaders, host: string): http.OutgoingHttpHeaders {
  const result: http.OutgoingHttpHeaders = { ...headers, host };
  delete result['proxy-authorization'];
  delete result['proxy-connection'];
  return result;
}

function destroyPair(client: Duplex, upstream?: Socket): void {
  client.destroy();
  upstream?.destroy();
}

export async function startPinnedProxy(
  resolver: ResolveHostname = systemResolver,
): Promise<PinnedProxy> {
  const sockets = new Set<Socket>();
  const proxy = http.createServer((request, response) => {
    void (async () => {
      const target = requestTarget(request.url);
      const pinned = await resolvePublicAddress(target.hostname, resolver);
      const requestOptions: http.RequestOptions = {
        hostname: pinned.address,
        family: pinned.family,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        method: request.method,
        path: `${target.pathname}${target.search}`,
        headers: cleanProxyHeaders(request.headers, target.host),
      };
      const upstream = target.protocol === 'https:'
        ? https.request({ ...requestOptions, servername: normalizedHostname(target.hostname) })
        : http.request(requestOptions);
      upstream.on('response', (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      });
      upstream.on('error', () => {
        if (!response.headersSent) response.writeHead(502);
        response.end('Upstream request failed');
      });
      request.pipe(upstream);
    })().catch(() => {
      if (!response.headersSent) response.writeHead(403);
      response.end('Blocked by legitAgent network policy');
    });
  });

  proxy.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });

  proxy.on('connect', (request, client, head) => {
    void (async () => {
      const authority = new URL(`http://${request.url ?? ''}`);
      const port = Number(authority.port || 443);
      if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('Invalid target port');
      const pinned = await resolvePublicAddress(authority.hostname, resolver);
      const upstream = net.createConnection({ host: pinned.address, family: pinned.family, port });
      sockets.add(upstream);
      upstream.once('close', () => sockets.delete(upstream));
      upstream.once('connect', () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length > 0) upstream.write(head);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.on('error', () => destroyPair(client, upstream));
      client.on('error', () => destroyPair(client, upstream));
    })().catch(() => {
      client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    });
  });

  proxy.on('upgrade', (request, client, head) => {
    void (async () => {
      const target = requestTarget(request.url);
      if (target.protocol !== 'http:') throw new Error('Unsupported WebSocket proxy protocol');
      const pinned = await resolvePublicAddress(target.hostname, resolver);
      const port = Number(target.port || 80);
      const upstream = net.createConnection({ host: pinned.address, family: pinned.family, port });
      sockets.add(upstream);
      upstream.once('close', () => sockets.delete(upstream));
      upstream.once('connect', () => {
        const headers = cleanProxyHeaders(request.headers, target.host);
        const lines = [`${request.method ?? 'GET'} ${target.pathname}${target.search} HTTP/${request.httpVersion}`];
        for (const [name, value] of Object.entries(headers)) {
          if (Array.isArray(value)) value.forEach((item) => lines.push(`${name}: ${item}`));
          else if (value !== undefined) lines.push(`${name}: ${value}`);
        }
        upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
        if (head.length > 0) upstream.write(head);
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.on('error', () => destroyPair(client, upstream));
      client.on('error', () => destroyPair(client, upstream));
    })().catch(() => {
      client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    });
  });

  await new Promise<void>((resolve, reject) => {
    proxy.once('error', reject);
    proxy.listen(0, '127.0.0.1', () => {
      proxy.off('error', reject);
      resolve();
    });
  });
  const address = proxy.address();
  if (!address || typeof address === 'string') throw new Error('Не удалось запустить безопасный сетевой прокси');

  return {
    server: `http://127.0.0.1:${address.port}`,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => {
        proxy.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
