import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const out = path.resolve(root, 'standalone-build');
await build({
  configFile: false,
  root: path.join(root, 'standalone'),
  base: './',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': root } },
  build: { outDir: out, emptyOutDir: true, assetsInlineLimit: 0 },
});
let html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
const photo =
  'data:image/jpeg;base64,' +
  (
    await fs.readFile(path.join(root, 'public/beer-illustration-v2.jpg'))
  ).toString('base64');
const icon =
  'data:image/png;base64,' +
  (await fs.readFile(path.join(root, 'public/app-icon-v2.png'))).toString(
    'base64',
  );
for (const match of [
  ...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g),
]) {
  let js = await fs.readFile(path.resolve(out, match[1]), 'utf8');
  js = js
    .replaceAll('/beer-illustration-v2.jpg', photo)
    .replaceAll('</script', '<\\/script');
  html = html.replace(
    match[0],
    () => '<script type="module">' + js + '</script>',
  );
}
for (const match of [
  ...html.matchAll(/<link[^>]*href="([^"]+\.css)"[^>]*>/g),
]) {
  const css = await fs.readFile(path.resolve(out, match[1]), 'utf8');
  html = html.replace(match[0], () => '<style>' + css + '</style>');
}
html = html.replace(
  '</head>',
  `<link rel="icon" href="${icon}"/><link rel="apple-touch-icon" href="${icon}"/></head>`,
);
await fs.writeFile(path.join(out, '喝了么.html'), html);
console.log(
  'Standalone HTML created (' +
    Math.round(Buffer.byteLength(html) / 1024) +
    ' KB).',
);
