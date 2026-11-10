// 调试用：给一台车截 外观/开门/内饰 三张图到 shots/dbg-<id>-*.png，并拼成 shots/dbg-<id>.png。用法：node tools/shot.mjs <id> [颜色 id]
import { createRequire } from 'node:module'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire('C:/Users/73405/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright'); const sharp = require('sharp');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), [id, color] = process.argv.slice(2);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
page.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 200)); }); page.on('pageerror', e => console.log('pageerror', e.message.slice(0, 200)));
await page.goto(`http://127.0.0.1:${srv.address().port}/#/car/${id}`);
await page.waitForFunction(() => window.__atlas && window.__atlas.ready === true, null, { timeout: 30000 });
if (color) await page.click(`[data-testid=color][data-id="${color}"]`);
await page.addStyleTag({ content: '.info,.hint{display:none!important}' });
const snap = async n => { await page.waitForTimeout(400); const f = path.join(ROOT, 'shots', `dbg-${id}-${n}.png`); await page.screenshot({ path: f }); return f; };
const fs_ = [await snap('ext')];
if (await page.locator('[data-testid=doors]').count()) { await page.click('[data-testid=doors]'); await page.waitForTimeout(1500); fs_.push(await snap('doors'));
  const c = await page.locator('[data-testid=canvas]').boundingBox(); await page.mouse.move(c.x + 640, c.y + 300); await page.mouse.down(); await page.mouse.move(c.x + 300, c.y + 260, { steps: 12 }); await page.mouse.up(); fs_.push(await snap('doors2')); }
if (await page.locator('[data-testid=view-interior]').count()) { await page.click('[data-testid=view-interior]'); await page.waitForTimeout(1500); fs_.push(await snap('int')); }
const tiles = await Promise.all(fs_.map(async (f, i) => ({ input: await sharp(f).resize(960, 570).toBuffer(), left: (i % 2) * 960, top: Math.floor(i / 2) * 570 })));
await sharp({ create: { width: 1920, height: 570 * Math.ceil(fs_.length / 2), channels: 3, background: '#fff' } }).composite(tiles).png().toFile(path.join(ROOT, 'shots', `dbg-${id}.png`));
await browser.close(); srv.close();
