// 特斯拉车型图鉴（TeslaAtlas）验收脚本 —— 判卷标准，冻结，任何人不许改（改了就算不合格）。
// 用法（在 D:\blender\TeslaAtlas 下）：
//   node tools/accept.mjs                 本地全量验收：自带静态服务器，站点挂在 /tesla-atlas/ 子路径（和 GitHub Pages 一样）
//   node tools/accept.mjs --url <线上网址> 线上验收：除 sources 组外全查，另加：线上 data/cars.json 与每个 .glb 必须和本地逐字节相同
//   node tools/accept.mjs --prove         反向验证：逐个注入破坏，对应检查必须变红。全部抓到 → 退出码 1；有没抓到的 → 退出码 2
//   node tools/accept.mjs --only 组,组     只跑某几组（调试用）：data sources home car dash prefs credits perf layout。交付必须跑全量
//   node tools/accept.mjs --text <网址>    打印判卷眼里这个网页的文字（摘 quote 用，摘的句子必须能在这里面找到）
// 全部 PASS 退出码 0；任一 FAIL 退出码 1。截图写到 shots/。sources 组要联网。
// 判卷用画面本身判：3D 画布截图前后比像素。只改属性、画面不变，骗不过去。
//
// ───── 必须有的 11 台车（id 固定）─────
// roadster-2008 model-s model-x model-3 model-y cybertruck semi cybercab roadster-next robovan cyberquad
//
// ───── 数据契约 data/cars.json（数组，每台车一项，可以多于 11 台）─────
// { id, name:{zh,en}, kind:"production"|"concept",
//   designer:{zh,en},                 多位设计师在 en 里用英文逗号隔开
//   unveilYear: 首次公开亮相年份（整数）, deliveryYear: 首次交付年份或 null,
//   price:{ usd: 发布时起售价（美元整数）或 null, note:{zh,en} },        usd 为 null 只允许 kind=concept
//   status:"production"|"discontinued"|"upcoming"|"concept", statusAsOf:"YYYY-MM"（≥ 2026-06）,
//   sales:{ units: 累计销量（整数）或 null, kind:"official"|"estimate"|"none", asOf:"YYYY-MM"|null },  kind=none 时 units 必须 null；至少 5 台车有数
//   dims:{ l, w, h } 官方长宽高，毫米；查不到官方数字只允许 kind=concept 写 null,
//   facts:{ designer, unveilYear, price, status, sales, dims } 每项 { source:"https 原网页", quote:"原样摘的一句" 或 ["几句"] }
//       每句 8–300 字，判卷用真浏览器打开 source，页面文字里必须找得到（忽略空白和大小写）。另外：
//       designer 的句子里要有 designer.en 的每个名字；unveilYear 要有这个年份；price 要有 usd 这个数；
//       sales 要有 units（写成 3.5 million / 350 万 这类也认：数字×1000 或 ×1000000 或 ×10000 等于 units）；
//       dims 要分别有长、宽、高（毫米、英寸×25.4、米×1000 都认）。值为 null 的那项不用给 facts。
//       source 不许是 github/个人托管/文库/网盘类网站
//       （2026-11-10 领导批准的修订）任何一项也可以写成数组 [{source,quote},{source,quote}]：几个数字出自不同网页时分项给出处，
//       每句都要在它自己的 source 里找得到，所有句子合起来要含全上面要求的数字
//   colors:[{ id, name:{zh,en}, hex:"#rrggbb" }]  ≥3 种，hex 不重复,
//   doors:["fl","fr",…]  能开的门的 id；只有 cyberquad 允许空数组,
//   model:{ file:"models/<id>.glb", origin:"community"|"selfbuilt", simplified:bool, interior:bool,
//           sources:[{ url:"https://sketchfab.com/3d-models/…<32位uid>", author, license }] } }
//       community＝来自 Sketchfab 的模型：sources ≥1，license 只许 "CC Attribution" "CC Attribution-ShareAlike" "CC0 Public Domain"，
//         判卷去 Sketchfab 公开接口核对 license 和 author（＝接口里的 username 或 displayName）
//       selfbuilt＝自己建的：simplified 必须 true。selfbuilt 最多 4 台
//       interior:false（没有内饰）最多 2 台（cyberquad 不占名额）
//
// ───── 模型契约 models/<id>.glb ─────
// 单个 ≤ 8 MB。坐标 Y 朝上、单位米，静止姿态＝车门全关。判卷直接解析 .glb 文件：
//   整车包围盒：长（水平较长边）与 dims.l 差 ≤2%，宽（水平较短边）与 dims.w 差 ≤6%，高与 dims.h 差 ≤4%；dims 为 null 时只要求长 1–15 米
//   三角面数：community ≥ 30000，selfbuilt ≥ 3000，都 ≤ 700000
//   doors 里每个 id 要有一个名叫 door_<id> 的节点，它（连同子节点）≥ 50 个三角面
//   interior:true 要有一个名叫 interior 的节点，它（连同子节点）≥ 500 个三角面
//   至少一个名字以 paint 开头的材质，用它的面 ≥ 200 个三角面（车漆，换颜色换的就是它）
//
// ───── 页面契约 ─────
// 路由：#/ 首页；#/car/<id> 单车 3D；#/dashboard 数据看板；#/credits 模型署名与出处
// window.__atlas.ready：当前页面内容就绪（单车页＝模型载入且画出第一帧）时为 true
// 每页都有：[data-testid=lang] 中英切换；[data-testid=theme] 深浅色切换；[data-testid=disclaimer] 声明（≥20 字，中文含「非官方」、英文含 unofficial）
// 语言：默认 <html lang="zh-CN">，切换后 "en"，刷新后保持
// 主题：<html data-theme="dark"|"light">；没存过偏好时跟随系统；切换后刷新保持；深色页面底色亮度 ≤0.12，浅色 ≥0.85；正文与底色对比度 ≥4.5
// #/：≥3 个 [data-testid=hero] 整屏区块（每个高 ≥ 90% 视口）；每台车一个 [data-testid=car-link][data-id]，点了进 #/car/<id>
// #/car/<id>：
//   [data-testid=canvas] 一个 <canvas>。画面静止时不许自己动（不自动旋转）；按住拖动可转视角
//   [data-testid=color][data-id=<颜色 id>] 每种颜色一个，aria-pressed 标当前色；点了车漆变成这个颜色（0.5 秒内变完）
//   [data-testid=doors] 开/关全部车门，aria-pressed＝是否开着；动画 ≤1.5 秒；再点一次关回原样。doors 为空的车不显示这个按钮
//   [data-testid=view-interior] 镜头进车内看内饰；[data-testid=view-exterior] 镜头回到外观初始位置。动画 ≤1.2 秒
//     interior:false 的车不显示 view-interior，改为显示 [data-testid=no-interior]
//   simplified:true 的车显示 [data-testid=simplified]（说明这是简化模型），其余不显示
//   [data-testid=spec-designer|spec-year|spec-price|spec-status|spec-sales] 五项资料：
//     designer 含当前语言的设计师名；year 含 unveilYear；price 含 usd 的完整数字（可带千分位，null 显示说明文字）；
//     status 元素带 data-status=<status>；sales 含 units 的完整数字（可带千分位），kind=estimate 时里面要有可见的 [data-testid=est]
// #/dashboard：
//   每台车一行 [data-testid=row][data-id][data-status]，行内文字含：当前语言的车名和设计师、unveilYear、usd 完整数字、units 完整数字；
//     sales.kind=estimate 的行里有可见的 [data-testid=est]（标「估算」），其余行没有
//   [data-testid=kpi-models] 车型总数；[data-testid=kpi-production] 在产数；[data-testid=kpi-discontinued] 停产数；
//   [data-testid=kpi-sales] 各车 units 之和（完整数字，可带千分位）
//   [data-testid=sort][data-key=year|price|sales]：点一次按该项从大到小排行，再点一次从小到大；没有数的排最后
//   ≥2 个 [data-testid=chart]（每个 ≥240×120，里面是 <svg> 或 <canvas>）
// #/credits：每台车一个 [data-testid=credit][data-id]，community 的要含每个 sources 的 author、license 和指向 url 的链接
// 同一时刻 DOM 里每个 data-testid 只许出现一次（hero car-link color row est chart sort credit 除外）
// 390×844、1280×720、1440×900 下任何页面不许横向滚动；390×844 的单车页里 doors 和第一个 color 按钮不滚动就完整可见、没被挡，画布可见面积 ≥30%
// 流畅：单车页从打开到 ready ≤10 秒（线上 ≤20 秒）；model-y 页拖动转视角 3 秒，帧间隔 p95 ≤40ms、超过 50ms 的帧 ≤6
// 首页（等 2.5 秒）总下载 ≤10 MB；单车页 ≤14 MB
// 页面不许请求任何外域资源；控制台不许有报错；不许弹浏览器原生对话框
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/73405/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const PROVE = args.includes('--prove');
const urlArg = args.includes('--url') ? args[args.indexOf('--url') + 1] : null;
const textArg = args.includes('--text') ? args[args.indexOf('--text') + 1] : null;
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const SHOT = path.join(ROOT, 'shots');
const SUB = '/tesla-atlas/';
const MUST = ['roadster-2008', 'model-s', 'model-x', 'model-3', 'model-y', 'cybertruck', 'semi', 'cybercab', 'roadster-next', 'robovan', 'cyberquad'];
const STATUS = ['production', 'discontinued', 'upcoming', 'concept'];
const LICENSES = ['CC Attribution', 'CC Attribution-ShareAlike', 'CC0 Public Domain'];
const LIST_IDS = ['hero', 'car-link', 'color', 'row', 'est', 'chart', 'sort', 'credit'];
const BAD_HOST = /(^|\.)(github\.io|github\.com|githubusercontent\.com|gitlab\.io|gist\.|pastebin\.com|glitch\.me|netlify\.app|vercel\.app|pages\.dev|surge\.sh|web\.app|firebaseapp\.com|blogspot\.com|wordpress\.com|medium\.com|notion\.site|google\.com|scribd\.com|studocu\.com|slideshare\.net|coursehero\.com|baidu\.com|localhost|127\.0\.0\.1)$/i;

let results = [];
function rec(id, ok, msg) { results.push({ id, ok, msg }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${msg}`); }
const tid = id => `[data-testid="${id}"]`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const want = g => !ONLY || ONLY.includes(g);
const list = (a, n = 6) => a.slice(0, n).join('；') + (a.length > n ? ` …共 ${a.length} 条` : '');
const digits = s => String(s).replace(/[,\s\u00a0\u202f，]/g, '');
const norm = s => String(s).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
function numbersIn(s) { return (String(s).normalize('NFKC').match(/\d[\d,]*(?:\.\d+)?/g) || []).map(x => +x.replace(/,/g, '')).filter(Number.isFinite); }

// ───── 静态服务器 ─────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.hdr': 'application/octet-stream', '.exr': 'application/octet-stream', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (!u.startsWith(SUB)) { rsp.writeHead(u === '/favicon.ico' ? 404 : 302, { location: SUB }); return rsp.end(); }
      let f = path.join(ROOT, u.slice(SUB.length));
      if (!f.startsWith(ROOT)) { rsp.writeHead(403); return rsp.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { rsp.writeHead(404); return rsp.end('404'); }
      const st = fs.statSync(f);
      rsp.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' });
      fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

// ───── 注入页面的监听器与破坏（判卷自己的，和网页代码无关）─────
function probeInit(sab) {
  const RAF = window.requestAnimationFrame.bind(window);
  const P = window.__probe = { frames: [] };
  const fr = () => { P.frames.push(performance.now()); if (P.frames.length > 8000) P.frames.splice(0, 2000); RAF(fr); };
  RAF(fr);
  P.stats = (t0, t1) => {
    const f = P.frames.filter(x => x >= t0 && x <= t1), d = [];
    for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
    d.sort((a, b) => a - b);
    return { n: d.length, p95: d.length ? d[Math.min(d.length - 1, Math.floor(d.length * 0.95))] : 999, slow: d.filter(x => x > 50).length };
  };
  if (sab.jank) { const r = window.requestAnimationFrame; window.requestAnimationFrame = cb => r.call(window, t => { const s = performance.now(); while (performance.now() - s < 45); cb(t); }); }
  if (sab.freeze) {
    for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!C) continue;
      for (const f of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements', 'clear']) {
        const o = C.prototype[f]; if (!o) continue;
        C.prototype[f] = function (...a) { if (window.__freeze) return; return o.apply(this, a); };
      }
    }
  }
  const dead = sel => window.addEventListener('click', e => { if (e.target.closest && e.target.closest(sel)) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  if (sab.nocolor) dead('[data-testid=color]');
  if (sab.nodoor) dead('[data-testid=doors]');
  if (sab.noview) dead('[data-testid=view-interior]');
  if (sab.nolang) dead('[data-testid=lang]');
  if (sab.notheme) dead('[data-testid=theme]');
  if (sab.nosort) dead('[data-testid=sort]');
  if (sab.noorbit) for (const ev of ['pointerdown', 'mousedown', 'touchstart']) window.addEventListener(ev, e => { if (e.target && e.target.tagName === 'CANVAS') e.stopImmediatePropagation(); }, true);
  const css = t => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = t; document.head.appendChild(s); });
  if (sab.noest) css('[data-testid=est]{display:none!important}');
  if (sab.hscroll) css('html,body{overflow-x:visible!important}body::after{content:"";display:block;width:3000px;height:2px}');
  if (sab.ext) document.addEventListener('DOMContentLoaded', () => { const i = new Image(); i.src = 'https://example.com/atlas-probe.png'; });
  if (sab.cerr) setTimeout(() => console.error('atlas-probe error'), 1500);
}

// ───── 画面工具 ─────
async function shot(page, name) {
  const bb = await page.locator(tid('canvas')).boundingBox();
  if (!bb) throw new Error('找不到 [data-testid=canvas]');
  const vp = page.viewportSize();
  const clip = { x: Math.max(0, bb.x), y: Math.max(0, bb.y), width: Math.max(4, Math.min(bb.width, vp.width - Math.max(0, bb.x))), height: Math.max(4, Math.min(bb.height, vp.height - Math.max(0, bb.y))) };
  const buf = await page.screenshot({ clip });
  if (name) fs.writeFileSync(path.join(SHOT, name + '.png'), buf);
  return PNG.sync.read(buf);
}
function diffMask(a, b, thr = 30) {
  if (a.width !== b.width || a.height !== b.height) return { ratio: 1, mean: [0, 0, 0] };
  let n = 0; const N = a.width * a.height, s = [0, 0, 0];
  for (let i = 0; i < N * 4; i += 4) if (Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2])) > thr) { n++; s[0] += b.data[i]; s[1] += b.data[i + 1]; s[2] += b.data[i + 2]; }
  return { ratio: n / N, mean: n ? s.map(v => v / n) : [0, 0, 0] };
}
const diffRatio = (a, b) => diffMask(a, b).ratio;
const colorDist = (p, q) => (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2])) / 3;
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function stddev(img) {
  let s = 0, s2 = 0; const N = img.width * img.height;
  for (let i = 0; i < N * 4; i += 4) { const v = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3; s += v; s2 += v * v; }
  const m = s / N; return Math.sqrt(Math.max(0, s2 / N - m * m));
}
const pct = x => (x * 100).toFixed(1) + '%';

// ───── 解析 .glb（不依赖任何库）─────
function mul(a, b) { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
function trs(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0, (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0, (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}
function readGlb(file) {
  const b = fs.readFileSync(file);
  if (b.length < 20 || b.readUInt32LE(0) !== 0x46546C67) throw new Error('不是 .glb 文件');
  const g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const nodes = g.nodes || [], NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const tris = new Array(nodes.length).fill(0), byMat = {}; let total = 0;
  const primTris = p => { const m = p.mode ?? 4; if (m !== 4 && m !== 5 && m !== 6) return 0; const a = g.accessors[p.indices ?? p.attributes.POSITION]; return a ? (m === 4 ? Math.floor(a.count / 3) : Math.max(0, a.count - 2)) : 0; };
  const seen = new Set();
  function walk(i, M) {
    if (seen.has(i)) return 0; seen.add(i);
    const n = nodes[i]; const W = mul(M, trs(n)); let t = 0;
    if (n.mesh != null) for (const p of g.meshes[n.mesh].primitives || []) {
      const k = primTris(p); t += k;
      const mn = p.material != null ? (g.materials[p.material].name || '') : ''; byMat[mn] = (byMat[mn] || 0) + k;
      const a = g.accessors[p.attributes.POSITION]; if (!a || !a.min || !a.max) continue;
      const s = a.normalized && NORM[a.componentType] ? 1 / NORM[a.componentType] : 1;
      for (let c = 0; c < 8; c++) {
        const v = [(c & 1 ? a.max[0] : a.min[0]) * s, (c & 2 ? a.max[1] : a.min[1]) * s, (c & 4 ? a.max[2] : a.min[2]) * s];
        for (let r = 0; r < 3; r++) { const w = W[r] * v[0] + W[4 + r] * v[1] + W[8 + r] * v[2] + W[12 + r]; if (w < box.min[r]) box.min[r] = w; if (w > box.max[r]) box.max[r] = w; }
      }
    }
    for (const c of n.children || []) t += walk(c, W);
    tris[i] = t; return t;
  }
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const r of (g.scenes && g.scenes[g.scene ?? 0] || { nodes: [] }).nodes || []) total += walk(r, I);
  const ext = [0, 1, 2].map(k => box.max[k] - box.min[k]);
  const sub = name => { let t = -1; nodes.forEach((n, i) => { if (n.name === name && seen.has(i)) t = Math.max(t, tris[i]); }); return t; };
  let paint = 0; for (const [k, v] of Object.entries(byMat)) if (/^paint/i.test(k)) paint += v;
  return { l: Math.max(ext[0], ext[2]), w: Math.min(ext[0], ext[2]), h: ext[1], total, sub, paint };
}

// ───── 读数据 ─────
function readCars() { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cars.json'), 'utf8')); } catch (e) { return null; } }
let CARS = [];
const two = x => x && typeof x.zh === 'string' && x.zh.trim() && typeof x.en === 'string' && x.en.trim();
const ym = s => typeof s === 'string' && /^20\d\d-(0[1-9]|1[0-2])$/.test(s);
const partsOf = f => !f ? [] : (Array.isArray(f) ? f : [f]).filter(x => x && typeof x === 'object');
const quotesOf = f => partsOf(f).flatMap(x => Array.isArray(x.quote) ? x.quote : [x.quote]).filter(q => typeof q === 'string');
const designers = c => String(c.designer.en).split(',').map(s => s.trim()).filter(Boolean);
const sbUid = u => { const m = /([0-9a-f]{32})\/?$/i.exec(String(u).split(/[?#]/)[0]); return m ? m[1] : null; };

function schemaProblems(c) {
  const p = [], id = c && c.id;
  if (!c || typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) return ['id 不合法'];
  if (!two(c.name)) p.push('name'); if (!['production', 'concept'].includes(c.kind)) p.push('kind');
  if (!two(c.designer)) p.push('designer');
  if (!Number.isInteger(c.unveilYear) || c.unveilYear < 2003 || c.unveilYear > 2026) p.push('unveilYear');
  if (!(c.deliveryYear === null || (Number.isInteger(c.deliveryYear) && c.deliveryYear >= c.unveilYear))) p.push('deliveryYear');
  if (!c.price || !two(c.price.note) || !(c.price.usd === null ? c.kind === 'concept' : Number.isInteger(c.price.usd) && c.price.usd > 0)) p.push('price');
  if (!STATUS.includes(c.status) || !ym(c.statusAsOf) || c.statusAsOf < '2026-06') p.push('status/statusAsOf');
  const s = c.sales || {};
  if (!['official', 'estimate', 'none'].includes(s.kind) || (s.kind === 'none' ? s.units !== null : !(Number.isInteger(s.units) && s.units > 0 && ym(s.asOf)))) p.push('sales');
  if (!(c.dims === null ? c.kind === 'concept' : c.dims && ['l', 'w', 'h'].every(k => typeof c.dims[k] === 'number' && c.dims[k] > 300 && c.dims[k] < 20000))) p.push('dims');
  const cols = c.colors || [];
  if (cols.length < 3 || cols.some(x => !x || typeof x.id !== 'string' || !two(x.name) || !/^#[0-9a-f]{6}$/i.test(x.hex || '')) || new Set(cols.map(x => String(x.hex).toLowerCase())).size !== cols.length || new Set(cols.map(x => x.id)).size !== cols.length) p.push('colors');
  if (!Array.isArray(c.doors) || c.doors.some(d => typeof d !== 'string' || !/^[a-z0-9]+$/.test(d)) || new Set(c.doors).size !== c.doors.length || (c.doors.length === 0 && id !== 'cyberquad')) p.push('doors');
  const m = c.model || {};
  if (m.file !== `models/${id}.glb` || !['community', 'selfbuilt'].includes(m.origin) || typeof m.simplified !== 'boolean' || typeof m.interior !== 'boolean' || !Array.isArray(m.sources)) p.push('model');
  else {
    if (m.origin === 'selfbuilt' && !m.simplified) p.push('selfbuilt 必须 simplified');
    if (m.origin === 'community' && (m.sources.length < 1 || m.sources.some(x => !x || !sbUid(x.url) || !/^https:\/\/sketchfab\.com\//.test(x.url) || !x.author || !LICENSES.includes(x.license)))) p.push('model.sources');
  }
  const need = { designer: true, unveilYear: true, price: c.price && c.price.usd !== null, status: true, sales: s.kind !== 'none', dims: c.dims !== null };
  for (const k of Object.keys(need)) if (need[k]) {
    const f = (c.facts || {})[k], q = quotesOf(f);
    if (!f || !partsOf(f).length || partsOf(f).some(x => typeof x.source !== 'string' || !/^https:\/\//.test(x.source) || !quotesOf(x).length) || !q.length || q.some(x => x.length < 8 || x.length > 300)) p.push(`facts.${k}`);
  }
  return p;
}

async function gData(sab) {
  const cars = CARS;
  if (!Array.isArray(cars) || !cars.length) { rec('data.schema', false, 'data/cars.json 不存在或不是数组'); return; }
  const sp = []; for (const c of cars) { const p = schemaProblems(c); if (p.length) sp.push(`${c && c.id}: ${p.join(',')}`); }
  if (new Set(cars.map(c => c.id)).size !== cars.length) sp.push('id 重复');
  rec('data.schema', sp.length === 0, sp.length ? list(sp) : `${cars.length} 台车字段齐全`);
  const miss = MUST.filter(id => !cars.some(c => c.id === id));
  rec('data.ids', miss.length === 0, miss.length ? '缺：' + miss.join(' ') : '11 台必有车型齐');
  const self = cars.filter(c => c.model && c.model.origin === 'selfbuilt').map(c => c.id), noint = cars.filter(c => c.id !== 'cyberquad' && c.model && c.model.interior === false).map(c => c.id), withSales = cars.filter(c => c.sales && c.sales.kind !== 'none').length;
  rec('data.quota', self.length <= 4 && noint.length <= 2 && withSales >= 5, `自建 ${self.length} 台（≤4）${self.join(',')}；无内饰 ${noint.length} 台（≤2）${noint.join(',')}；有销量数的 ${withSales} 台（≥5）`);
  const pf = [], ps = [], pd = [], pi = [], pp = []; let first = true;
  for (const c of cars) {
    const m = c.model || {}, f = path.join(ROOT, String(m.file || ''));
    if (!m.file || !fs.existsSync(f)) { pf.push(`${c.id} 文件不存在`); continue; }
    const size = fs.statSync(f).size; let g;
    try { g = readGlb(f); } catch (e) { pf.push(`${c.id} ${e.message.slice(0, 60)}`); continue; }
    const minT = m.origin === 'selfbuilt' ? 3000 : 30000;
    if (size > 8 * 1048576) pf.push(`${c.id} ${(size / 1048576).toFixed(1)} MB > 8`);
    if (g.total < minT || g.total > 700000) pf.push(`${c.id} 三角面 ${g.total}（要 ${minT}–700000）`);
    let d = c.dims; if (d && sab.dimlie && first) { d = { ...d, l: d.l * 1.1 }; first = false; }
    if (d) {
      const e = [[g.l, d.l / 1000, 0.02, '长'], [g.w, d.w / 1000, 0.06, '宽'], [g.h, d.h / 1000, 0.04, '高']].filter(([a, b, t]) => !(Math.abs(a - b) / b <= t)).map(([a, b, t, n]) => `${n} 模型 ${a.toFixed(3)} 米／官方 ${b.toFixed(3)} 米`);
      if (e.length) ps.push(`${c.id} ${e.join('，')}`);
    } else if (!(g.l >= 1 && g.l <= 15)) ps.push(`${c.id} 长 ${g.l.toFixed(2)} 米不在 1–15`);
    for (const dn of c.doors || []) { const t = g.sub('door_' + dn); if (t < 50) pd.push(`${c.id} door_${dn} ${t < 0 ? '没有这个节点' : t + ' 面'}`); }
    if (m.interior) { const t = g.sub('interior'); if (t < 500) pi.push(`${c.id} interior ${t < 0 ? '没有这个节点' : t + ' 面'}`); }
    if (g.paint < 200) pp.push(`${c.id} paint 材质只有 ${g.paint} 面`);
  }
  rec('model.file', pf.length === 0, pf.length ? list(pf) : '每个 .glb 都在、≤8 MB、面数合格');
  rec('model.scale', ps.length === 0, ps.length ? list(ps) : '模型长宽高与官方数据相符');
  rec('model.doors', pd.length === 0, pd.length ? list(pd) : '车门节点齐');
  rec('model.interior', pi.length === 0, pi.length ? list(pi) : '内饰节点齐');
  rec('model.paint', pp.length === 0, pp.length ? list(pp) : '车漆材质齐');
}

async function pageText(page, u) {
  let r = { status: 0, text: '' };
  for (let i = 0; i < 2 && r.status !== 200; i++) {
    try { const resp = await page.goto(u, { timeout: 45000, waitUntil: 'domcontentloaded' }); await sleep(2500); r = { status: resp ? resp.status() : 0, text: await page.evaluate(() => document.body ? document.body.innerText : '') }; }
    catch (e) { r = { status: 0, text: '', err: e.message.slice(0, 60) }; }
  }
  return r;
}

async function gSources(browser, sab) {
  const cars = JSON.parse(JSON.stringify(CARS || []));
  if (sab.factlie) { const c = cars.find(x => x.price && x.price.usd); if (c) c.price.usd += 7; }
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); const cache = new Map();
  const text = async u => { if (!cache.has(u)) cache.set(u, await pageText(page, u)); return cache.get(u); };
  const hostOk = u => { try { return !BAD_HOST.test(new URL(u).hostname); } catch (e) { return false; } };
  const near = (ns, v, tol = 0.5) => ns.some(n => Math.abs(n - v) <= tol);
  const has = {
    designer: (c, q) => designers(c).every(n => norm(q).includes(norm(n))) || '句子里没有设计师名',
    unveilYear: (c, q) => near(numbersIn(q), c.unveilYear, 0) || `句子里没有 ${c.unveilYear}`,
    price: (c, q) => near(numbersIn(q), c.price.usd, 0) || `句子里没有 ${c.price.usd}`,
    status: () => true,
    sales: (c, q) => numbersIn(q).some(n => [1, 1e3, 1e4, 1e6].some(k => Math.abs(n * k - c.sales.units) < 0.5)) || `句子里没有 ${c.sales.units}`,
    dims: (c, q) => { const ns = numbersIn(q); const bad = ['l', 'w', 'h'].filter(k => !ns.some(n => Math.abs(n - c.dims[k]) <= 1 || Math.abs(n * 25.4 - c.dims[k]) <= 2 || Math.abs(n * 1000 - c.dims[k]) <= 1)); return !bad.length || `句子里没有 ${bad.map(k => c.dims[k]).join('/')}`; },
  };
  for (const k of Object.keys(has)) {
    const bad = []; let n = 0;
    for (const c of cars) {
      const need = k === 'price' ? c.price && c.price.usd !== null : k === 'sales' ? c.sales && c.sales.kind !== 'none' : k === 'dims' ? !!c.dims : true;
      if (!need) continue; n++;
      const f = (c.facts || {})[k], qs = quotesOf(f);
      if (!f || !qs.length) { bad.push(`${c.id} 没给出处`); continue; }
      if (partsOf(f).some(x => !hostOk(x.source))) { bad.push(`${c.id} 来源站不允许`); continue; }
      let ok; try { ok = has[k](c, qs.join(' ¦ ')); } catch (e) { ok = '数据不全'; }
      if (ok !== true) { bad.push(`${c.id} ${ok}`); continue; }
      for (const part of partsOf(f)) {
        const r = await text(part.source);
        if (r.status !== 200) { bad.push(`${c.id} 原网页 ${r.status || r.err}`); break; }
        const T = norm(r.text); const lost = quotesOf(part).filter(q => !T.includes(norm(q)));
        if (lost.length) { bad.push(`${c.id} 原网页里找不到「${lost[0].slice(0, 24)}…」`); break; }
      }
    }
    rec('src.' + k, n > 0 && bad.length === 0, !n ? '没有可核对的' : bad.length ? `${bad.length}/${n} 不过：` + list(bad) : `${n} 条都在原网页找到原文`);
  }
  await ctx.close();
  const mb = []; let mn = 0; const mc = new Map();
  for (const c of cars) for (const s of (c.model && c.model.origin === 'community' ? c.model.sources || [] : [])) {
    mn++; const uid = sbUid(s.url); if (!uid) { mb.push(`${c.id} 网址里没有 uid`); continue; }
    try {
      if (!mc.has(uid)) { const r = await fetch('https://api.sketchfab.com/v3/models/' + uid, { headers: { 'user-agent': 'atlas-judge' } }); mc.set(uid, r.status === 200 ? await r.json() : { status: r.status }); }
      const d = mc.get(uid);
      if (!d.license) { mb.push(`${c.id} Sketchfab 查无此模型（${d.status}）`); continue; }
      if (d.license.label !== s.license || !LICENSES.includes(d.license.label)) mb.push(`${c.id} 许可是「${d.license.label}」，不是「${s.license}」或不在允许之列`);
      else if (![d.user.username, d.user.displayName].includes(s.author)) mb.push(`${c.id} 作者应为 ${d.user.username}`);
    } catch (e) { mb.push(`${c.id} ${e.message.slice(0, 50)}`); }
  }
  rec('src.model', mb.length === 0, mb.length ? list(mb) : `${mn} 个社区模型的作者与许可都对得上`);
}

// ───── 页面会话 ─────
let BASE, HOST;
const G = { errors: [], external: [], dialogs: [] };
async function newPage(browser, sab, vp = { width: 1440, height: 900 }, colorScheme = 'light') {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, userAgent: UA, colorScheme });
  const page = await ctx.newPage(); page.bytes = 0;
  await page.addInitScript(probeInit, sab);
  page.on('console', m => { if (m.type() === 'error') G.errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', e => G.errors.push('pageerror ' + String(e.message).slice(0, 120)));
  page.on('request', r => { const u = r.url(); if (/^(data|blob|about):/.test(u)) return; try { if (new URL(u).host !== HOST) G.external.push(u.slice(0, 100)); } catch (e) { } });
  page.on('response', async r => { const cl = +(r.headers()['content-length'] || 0); if (cl) page.bytes += cl; else { try { page.bytes += (await r.body()).length; } catch (e) { } } });
  page.on('dialog', d => { G.dialogs.push(d.type()); d.dismiss().catch(() => { }); });
  return page;
}
async function open(page, route, ms = 10000) {
  await page.goto('about:blank'); page.bytes = 0;
  await page.goto(BASE + route);
  const t = Date.now();
  while (Date.now() - t < ms) { if (await page.evaluate(() => !!(window.__atlas && window.__atlas.ready === true)).catch(() => false)) return Date.now() - t; await sleep(50); }
  return -1;
}
async function clickT(page, id, extra = '', wait = 250) { await page.locator(tid(id) + extra).first().click({ timeout: 4000 }); await sleep(wait); }
const vis = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].some(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.1; }), sel);
const txt = (page, sel) => page.locator(sel).first().innerText({ timeout: 3000 }).catch(() => '');
const langOf = page => page.evaluate(() => document.documentElement.lang);
async function canvasPoint(page) {
  return page.evaluate(() => { const c = document.querySelector('[data-testid=canvas]'); if (!c) return null; const r = c.getBoundingClientRect(); for (const fy of [0.5, 0.4, 0.6, 0.3, 0.7]) for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7]) { const x = r.left + r.width * fx, y = r.top + r.height * fy; if (document.elementFromPoint(x, y) === c) return { x, y }; } return null; });
}
async function drag(page, p, dx, ms = 300) {
  await page.mouse.move(p.x, p.y); await page.mouse.down(); const steps = Math.max(6, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) { await page.mouse.move(p.x + dx * i / steps, p.y + 10 * Math.sin(i / steps * 3.14)); await sleep(16); }
  await page.mouse.up();
}

async function gHome(browser, sab) {
  const page = await newPage(browser, sab);
  const t = await open(page, '#/'); await sleep(2500);
  rec('home.ready', t >= 0, t >= 0 ? `${t} ms` : '10 秒内 __atlas.ready 没变 true');
  rec('home.bytes', page.bytes > 0 && page.bytes <= 10 * 1048576, `首页下载 ${(page.bytes / 1048576).toFixed(1)} MB（≤10）`);
  const heroes = await page.locator(tid('hero')).evaluateAll(es => es.map(e => e.getBoundingClientRect().height / innerHeight));
  rec('home.hero', heroes.filter(h => h >= 0.9).length >= 3, `整屏区块 ${heroes.filter(h => h >= 0.9).length} 个（≥3）`);
  const links = await page.locator(tid('car-link')).evaluateAll(es => es.map(e => e.dataset.id));
  const miss = (CARS || []).map(c => c.id).filter(id => !links.includes(id));
  let nav = '';
  try { const id = 'model-3'; await page.locator(`${tid('car-link')}[data-id="${id}"]`).first().click({ timeout: 4000 }); await sleep(1500); const h = await page.evaluate(() => location.hash); if (h !== '#/car/' + id) nav = `点 ${id} 后地址是 ${h}`; else if (!await vis(page, tid('canvas'))) nav = '进了单车页但没有画布'; }
  catch (e) { nav = '点不了 car-link：' + e.message.slice(0, 50); }
  rec('home.links', (CARS || []).length > 0 && miss.length === 0 && !nav, miss.length ? '缺入口：' + miss.join(' ') : nav || `${links.length} 个入口，点了能进单车页`);
  await page.context().close();
}

async function gCar(browser, sab) {
  const page = await newPage(browser, sab);
  const B = { ready: [], render: [], still: [], spec: [], color: [], doors: [], interior: [], orbit: [], badge: [], bytes: [] };
  const limit = urlArg ? 20000 : 10000;
  for (const c of CARS || []) {
    const id = c.id, sel = k => `${tid(k)}`;
    try {
      const t = await open(page, '#/car/' + id, limit);
      if (t < 0) { B.ready.push(`${id} ${limit / 1000} 秒内没就绪`); continue; }
      await sleep(900);
      if (page.bytes > 14 * 1048576) B.bytes.push(`${id} ${(page.bytes / 1048576).toFixed(1)} MB`);
      const A = await shot(page, 'car-' + id);
      if (stddev(A) < 8) B.render.push(`${id} 画面几乎是一片纯色`);
      await sleep(700); const A2 = await shot(page); const ds = diffRatio(A, A2);
      if (ds > 0.003) B.still.push(`${id} 没人碰也在动（${pct(ds)}）`);
      // 资料
      const lang = await langOf(page), L = lang === 'en' ? 'en' : 'zh', sp = [];
      if (!(await txt(page, sel('spec-designer'))).includes(c.designer[L])) sp.push('设计师');
      if (!(await txt(page, sel('spec-year'))).includes(String(c.unveilYear))) sp.push('年份');
      if (c.price.usd !== null && !digits(await txt(page, sel('spec-price'))).includes(String(c.price.usd))) sp.push('价格');
      if (await page.locator(sel('spec-status')).first().getAttribute('data-status', { timeout: 2000 }).catch(() => null) !== c.status) sp.push('状态');
      if (c.sales.kind !== 'none' && !digits(await txt(page, sel('spec-sales'))).includes(String(c.sales.units))) sp.push('销量');
      if ((c.sales.kind === 'estimate') !== await vis(page, `${sel('spec-sales')} ${sel('est')}`)) sp.push('估算标记');
      if (sp.length) B.spec.push(`${id} ${sp.join('/')}不对`);
      if (c.model.simplified !== await vis(page, sel('simplified'))) B.badge.push(`${id} 简化模型标记${c.model.simplified ? '缺' : '多'}`);
      if (sab.freeze) await page.evaluate(() => { window.__freeze = true; });
      // 颜色
      const cp = []; let prev = null, prevHex = null, pressed = 0;
      for (const col of [...c.colors, c.colors[0]]) {
        const cs = `${sel('color')}[data-id="${col.id}"]`;
        try { await page.locator(cs).first().click({ timeout: 3000 }); } catch (e) { cp.push(`${col.id} 点不了`); continue; }
        await sleep(650); const S = await shot(page);
        if (await page.locator(cs).first().getAttribute('aria-pressed') === 'true') pressed++;
        if (prev && prevHex.toLowerCase() !== col.hex.toLowerCase()) {
          const d = diffMask(prev, S);
          if (d.ratio < 0.015) cp.push(`→${col.id} 画面没变（${pct(d.ratio)}）`);
          else if (colorDist(hexRgb(prevHex), hexRgb(col.hex)) >= 100 && colorDist(d.mean, hexRgb(col.hex)) >= colorDist(d.mean, hexRgb(prevHex))) cp.push(`→${col.id} 变了但不像这个颜色`);
        }
        prev = S; prevHex = col.hex;
      }
      if (pressed < c.colors.length + 1) cp.push('aria-pressed 没跟着变');
      if (cp.length) B.color.push(`${id} ${cp.slice(0, 3).join('，')}`);
      // 车门
      if (c.doors.length) {
        try {
          const D0 = await shot(page); await clickT(page, 'doors', '', 1900); const D1 = await shot(page, 'doors-' + id);
          const on = await page.locator(sel('doors')).first().getAttribute('aria-pressed');
          await clickT(page, 'doors', '', 1900); const D2 = await shot(page);
          const a = diffRatio(D0, D1), b = diffRatio(D0, D2);
          if (a < 0.008) B.doors.push(`${id} 开门画面没变（${pct(a)}）`); else if (on !== 'true') B.doors.push(`${id} aria-pressed 没变 true`); else if (b > 0.005) B.doors.push(`${id} 关门后回不到原样（${pct(b)}）`);
        } catch (e) { B.doors.push(`${id} ${e.message.slice(0, 50)}`); }
      } else if (await vis(page, sel('doors'))) B.doors.push(`${id} 没有门却显示开门按钮`);
      // 内饰
      if (c.model.interior) {
        try {
          const C0 = await shot(page); await clickT(page, 'view-interior', '', 1600); const C1 = await shot(page, 'interior-' + id);
          await clickT(page, 'view-exterior', '', 1600); const C2 = await shot(page);
          const a = diffRatio(C0, C1), b = diffRatio(C0, C2);
          if (a < 0.2) B.interior.push(`${id} 进车内画面变化太小（${pct(a)}）`); else if (stddev(C1) < 8) B.interior.push(`${id} 车内画面一片纯色`); else if (b > 0.03) B.interior.push(`${id} 回外观没回到初始位置（${pct(b)}）`);
        } catch (e) { B.interior.push(`${id} ${e.message.slice(0, 50)}`); }
      } else if (!await vis(page, sel('no-interior')) || await vis(page, sel('view-interior'))) B.interior.push(`${id} 无内饰的车要显示 no-interior、不显示 view-interior`);
      // 转视角
      const p = await canvasPoint(page);
      if (!p) B.orbit.push(`${id} 画布全被挡住`); else { const O0 = await shot(page); await drag(page, p, 220); await sleep(500); const o = diffRatio(O0, await shot(page)); if (o < 0.03) B.orbit.push(`${id} 拖动后画面没变（${pct(o)}）`); }
    } catch (e) { B.ready.push(`${id} ${e.message.slice(0, 70)}`); }
  }
  const n = (CARS || []).length, R = (k, okMsg) => rec('car.' + k, n > 0 && B[k].length === 0 && B.ready.length === 0, B[k].length ? list(B[k], 4) : B.ready.length ? '有车没打开，见 car.ready' : okMsg);
  rec('car.ready', n > 0 && B.ready.length === 0, B.ready.length ? list(B.ready, 4) : `${n} 台车都在时限内就绪`);
  R('render', '都画出了东西'); R('still', '静止时画面不动'); R('spec', '五项资料与数据一致'); R('color', '每种颜色都真的换了'); R('doors', '车门能开能关'); R('interior', '能进车内、能回外观'); R('orbit', '能拖动转视角'); R('badge', '简化模型标记正确'); R('bytes', '单车页下载都 ≤14 MB');
  await page.context().close();
}

async function gDash(browser, sab) {
  const page = await newPage(browser, sab); const cars = CARS || [];
  const t = await open(page, '#/dashboard'); await sleep(800);
  if (t < 0) { rec('dash.ready', false, '10 秒内没就绪'); await page.context().close(); return; }
  await page.screenshot({ path: path.join(SHOT, 'dashboard.png') });
  const L = (await langOf(page)) === 'en' ? 'en' : 'zh';
  const rows = () => page.locator(tid('row')).evaluateAll(es => es.map(e => ({ id: e.dataset.id, status: e.dataset.status, text: e.innerText, est: [...e.querySelectorAll('[data-testid=est]')].some(x => { const r = x.getBoundingClientRect(), cs = getComputedStyle(x); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none'; }) })));
  const got = await rows(), bad = [], eb = [];
  for (const c of cars) {
    const r = got.find(x => x.id === c.id); if (!r) { bad.push(`${c.id} 没有这一行`); continue; }
    const d = digits(r.text), m = [];
    if (!r.text.includes(c.name[L])) m.push('车名'); if (!r.text.includes(c.designer[L])) m.push('设计师'); if (!d.includes(String(c.unveilYear))) m.push('年份');
    if (c.price.usd !== null && !d.includes(String(c.price.usd))) m.push('价格'); if (r.status !== c.status) m.push('状态'); if (c.sales.kind !== 'none' && !d.includes(String(c.sales.units))) m.push('销量');
    if (m.length) bad.push(`${c.id} ${m.join('/')}`);
    if ((c.sales.kind === 'estimate') !== r.est) eb.push(`${c.id} ${c.sales.kind === 'estimate' ? '缺' : '多'}估算标记`);
  }
  rec('dash.rows', cars.length > 0 && bad.length === 0, bad.length ? list(bad) : `${got.length} 行与数据一致`);
  rec('dash.est', cars.length > 0 && eb.length === 0, eb.length ? list(eb) : '估算的数都标了「估算」');
  const k = async id => digits(await txt(page, tid(id)));
  const sum = cars.reduce((s, c) => s + (c.sales.units || 0), 0), kp = [];
  if (!new RegExp(`(^|\\D)${cars.length}(\\D|$)`).test(await k('kpi-models'))) kp.push('车型总数');
  if (!new RegExp(`(^|\\D)${cars.filter(c => c.status === 'production').length}(\\D|$)`).test(await k('kpi-production'))) kp.push('在产数');
  if (!new RegExp(`(^|\\D)${cars.filter(c => c.status === 'discontinued').length}(\\D|$)`).test(await k('kpi-discontinued'))) kp.push('停产数');
  if (!(await k('kpi-sales')).includes(String(sum))) kp.push(`销量合计（应为 ${sum}）`);
  rec('dash.kpi', cars.length > 0 && kp.length === 0, kp.length ? '不对：' + kp.join('、') : '四个总览数字正确');
  const val = { year: c => c.unveilYear, price: c => c.price.usd, sales: c => c.sales.units }, sb = [];
  for (const key of Object.keys(val)) for (const dir of [-1, 1]) {
    try { await clickT(page, 'sort', `[data-key="${key}"]`, 500); } catch (e) { sb.push(`${key} 点不了`); break; }
    const ids = (await rows()).map(r => r.id), vs = ids.map(id => { const c = cars.find(x => x.id === id); return c ? val[key](c) : null; });
    const nn = vs.filter(v => v != null); if (vs.slice(nn.length).some(v => v != null)) { sb.push(`${key} 没数的没排最后`); break; }
    if (nn.some((v, i) => i && (v - nn[i - 1]) * dir < 0)) { sb.push(`${key} ${dir < 0 ? '从大到小' : '从小到大'}顺序不对`); break; }
  }
  rec('dash.sort', cars.length > 0 && sb.length === 0, sb.length ? list(sb) : '三项排序正确');
  const ch = await page.locator(tid('chart')).evaluateAll(es => es.filter(e => { const r = e.getBoundingClientRect(); return r.width >= 240 && r.height >= 120 && e.querySelector('svg,canvas'); }).length);
  rec('dash.chart', ch >= 2, `合格图表 ${ch} 个（≥2）`);
  await page.context().close();
}

async function gPrefs(browser, sab) {
  const cars = CARS || [], c0 = cars[0];
  // 语言
  let page = await newPage(browser, sab);
  try {
    await open(page, '#/dashboard'); await sleep(600); const l0 = await langOf(page);
    await clickT(page, 'lang', '', 600); const l1 = await langOf(page); const t1 = await txt(page, tid('row'));
    await page.reload(); await sleep(1500); const l2 = await langOf(page);
    await clickT(page, 'lang', '', 600); const l3 = await langOf(page); const t3 = await txt(page, tid('row'));
    const ok = l0 === 'zh-CN' && l1 === 'en' && l2 === 'en' && l3 === 'zh-CN' && !!c0 && cars.some(c => t1.includes(c.designer.en)) && cars.some(c => t3.includes(c.designer.zh));
    rec('prefs.lang', ok, `默认 ${l0}，切换→${l1}，刷新后 ${l2}，再切→${l3}；表格文字${ok ? '' : '没'}跟着换`);
  } catch (e) { rec('prefs.lang', false, e.message.slice(0, 80)); }
  await page.context().close();
  // 主题
  const look = p => p.evaluate(() => {
    const rgb = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const v = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { c: v.slice(0, 3), a: v.length > 3 ? v[3] : 1 }; };
    const bgOf = e => { for (; e; e = e.parentElement) { const b = rgb(getComputedStyle(e).backgroundColor); if (b && b.a > 0.5) return b.c; } return [255, 255, 255]; };
    const lum = c => { const f = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
    const row = document.querySelector('[data-testid=row]') || document.body, bg = bgOf(document.body), rb = bgOf(row), fg = (rgb(getComputedStyle(row).color) || { c: [0, 0, 0] }).c;
    const a = lum(fg), b = lum(rb); return { theme: document.documentElement.dataset.theme, bg: lum(bg), contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
  });
  const good = (s, th) => s.theme === th && (th === 'dark' ? s.bg <= 0.12 : s.bg >= 0.85) && s.contrast >= 4.5;
  const fmt = s => `${s.theme} 底色亮度 ${s.bg.toFixed(2)} 对比度 ${s.contrast.toFixed(1)}`;
  try {
    const out = []; let ok = true;
    for (const sys of ['dark', 'light']) {
      page = await newPage(browser, sab, { width: 1440, height: 900 }, sys);
      await open(page, '#/dashboard'); await sleep(600); const s0 = await look(page);
      const other = sys === 'dark' ? 'light' : 'dark';
      await clickT(page, 'theme', '', 700); const s1 = await look(page);
      await page.reload(); await sleep(1500); const s2 = await look(page);
      if (sys === 'dark') await page.screenshot({ path: path.join(SHOT, 'dashboard-light.png') });
      ok = ok && good(s0, sys) && good(s1, other) && good(s2, other);
      out.push(`系统${sys === 'dark' ? '深' : '浅'}色：默认 ${fmt(s0)}；切换后 ${fmt(s1)}；刷新后 ${s2.theme}`);
      await page.context().close();
    }
    rec('prefs.theme', ok, out.join(' ｜ '));
  } catch (e) { rec('prefs.theme', false, e.message.slice(0, 80)); try { await page.context().close(); } catch (x) { } }
}

async function gCredits(browser, sab) {
  const page = await newPage(browser, sab); const cars = CARS || [];
  try {
    const t = await open(page, '#/credits'); await sleep(600);
    const got = await page.locator(tid('credit')).evaluateAll(es => es.map(e => ({ id: e.dataset.id, text: e.innerText, links: [...e.querySelectorAll('a')].map(a => a.href) })));
    const bad = [];
    for (const c of cars) {
      const g = got.find(x => x.id === c.id); if (!g) { bad.push(`${c.id} 没有署名条目`); continue; }
      for (const s of (c.model.origin === 'community' ? c.model.sources : [])) if (!g.text.includes(s.author) || !g.text.includes(s.license) || !g.links.includes(s.url)) bad.push(`${c.id} 缺作者/许可/链接`);
    }
    rec('credits', t >= 0 && cars.length > 0 && bad.length === 0, t < 0 ? '10 秒内没就绪' : bad.length ? list(bad) : `${got.length} 条署名齐全`);
  } catch (e) { rec('credits', false, e.message.slice(0, 80)); }
  await page.context().close();
}

async function gPerf(browser, sab) {
  const page = await newPage(browser, sab);
  try {
    const t = await open(page, '#/car/model-y', urlArg ? 20000 : 10000); await sleep(1500);
    const p = await canvasPoint(page); if (t < 0 || !p) { rec('perf.orbit', false, t < 0 ? 'model-y 没就绪' : '画布被挡'); await page.context().close(); return; }
    const t0 = await page.evaluate(() => performance.now());
    await page.mouse.move(p.x - 150, p.y); await page.mouse.down();
    for (let i = 0; i < 180; i++) { await page.mouse.move(p.x - 150 + 300 * (0.5 - 0.5 * Math.cos(i / 30)), p.y + 20 * Math.sin(i / 20)); await sleep(16); }
    await page.mouse.up();
    const s = await page.evaluate(t0 => window.__probe.stats(t0, performance.now()), t0);
    rec('perf.orbit', s.n > 60 && s.p95 <= 40 && s.slow <= 6, `转视角 ${s.n} 帧，p95 ${s.p95.toFixed(1)} ms（≤40），超 50ms 的 ${s.slow} 帧（≤6）`);
  } catch (e) { rec('perf.orbit', false, e.message.slice(0, 80)); }
  await page.context().close();
}

async function gLayout(browser, sab) {
  const routes = ['#/', '#/car/model-3', '#/dashboard', '#/credits'], P = [], dup = [], dis = [];
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
    const page = await newPage(browser, sab, vp);
    for (const r of routes) {
      try {
        await open(page, r); await sleep(900);
        const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
        if (sw[0] > sw[1] + 1) P.push(`${vp.width} ${r} 横向滚动 ${sw[0]}>${sw[1]}`);
        const d = await page.evaluate(L => { const c = {}; document.querySelectorAll('[data-testid]').forEach(e => { c[e.dataset.testid] = (c[e.dataset.testid] || 0) + 1; }); return Object.entries(c).filter(([k, v]) => v > 1 && !L.includes(k)).map(([k]) => k); }, LIST_IDS);
        if (d.length) dup.push(`${r}：${d.join(',')}`);
        if (vp.width === 1440) {
          const zh = await page.locator(tid('disclaimer')).first().textContent({ timeout: 2000 }).catch(() => '') || '';
          let en = ''; try { await clickT(page, 'lang', '', 400); en = await page.locator(tid('disclaimer')).first().textContent({ timeout: 2000 }) || ''; await clickT(page, 'lang', '', 300); } catch (e) { }
          if (zh.trim().length < 20 || !zh.includes('非官方') || !/unofficial/i.test(en)) dis.push(r);
        }
      } catch (e) { P.push(`${vp.width} ${r} ${e.message.slice(0, 60)}`); }
    }
    if (vp.width === 390) {
      try {
        await open(page, '#/car/model-3'); await sleep(900); await page.screenshot({ path: path.join(SHOT, 'car-390.png') });
        for (const s of [tid('doors'), tid('color')]) {
          const ok = await page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) return false; const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === e || e.contains(h)); }, s);
          if (!ok) P.push(`390 宽 ${s} 看不全或被挡`);
        }
        const area = await page.evaluate(() => { const c = document.querySelector('[data-testid=canvas]'); if (!c) return 0; let n = 0, k = 0; for (let x = 5; x < innerWidth; x += 10) for (let y = 5; y < innerHeight; y += 10) { k++; if (document.elementFromPoint(x, y) === c) n++; } return n / k; });
        if (area < 0.3) P.push(`390 宽画布可见 ${(area * 100).toFixed(0)}% < 30%`);
      } catch (e) { P.push('390 单车页 ' + e.message.slice(0, 60)); }
    }
    await page.context().close();
  }
  rec('layout.hscroll', P.length === 0, P.length ? list(P) : '3 种宽度 × 4 个页面都不横向滚动，390 宽单车页可用');
  rec('layout.testid', dup.length === 0, dup.length ? '重复 testid：' + list(dup, 4) : 'testid 都唯一');
  rec('disclaimer', dis.length === 0, dis.length ? '这些页面缺中英文「非官方」声明：' + dis.join(' ') : '每页都有中英文非官方声明');
}

async function gOnline() {
  const files = ['data/cars.json', ...(CARS || []).map(c => c.model && c.model.file).filter(Boolean)], bad = [];
  for (const f of files) {
    try { const r = await fetch(`${BASE}${f}?t=${Date.now()}`); const b = Buffer.from(await r.arrayBuffer()); const l = fs.readFileSync(path.join(ROOT, f)); if (r.status !== 200 || !b.equals(l)) bad.push(`${f} 线上 ${r.status}/${b.length} 字节，本地 ${l.length}`); }
    catch (e) { bad.push(`${f} ${e.message.slice(0, 50)}`); }
  }
  rec('online.same', files.length > 1 && bad.length === 0, bad.length ? list(bad, 4) : `${files.length} 个文件线上与本地逐字节相同`);
}

// ───── 主流程 ─────
async function runAll(sab = {}, groups = null) {
  results = []; G.errors = []; G.external = []; G.dialogs = []; CARS = readCars() || [];
  if (!Array.isArray(CARS)) CARS = [];
  CARS = CARS.filter(c => c && typeof c === 'object');
  const on = g => (!groups || groups.includes(g)) && want(g);
  fs.mkdirSync(SHOT, { recursive: true });
  let srv = null;
  if (urlArg) { BASE = urlArg.endsWith('/') ? urlArg : urlArg + '/'; HOST = new URL(BASE).host; }
  else { srv = await serve(); BASE = `http://127.0.0.1:${srv.address().port}${SUB}`; HOST = `127.0.0.1:${srv.address().port}`; }
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const usable = CARS.length > 0 && CARS.every(c => schemaProblems(c).length === 0);
  const G_ = [['data', (b, s) => gData(s)], ['sources', gSources], ['home', gHome], ['car', gCar], ['dash', gDash], ['prefs', gPrefs], ['credits', gCredits], ['perf', gPerf], ['layout', gLayout]];
  for (const [name, fn] of G_) {
    if (!on(name)) continue;
    if (name === 'sources' && urlArg) continue;
    if (name === 'data' && urlArg) await gOnline();
    if (name !== 'data' && !usable) { rec(name + '.skip', false, 'data/cars.json 不合格（见 data.schema），这一组没法考'); continue; }
    try { await fn(browser, sab); } catch (e) { rec(name + '.crash', false, e.message.slice(0, 150)); }
  }
  const PAGE_GROUPS = ['home', 'car', 'dash', 'prefs', 'credits', 'perf', 'layout'];
  if (!usable) rec('pages', false, '没有任何页面被考到');
  else if (PAGE_GROUPS.some(on)) {
    rec('console', G.errors.length === 0, G.errors.length ? `${G.errors.length} 条报错：` + G.errors.slice(0, 3).join(' | ') : '控制台无报错');
    rec('net.external', G.external.length === 0, G.external.length ? '请求了外域：' + [...new Set(G.external)].slice(0, 3).join(' | ') : '没有外域请求');
    rec('dialog', G.dialogs.length === 0, G.dialogs.length ? '弹了原生对话框 ' + G.dialogs.join(',') : '没有原生对话框');
  }
  await browser.close(); if (srv) srv.close();
  return results;
}

if (textArg) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });
  const r = await pageText(await ctx.newPage(), textArg);
  console.log(`状态 ${r.status || r.err}，${r.text.length} 字\n` + r.text);
  await browser.close(); process.exit(r.status === 200 ? 0 : 1);
}
const watchdog = setTimeout(() => { console.log('FAIL watchdog 判卷超时（正常 40 分钟 / --prove 120 分钟），强制退出'); process.exit(PROVE ? 2 : 1); }, (PROVE ? 120 : 40) * 60000);
if (!PROVE) {
  const r = await runAll();
  const f = r.filter(x => !x.ok);
  console.log(`\n${r.length - f.length}/${r.length} PASS${f.length ? '，FAIL：' + f.map(x => x.id).join(' ') : ''}`);
  clearTimeout(watchdog); process.exit(f.length ? 1 : 0);
} else {
  const SABS = [
    ['freeze', ['car'], ['car.color', 'car.doors', 'car.orbit'], '画面冻结'],
    ['nocolor', ['car'], ['car.color'], '颜色按钮失灵'],
    ['nodoor', ['car'], ['car.doors'], '开门按钮失灵'],
    ['noview', ['car'], ['car.interior'], '看内饰按钮失灵'],
    ['noorbit', ['car'], ['car.orbit'], '画布收不到拖动'],
    ['jank', ['perf'], ['perf.orbit'], '每帧卡 45ms'],
    ['dimlie', ['data'], ['model.scale'], '官方车长虚报 10%'],
    ['factlie', ['sources'], ['src.price'], '改一个价格 +7 美元'],
    ['noest', ['dash'], ['dash.est'], '藏掉「估算」标记'],
    ['nosort', ['dash'], ['dash.sort'], '排序按钮失灵'],
    ['nolang', ['prefs'], ['prefs.lang'], '语言切换失灵'],
    ['notheme', ['prefs'], ['prefs.theme'], '深浅色切换失灵'],
    ['ext', ['home'], ['net.external'], '偷偷请求外域'],
    ['cerr', ['home'], ['console'], '控制台报错'],
    ['hscroll', ['layout'], ['layout.hscroll'], '页面撑出横向滚动'],
  ];
  let miss = 0;
  for (const [k, groups, ids, name] of SABS) {
    const r = await runAll({ [k]: true }, groups);
    const caught = r.filter(x => ids.includes(x.id) && !x.ok);
    console.log(`\n>>> 破坏「${name}」${caught.length ? '被抓到：' + caught.map(x => x.id).join(',') : '没被抓到！'}\n`);
    if (!caught.length) miss++;
  }
  console.log(miss ? `\n反向验证：${miss} 种破坏没被抓到 → 退出码 2` : `\n反向验证：${SABS.length} 种破坏全部被抓到 → 退出码 1`);
  clearTimeout(watchdog); process.exit(miss ? 2 : 1);
}
