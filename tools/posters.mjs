// 给每台车从自己的 3D 页面截一张透明底海报（assets/posters/<id>.webp），首页用。改了模型后重跑。
// 用法：node tools/posters.mjs [id …]
import { createRequire } from 'node:module'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire('C:/Users/73405/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright'); const sharp = require('sharp');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const PICK = { 'model-y': 'blue', 'model-3': 'red', 'model-s': 'grey', 'model-x': 'silver', 'roadster-2008': 'red', cybercab: 'gold', 'roadster-next': 'red' };
const cars = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cars.json'), 'utf8')), only = process.argv.slice(2);
fs.mkdirSync(path.join(ROOT, 'assets/posters'), { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })).newPage();
for (const c of cars) {
  if (only.length && !only.includes(c.id)) continue;
  await page.goto('about:blank'); await page.goto(`http://127.0.0.1:${srv.address().port}/#/car/${c.id}`);
  await page.waitForFunction(() => window.__atlas && window.__atlas.ready === true, null, { timeout: 20000 });
  if (PICK[c.id]) await page.click(`[data-testid=color][data-id="${PICK[c.id]}"]`);
  await page.addStyleTag({ content: '.nav,.info,.ctl,.hint,.foot{display:none!important}html,body,.stage{background:transparent!important}.stage{height:900px!important}' });
  await page.waitForTimeout(700);
  const png = await page.locator('[data-testid=canvas]').screenshot({ omitBackground: true });
  const out = path.join(ROOT, 'assets/posters', c.id + '.webp');
  await sharp(png).resize(1600, 900).webp({ quality: 82, alphaQuality: 90 }).toFile(out);
  console.log(c.id, (fs.statSync(out).size / 1024).toFixed(0), 'KB');
}
await browser.close(); srv.close();
