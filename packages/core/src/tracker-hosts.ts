const FOREIGN_TRACKER_HOSTS = ['google-analytics.com', 'googletagmanager.com', 'facebook.net'];

export function findForeignTrackerUrl(source: string): { value: string; index: number } | undefined {
  for (const match of source.matchAll(/(?<![\w:])(?:https?:)?\/\/[^\s"'<>`]+/gi)) {
    try {
      const url = new URL(match[0].startsWith('//') ? `https:${match[0]}` : match[0]);
      const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
      if (FOREIGN_TRACKER_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
        return { value: match[0], index: match.index ?? 0 };
      }
    } catch {
      // Dynamic or incomplete URLs do not establish a third-party hostname.
    }
  }
  return undefined;
}
