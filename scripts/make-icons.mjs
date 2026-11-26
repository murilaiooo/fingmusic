/** Gera os PNGs de ícone e splash a partir de public/icons/icon.svg (usa o Chromium do Playwright). */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const out = (f) => new URL('../public/icons/' + f, import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [size, name, pad] of [[192, 'icon-192.png', 0], [512, 'icon-512.png', 0], [512, 'icon-maskable-512.png', 0.12], [180, 'apple-touch-icon.png', 0]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:#06070d"><div style="width:${size}px;height:${size}px;display:grid;place-items:center">${svg.replace('<svg ', `<svg width="${size * (1 - pad * 2)}" height="${size * (1 - pad * 2)}" `)}</div></body>`);
  await page.screenshot({ path: out(name) });
}
for (const [w, h] of [[1170, 2532], [1290, 2796], [1179, 2556]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<body style="margin:0;background:radial-gradient(120% 60% at 50% 100%,#2a2160,#06070d 70%);height:${h}px;display:grid;place-items:center">${svg.replace('<svg ', '<svg width="360" height="360" ').replace('rx="112"', 'rx="0" opacity="0"')}</body>`);
  await page.screenshot({ path: out(`splash-${w}x${h}.png`) });
}
await browser.close();
console.log('ícones gerados');
