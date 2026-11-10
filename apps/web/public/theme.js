// Theme and palette before the first paint (no flash). Same logic and keys as src/lib/theme.ts.
// Loaded from index.html's <head> without defer: it runs before the page is painted. A file and
// not inline so the Content-Security-Policy (server.ts) doesn't have to allow inline scripts.
try {
  const theme = localStorage.getItem('kachingga-theme');
  if (theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches))
    document.documentElement.classList.add('dark');
  const palette = localStorage.getItem('kachingga-palette');
  if (/^(green|blue|violet|yellow|mono)$/.test(palette))
    document.documentElement.dataset.palette = palette;
} catch {
  // Storage blocked: the app starts with the system's theme and green.
}
