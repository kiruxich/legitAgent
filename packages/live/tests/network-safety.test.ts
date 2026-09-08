import http from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  PRIVATE_NETWORK_ERROR,
  isBlockedNetworkAddress,
  resolvePublicAddress,
  startPinnedProxy,
  type ResolveHostname,
} from '../src/network-safety.js';

describe('live network safety', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '100.64.0.1',
    '169.254.169.254',
    '192.168.1.1',
    '::1',
    '::ffff:127.0.0.1',
    'fe90::1',
    'fc00::1',
  ])('blocks non-public address %s', (address) => {
    expect(isBlockedNetworkAddress(address)).toBe(true);
  });

  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])('allows public address %s', (address) => {
    expect(isBlockedNetworkAddress(address)).toBe(false);
  });

  it('rejects a hostname if any DNS answer points to a private network', async () => {
    const resolver: ResolveHostname = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ];
    await expect(resolvePublicAddress('rebind.test', resolver)).rejects.toThrow(PRIVATE_NETWORK_ERROR);
  });

  it('pins proxy connections to a checked answer and refuses a rebound private answer', async () => {
    const resolver: ResolveHostname = async () => [{ address: '127.0.0.1', family: 4 }];
    const proxy = await startPinnedProxy(resolver);
    try {
      const proxyUrl = new URL(proxy.server);
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const request = http.request({
          hostname: proxyUrl.hostname,
          port: proxyUrl.port,
          method: 'GET',
          path: 'http://rebind.test/private',
        }, (response) => {
          response.resume();
          response.once('end', () => resolve(response.statusCode));
        });
        request.once('error', reject);
        request.end();
      });
      expect(status).toBe(403);
    } finally {
      await proxy.close();
    }
  });
});
