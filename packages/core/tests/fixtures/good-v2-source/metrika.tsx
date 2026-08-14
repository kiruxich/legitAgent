export function boot() {
  if (consent) {
    ym(123456, 'init', { clickmap: true });
  }
}
