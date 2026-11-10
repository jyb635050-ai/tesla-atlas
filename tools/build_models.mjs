// 自建简化车模生成器：按侧面轮廓 + 俯视轮廓放样出车身，切出车门、车窗、轮拱，配车轮和内饰，直接写 .glb。
// 用法：node tools/build_models.mjs [id …]   不带 id＝生成所有 models/meta.json 里没标 community 的车
// 坐标：X 朝车头、Y 朝上、Z 朝右（左侧车门在 -Z），单位米；静止姿态车门全关。尺寸读 data/cars.json 的 dims（没有官方数据的用 FALLBACK）。
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FALLBACK = { 'roadster-next': [4.45, 2.0, 1.14], robovan: [5.6, 2.2, 2.3], cyberquad: [1.95, 1.2, 1.12] };

// ───── 小工具 ─────
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function curve(pts, smooth = true) { // 分段插值；smooth＝单调三次（不过冲）
  return x => {
    if (x <= pts[0][0]) return pts[0][1]; const n = pts.length - 1; if (x >= pts[n][0]) return pts[n][1];
    let i = 0; while (x > pts[i + 1][0]) i++;
    const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
    return lerp(pts[i][1], pts[i + 1][1], smooth ? t * t * (3 - 2 * t) : t);
  };
}
class Geo { // 一种材质的一堆三角面
  constructor() { this.P = []; this.I = []; }
  v(x, y, z) { this.P.push(x, y, z); return this.P.length / 3 - 1; }
  tri(a, b, c) { this.I.push(a, b, c); }
  quad(a, b, c, d) { this.I.push(a, b, c, a, c, d); }
  get tris() { return this.I.length / 3; }
}
class Part { // 一个节点：按材质分组的几何
  constructor(name, origin = [0, 0, 0], extras = null) { this.name = name; this.o = origin; this.extras = extras; this.g = {}; }
  geo(mat) { return this.g[mat] || (this.g[mat] = new Geo()); }
  box(mat, cx, cy, cz, sx, sy, sz, n = 2) { // 细分方盒
    const g = this.geo(mat), F = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]], S = [sx / 2, sy / 2, sz / 2], C = [cx, cy, cz];
    for (const [nn, u, w] of F) {
      const id = [];
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const a = i / n * 2 - 1, b = j / n * 2 - 1; id.push(g.v(...[0, 1, 2].map(k => (nn[k] + u[k] * a + w[k] * b) * S[k] + C[k]))); }
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const p = i * (n + 1) + j; g.quad(id[p], id[p + n + 1], id[p + n + 2], id[p + 1]); }
    }
  }
  cyl(mat, cx, cy, cz, r, w, seg = 24, axis = 'z', r0 = 0) { // 圆柱（轮胎、方向盘柱等），r0>0 则两端是圆环
    const g = this.geo(mat), ring = (s, rr) => { const o = []; for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2, u = Math.cos(a) * rr, v = Math.sin(a) * rr; o.push(axis === 'z' ? g.v(cx + u, cy + v, cz + s * w / 2) : axis === 'x' ? g.v(cx + s * w / 2, cy + u, cz + v) : g.v(cx + u, cy + s * w / 2, cz + v)); } return o; };
    const a = ring(-1, r), b = ring(1, r);
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; g.quad(a[i], a[j], b[j], b[i]); }
    for (const [rg, s] of [[ring(-1, r), -1], [ring(1, r), 1]]) {
      if (r0 > 0) { const inner = ring(s, r0); for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; s > 0 ? g.quad(rg[i], rg[j], inner[j], inner[i]) : g.quad(rg[j], rg[i], inner[i], inner[j]); } }
      else { const c = axis === 'z' ? g.v(cx, cy, cz + s * w / 2) : axis === 'x' ? g.v(cx + s * w / 2, cy, cz) : g.v(cx, cy + s * w / 2, cz); for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; s > 0 ? g.tri(c, rg[i], rg[j]) : g.tri(c, rg[j], rg[i]); } }
    }
  }
}

// ───── 材质 ─────
const MATS = {
  paint_body: { pbrMetallicRoughness: { baseColorFactor: [0.9, 0.9, 0.9, 1], metallicFactor: 0.5, roughnessFactor: 0.4 }, doubleSided: true },
  glass: { pbrMetallicRoughness: { baseColorFactor: [0.02, 0.025, 0.03, 0.62], metallicFactor: 0.2, roughnessFactor: 0.05 }, alphaMode: 'BLEND', doubleSided: true },
  trim: { pbrMetallicRoughness: { baseColorFactor: [0.035, 0.035, 0.04, 1], metallicFactor: 0.1, roughnessFactor: 0.7 }, doubleSided: true },
  tire: { pbrMetallicRoughness: { baseColorFactor: [0.02, 0.02, 0.02, 1], metallicFactor: 0, roughnessFactor: 0.9 } },
  rim: { pbrMetallicRoughness: { baseColorFactor: [0.55, 0.56, 0.58, 1], metallicFactor: 0.9, roughnessFactor: 0.3 } },
  light: { pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.3 }, emissiveFactor: [0.9, 0.92, 1] },
  tail: { pbrMetallicRoughness: { baseColorFactor: [0.6, 0.02, 0.02, 1], metallicFactor: 0, roughnessFactor: 0.3 }, emissiveFactor: [0.75, 0.03, 0.03] },
  seat: { pbrMetallicRoughness: { baseColorFactor: [0.86, 0.85, 0.83, 1], metallicFactor: 0, roughnessFactor: 0.75 } },
  seat_dark: { pbrMetallicRoughness: { baseColorFactor: [0.08, 0.08, 0.09, 1], metallicFactor: 0, roughnessFactor: 0.8 } },
  dash: { pbrMetallicRoughness: { baseColorFactor: [0.07, 0.07, 0.08, 1], metallicFactor: 0, roughnessFactor: 0.85 } },
  wood: { pbrMetallicRoughness: { baseColorFactor: [0.45, 0.3, 0.18, 1], metallicFactor: 0, roughnessFactor: 0.6 } },
  screen: { pbrMetallicRoughness: { baseColorFactor: [0.02, 0.03, 0.05, 1], metallicFactor: 0, roughnessFactor: 0.2 }, emissiveFactor: [0.05, 0.1, 0.17] },
  floor: { pbrMetallicRoughness: { baseColorFactor: [0.05, 0.05, 0.055, 1], metallicFactor: 0, roughnessFactor: 0.95 }, doubleSided: true },
};

// ───── 写 .glb ─────
function writeGlb(file, parts, flat, extraNodes = []) {
  const bufs = [], views = [], acc = [], meshes = [], nodes = [{ name: 'car', children: [] }], mats = [], mi = {}; let off = 0;
  const push = (ta, target) => { const b = Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength); views.push({ buffer: 0, byteOffset: off, byteLength: b.length, target }); bufs.push(b); off += b.length; const pad = (4 - off % 4) % 4; if (pad) { bufs.push(Buffer.alloc(pad)); off += pad; } return views.length - 1; };
  for (const p of parts) {
    const prims = [];
    for (const [mat, g0] of Object.entries(p.g)) {
      if (!g0.I.length) continue;
      let P, I;
      if (flat) { P = new Float32Array(g0.I.length * 3); I = null; g0.I.forEach((vi, k) => { for (let c = 0; c < 3; c++) P[k * 3 + c] = g0.P[vi * 3 + c] - p.o[c]; }); }
      else { P = new Float32Array(g0.P.length); for (let k = 0; k < P.length; k++) P[k] = g0.P[k] - p.o[k % 3]; I = g0.I; }
      const nv = P.length / 3, N = new Float32Array(P.length), idx = I || Array.from({ length: nv }, (_, k) => k);
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3], e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        for (const v of [a, b, c]) { N[v] += n[0]; N[v + 1] += n[1]; N[v + 2] += n[2]; }
      }
      for (let k = 0; k < N.length; k += 3) { const l = Math.hypot(N[k], N[k + 1], N[k + 2]) || 1; N[k] /= l; N[k + 1] /= l; N[k + 2] /= l; }
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let k = 0; k < P.length; k += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], P[k + c]); mx[c] = Math.max(mx[c], P[k + c]); }
      if (!(mat in mi)) { mi[mat] = mats.length; mats.push({ name: mat, ...MATS[mat] }); }
      const attr = { POSITION: acc.length, NORMAL: acc.length + 1 };
      acc.push({ bufferView: push(P, 34962), componentType: 5126, count: nv, type: 'VEC3', min: mn, max: mx });
      acc.push({ bufferView: push(N, 34962), componentType: 5126, count: nv, type: 'VEC3' });
      const prim = { attributes: attr, material: mi[mat] };
      if (I) { const big = nv > 65535, ta = big ? new Uint32Array(I) : new Uint16Array(I); prim.indices = acc.length; acc.push({ bufferView: push(ta, 34963), componentType: big ? 5125 : 5123, count: I.length, type: 'SCALAR' }); }
      prims.push(prim);
    }
    if (!prims.length) continue;
    meshes.push({ name: p.name, primitives: prims });
    nodes.push({ name: p.name, mesh: meshes.length - 1, translation: p.o, ...(p.extras ? { extras: p.extras } : {}) }); nodes[0].children.push(nodes.length - 1);
  }
  for (const n of extraNodes) { nodes.push(n); nodes[0].children.push(nodes.length - 1); }
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0', generator: 'TeslaAtlas build_models' }, scene: 0, scenes: [{ nodes: [0] }], nodes, meshes, materials: mats, accessors: acc, bufferViews: views, buffers: [{ byteLength: off }] }));
  const jp = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]), bin = Buffer.concat(bufs);
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + jp.length + 8 + bin.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(jp.length, 0); c1.writeUInt32LE(0x4E4F534A, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(file, Buffer.concat([h, c1, jp, c2, bin]));
}

// ───── 车身放样 ─────
// spec：top/belt/bot/plan 是 [车长比例 -0.5…0.5, 比例值] 折线（高度比例相对 H，plan 相对半宽）；
//   glass:{wb,rs,re,dk} 风挡根部/车顶起点/车顶终点/后窗终点（车长比例）；roofGlass；pillars:[比例…]；
//   wheels:[{f, r}]；doors:[{id, f0, f1, top?:true 含上半部分}]；tumble 车顶收窄；sharp 棱角车
function loft(sp, L, W, H, parts, x0f = -0.5, x1f = 0.5) {
  const sm = !sp.sharp, top = curve(sp.top, sm), belt = curve(sp.belt, sm), bot = curve(sp.bot, sm), plan = curve(sp.plan, sm);
  const NS = sp.sharp ? 72 : 110, SEG = { A: 5, B: 9, C: 7, D: 7 }, body = parts.body, hw = W / 2;
  const tum = sp.tumble ?? 0.74, gl = sp.glass, wheelsAt = (sp.wheels || []).map(w => ({ x: w.f * L, y: w.r, R: w.r * (w.arch ?? 1.16) }));
  const doorOf = (f, side) => (sp.doors || []).find(d => f >= d.f0 && f <= d.f1 && (d.side ? d.side === side : true) && d.id.endsWith(side > 0 ? 'r' : 'l'));
  const rings = [];
  for (let s = 0; s <= NS; s++) {
    const f = lerp(x0f, x1f, s / NS), x = f * L, w = hw * plan(f), yt = H * top(f), y0 = H * bot(f), yb = Math.min(H * belt(f), yt - 0.02), gh = yt - yb;
    const wr = gh > 0.1 ? w * lerp(1, tum, clamp((gh - 0.1) / 0.25, 0, 1)) : w * 0.97, pts = [];
    const rb = sp.sharp ? 0.02 : Math.min(0.12, (yb - y0) * 0.35), bulge = sp.sharp ? 0 : 0.012;
    for (let i = 0; i <= SEG.A; i++) { const t = i / SEG.A; pts.push([y0 + (t > 0.8 ? rb * 0.35 * (t - 0.8) / 0.2 : 0), (w - rb * 0.6) * t * 0.985, 'A']); }
    for (let i = 1; i <= SEG.B; i++) { const t = i / SEG.B; pts.push([lerp(y0 + rb * 0.35, yb, t), lerp(w - rb * 0.6, w, Math.min(1, t * 3)) - bulge * (1 - Math.sin(Math.PI * Math.min(1, t * 1.1))) , 'B']); }
    for (let i = 1; i <= SEG.C; i++) { const t = i / SEG.C, cr = sp.sharp ? 0 : 0.06; pts.push([lerp(yb, yt - cr * (gh > 0.1 ? 1 : 0.2), t), lerp(w, wr, t), 'C']); }
    for (let i = 1; i <= SEG.D; i++) { const t = i / SEG.D, cr = sp.sharp ? 0 : 0.06 * (gh > 0.1 ? 1 : 0.2); pts.push([yt - cr * (1 - Math.sin(t * Math.PI / 2)), wr * Math.cos(t * Math.PI / 2) ** (sp.sharp ? 1 : 0.8), 'D']); }
    if (sp.sharp) for (let i = pts.length - SEG.D; i < pts.length; i++) { const t = (i - (pts.length - SEG.D - 1)) / SEG.D; pts[i][1] = wr * (1 - t); pts[i][0] = yt; }
    rings.push({ f, x, pts });
  }
  const M = rings[0].pts.length, vid = new Map();
  const vert = (geo, key, s, i, side) => { const k = key + '|' + s + '|' + i + '|' + side; if (!vid.has(k)) { const r = rings[s], p = r.pts[i]; vid.set(k, geo.v(r.x, p[0], p[1] * side)); } return vid.get(k); };
  for (let s = 0; s < NS; s++) for (let i = 0; i < M - 1; i++) for (const side of [1, -1]) {
    const r0 = rings[s], r1 = rings[s + 1], f = (r0.f + r1.f) / 2, seg = r0.pts[i + 1][2], cy = (r0.pts[i][0] + r0.pts[i + 1][0] + r1.pts[i][0] + r1.pts[i + 1][0]) / 4, cx = (r0.x + r1.x) / 2;
    if ((seg === 'B' || (seg === 'A' && i >= SEG.A - 2)) && wheelsAt.some(w => Math.hypot(cx - w.x, cy - w.y) < w.R)) continue; // 轮拱开口
    let mat = 'paint_body', part = body;
    if (seg === 'A') mat = 'trim';
    else if (seg === 'C' && gl) { const frac = (i - SEG.A - SEG.B) / SEG.C; if (f > gl.dk + 0.035 && f < gl.wb - 0.03 && frac < 0.86 && !(sp.pillars || []).some(p => Math.abs(f - p) < 0.012)) mat = 'glass'; else if (frac >= 0.86 || true) mat = sp.sharp ? 'paint_body' : (f > gl.dk && f < gl.wb ? 'trim' : 'paint_body'); }
    else if (seg === 'D' && gl) { if (f < gl.wb && f > gl.rs) mat = 'glass'; else if (f <= gl.rs && f >= gl.re) mat = sp.roofGlass ? 'glass' : 'paint_body'; else if (f < gl.re && f > gl.dk) mat = sp.bed ? 'trim' : 'glass'; }
    if (seg === 'B' && sp.lights !== false) { const yn = cy / H; if (f > x1f - 0.035 && yn > (sp.lightY ?? 0.42) && yn < (sp.lightY ?? 0.42) + 0.07) mat = 'light'; if (f < x0f + 0.03 && yn > (sp.tailY ?? 0.5) && yn < (sp.tailY ?? 0.5) + 0.07) mat = 'tail'; }
    if (seg === 'B' || seg === 'C') { const d = doorOf(f, side); if (d && (seg === 'B' ? cy > H * (d.sill ?? bot(f) + 0.06) : true)) part = parts['door_' + d.id]; }
    if (seg === 'D' && sp.roofDoor) { const d = doorOf(f, side); if (d && d.roof) part = parts['door_' + d.id]; }
    const g = part.geo(mat), key = part.name + mat, a = vert(g, key, s, i, side), b = vert(g, key, s + 1, i, side), c = vert(g, key, s + 1, i + 1, side), d = vert(g, key, s, i + 1, side);
    side > 0 ? g.quad(a, d, c, b) : g.quad(a, b, c, d);
  }
  for (const [s, dir] of [[0, -1], [NS, 1]]) { // 两端封口
    const r = rings[s], g = body.geo(sp.capMat || 'paint_body'), c = g.v(r.x, (r.pts[0][0] + r.pts[M - 1][0]) / 2, 0);
    for (const side of [1, -1]) for (let i = 0; i < M - 1; i++) { const a = g.v(r.x, r.pts[i][0], r.pts[i][1] * side), b = g.v(r.x, r.pts[i + 1][0], r.pts[i + 1][1] * side); (dir * side > 0) ? g.tri(c, a, b) : g.tri(c, b, a); }
  }
  return { plan, belt, bot, top };
}
function wheels(parts, list, W, L, plan = null) {
  const p = parts.wheels;
  for (const w of list) for (const side of [1, -1]) {
    const tw = w.w ?? 0.24, z = side * (W / 2 - tw / 2 - (w.inset ?? 0.015)), x = w.f * L;
    if (plan && w.arch !== 0) { // 轮眉（半圆环）
      const g = p.geo('trim'), R1 = w.r * (w.arch ?? 1.16) + 0.075, R0 = w.r * 1.03, zb = side * (W / 2 * Math.max(plan(w.f - 0.09), plan(w.f), plan(w.f + 0.09)) + 0.012), n = 26, a0 = -0.25, a1 = Math.PI + 0.25; let pa = null, pb = null;
      for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n), ca = g.v(x + Math.cos(a) * R0, w.r + Math.sin(a) * R0, zb), cb = g.v(x + Math.cos(a) * R1, w.r + Math.sin(a) * R1, zb - side * 0.035); if (pa != null) side > 0 ? g.quad(pa, ca, cb, pb) : g.quad(pa, pb, cb, ca); pa = ca; pb = cb; }
    }
    p.cyl('tire', x, w.r, z, w.r, tw, 28, 'z', w.r * 0.66);
    p.cyl('rim', x, w.r, z + side * tw * 0.12, w.r * 0.67, tw * 0.5, 20, 'z');
    p.cyl('trim', x, w.r, z - side * (tw / 2 + 0.16), w.r * 0.97, 0.3, 16, 'z'); // 轮拱内衬
    if (w.dual) p.cyl('tire', x, w.r, z - side * (tw + 0.04), w.r, tw, 28, 'z', w.r * 0.66);
  }
}
// ───── 内饰 ─────
function interior(parts, o) { // o:{floorY, seats:[{x,z,w?}], bench:{x,w}, dashX, wheel:{x,z,yoke}, screen:{x,y,w,h}, mat, sideBenches}
  const p = parts.interior, m = o.mat || 'seat', fy = o.floorY, k = o.k ?? 1;
  p.box('floor', o.floorX ?? 0, fy - 0.02, 0, o.floorL, 0.04, o.floorW, 4);
  const seat = (x, z, w = 0.5) => { p.box(m, x, fy + 0.2 * k, z, 0.5, 0.12, w, 3); p.box(m, x - 0.28, fy + 0.5 * k, z, 0.12, 0.52 * k, w * 0.96, 3); p.box(m, x - 0.31, fy + 0.83 * k, z, 0.09, 0.16 * k, w * 0.5, 2); p.box('dash', x, fy + 0.07 * k, z, 0.42, 0.14 * k, w * 0.8, 1); };
  for (const s of o.seats || []) seat(s.x, s.z, s.w);
  if (o.bench) { p.box(m, o.bench.x, fy + 0.2 * k, 0, 0.5, 0.12, o.bench.w, 4); p.box(m, o.bench.x - 0.28, fy + 0.5 * k, 0, 0.12, 0.52 * k, o.bench.w, 4); }
  for (const b of o.sideBenches || []) { p.box(m, b.x, fy + 0.3, b.z, b.l, 0.14, 0.45, 4); p.box(m, b.x, fy + 0.62, b.z + Math.sign(b.z) * 0.2, b.l, 0.55, 0.1, 4); }
  if (o.dashX != null) { p.box('dash', o.dashX, fy + 0.56 * k, 0, 0.32, 0.18 * k, o.dashW, 4); p.box(o.dashTrim || 'wood', o.dashX - 0.165, fy + 0.6 * k, 0, 0.012, 0.045, o.dashW * 0.96, 2); p.box('dash', o.dashX - 0.35, fy + 0.18 * k, 0, 0.9, 0.2 * k, 0.26, 3); }
  if (o.wheel) { const { x, z, yoke } = o.wheel, y = fy + 0.66 * k; p.cyl('dash', x + 0.12, y - 0.03, z, 0.035, 0.26, 10, 'x'); if (yoke) { p.box('dash', x, y, z, 0.035, 0.05, 0.34, 2); p.box('dash', x, y - 0.07, z + 0.15, 0.035, 0.14, 0.045, 1); p.box('dash', x, y - 0.07, z - 0.15, 0.035, 0.14, 0.045, 1); } else p.cyl('dash', x, y, z, 0.185, 0.035, 24, 'x', 0.15); }
  if (o.screen) { const s = o.screen; p.box('dash', s.x + 0.012, s.y, s.z ?? 0, 0.02, s.h + 0.02, s.w + 0.02, 1); p.box('screen', s.x, s.y, s.z ?? 0, 0.012, s.h, s.w, 2); }
}

// ───── 各车参数 ─────
const sedan = { // Model 3 的基准轮廓
  top: [[-0.5, 0.52], [-0.475, 0.63], [-0.41, 0.705], [-0.33, 0.76], [-0.13, 0.975], [-0.02, 1], [0.09, 0.975], [0.255, 0.69], [0.38, 0.625], [0.465, 0.545], [0.5, 0.42]],
  belt: [[-0.5, 0.5], [-0.42, 0.665], [-0.1, 0.645], [0.26, 0.62], [0.42, 0.56], [0.5, 0.4]],
  bot: [[-0.5, 0.3], [-0.455, 0.125], [0.45, 0.115], [0.5, 0.27]],
  plan: [[-0.5, 0.76], [-0.455, 0.93], [-0.3, 1], [0.28, 1], [0.42, 0.95], [0.475, 0.86], [0.5, 0.66]],
  glass: { wb: 0.255, rs: 0.09, re: -0.13, dk: -0.33 }, roofGlass: true, pillars: [-0.035], tumble: 0.72,
  wheels: [{ f: 0.315, r: 0.335 }, { f: -0.297, r: 0.335 }],
  doors: [{ id: 'fl', f0: -0.03, f1: 0.2 }, { id: 'fr', f0: -0.03, f1: 0.2 }, { id: 'rl', f0: -0.225, f1: -0.04 }, { id: 'rr', f0: -0.225, f1: -0.04 }],
  cabin: { seats: [0.03, -0.17], dash: 0.2, lhd: true },
};
const SPECS = {
  'model-3': sedan,
  'model-s': { ...sedan, top: [[-0.5, 0.5], [-0.478, 0.61], [-0.42, 0.7], [-0.3, 0.8], [-0.12, 0.975], [-0.02, 1], [0.08, 0.975], [0.235, 0.7], [0.37, 0.635], [0.465, 0.555], [0.5, 0.42]], glass: { wb: 0.235, rs: 0.08, re: -0.12, dk: -0.36 }, wheels: [{ f: 0.31, r: 0.35 }, { f: -0.285, r: 0.35 }], tumble: 0.7, yoke: true },
  'model-y': { ...sedan, top: [[-0.5, 0.5], [-0.485, 0.66], [-0.44, 0.78], [-0.34, 0.9], [-0.15, 0.985], [-0.03, 1], [0.08, 0.98], [0.255, 0.66], [0.38, 0.59], [0.465, 0.51], [0.5, 0.39]], belt: [[-0.5, 0.48], [-0.43, 0.63], [-0.1, 0.6], [0.26, 0.575], [0.42, 0.52], [0.5, 0.37]], bot: [[-0.5, 0.28], [-0.455, 0.125], [0.45, 0.12], [0.5, 0.26]], glass: { wb: 0.255, rs: 0.08, re: -0.15, dk: -0.4 }, wheels: [{ f: 0.31, r: 0.36 }, { f: -0.295, r: 0.36 }], tumble: 0.76 },
  'model-x': { ...sedan, top: [[-0.5, 0.48], [-0.487, 0.64], [-0.445, 0.78], [-0.33, 0.93], [-0.15, 0.99], [-0.03, 1], [0.07, 0.985], [0.27, 0.64], [0.385, 0.575], [0.465, 0.5], [0.5, 0.38]], belt: [[-0.5, 0.46], [-0.43, 0.61], [-0.1, 0.585], [0.26, 0.56], [0.42, 0.505], [0.5, 0.36]], bot: [[-0.5, 0.27], [-0.455, 0.115], [0.45, 0.11], [0.5, 0.25]], glass: { wb: 0.27, rs: 0.02, re: -0.15, dk: -0.4 }, wheels: [{ f: 0.305, r: 0.375 }, { f: -0.285, r: 0.375 }], tumble: 0.76, falcon: true, yoke: true,
    doors: [{ id: 'fl', f0: -0.03, f1: 0.2 }, { id: 'fr', f0: -0.03, f1: 0.2 }, { id: 'rl', f0: -0.235, f1: -0.04, roof: true }, { id: 'rr', f0: -0.235, f1: -0.04, roof: true }], roofDoor: true, cabin: { seats: [0.03, -0.17], dash: 0.21, lhd: true } },
  'roadster-2008': { ...sedan, top: [[-0.5, 0.56], [-0.47, 0.72], [-0.38, 0.8], [-0.24, 0.84], [-0.17, 0.985], [-0.08, 1], [0, 0.985], [0.16, 0.7], [0.3, 0.62], [0.44, 0.5], [0.5, 0.36]], belt: [[-0.5, 0.54], [-0.4, 0.74], [-0.1, 0.69], [0.18, 0.66], [0.4, 0.54], [0.5, 0.36]], bot: [[-0.5, 0.33], [-0.45, 0.12], [0.44, 0.11], [0.5, 0.24]], plan: [[-0.5, 0.74], [-0.45, 0.94], [-0.28, 1], [0.24, 1], [0.4, 0.93], [0.47, 0.8], [0.5, 0.56]],
    glass: { wb: 0.16, rs: 0, re: -0.17, dk: -0.24 }, roofGlass: false, pillars: [], tumble: 0.7, wheels: [{ f: 0.3, r: 0.31 }, { f: -0.295, r: 0.325 }],
    doors: [{ id: 'fl', f0: -0.13, f1: 0.12 }, { id: 'fr', f0: -0.13, f1: 0.12 }], cabin: { seats: [-0.07], dash: 0.1, lhd: true, dark: true } },
  'roadster-next': { ...sedan, top: [[-0.5, 0.5], [-0.475, 0.66], [-0.4, 0.78], [-0.25, 0.9], [-0.1, 0.99], [-0.02, 1], [0.07, 0.97], [0.24, 0.66], [0.37, 0.58], [0.46, 0.48], [0.5, 0.34]], belt: [[-0.5, 0.5], [-0.4, 0.71], [-0.1, 0.67], [0.24, 0.63], [0.4, 0.52], [0.5, 0.34]], bot: [[-0.5, 0.3], [-0.45, 0.1], [0.44, 0.09], [0.5, 0.22]], plan: [[-0.5, 0.72], [-0.45, 0.95], [-0.3, 1], [0.24, 0.98], [0.4, 0.92], [0.47, 0.78], [0.5, 0.52]],
    glass: { wb: 0.24, rs: 0.07, re: -0.1, dk: -0.36 }, pillars: [], tumble: 0.66, wheels: [{ f: 0.325, r: 0.345 }, { f: -0.31, r: 0.355 }],
    doors: [{ id: 'fl', f0: -0.1, f1: 0.19 }, { id: 'fr', f0: -0.1, f1: 0.19 }], butterfly: true, cabin: { seats: [-0.02], dash: 0.18, lhd: true, dark: true, yoke: true } },
  cybercab: { ...sedan, top: [[-0.5, 0.58], [-0.485, 0.7], [-0.43, 0.8], [-0.28, 0.93], [-0.1, 0.995], [-0.02, 1], [0.08, 0.97], [0.27, 0.66], [0.39, 0.58], [0.47, 0.5], [0.5, 0.4]], belt: [[-0.5, 0.56], [-0.42, 0.69], [-0.1, 0.65], [0.27, 0.61], [0.42, 0.53], [0.5, 0.4]], bot: [[-0.5, 0.3], [-0.455, 0.11], [0.45, 0.11], [0.5, 0.27]],
    glass: { wb: 0.27, rs: 0.08, re: -0.1, dk: -0.3 }, roofGlass: false, pillars: [], tumble: 0.72, wheels: [{ f: 0.31, r: 0.35, arch: 1.1 }, { f: -0.3, r: 0.35, arch: 1.05 }],
    doors: [{ id: 'fl', f0: -0.17, f1: 0.2 }, { id: 'fr', f0: -0.17, f1: 0.2 }], butterfly: true, lightY: 0.5, tailY: 0.56, cabin: { seats: [-0.07], dash: 0.2, lhd: false, noWheel: true, bigScreen: true } },
  cybertruck: { sharp: true, top: [[-0.5, 0.63], [-0.485, 0.665], [0.03, 1], [0.375, 0.6], [0.485, 0.565], [0.5, 0.47]], belt: [[-0.5, 0.63], [0.03, 0.66], [0.375, 0.595], [0.5, 0.47]], bot: [[-0.5, 0.33], [-0.47, 0.2], [0.46, 0.2], [0.5, 0.36]],
    plan: [[-0.5, 0.97], [-0.3, 1], [0.3, 1], [0.47, 0.97], [0.5, 0.9]], glass: { wb: 0.375, rs: 0.03, re: 0.03, dk: -0.13 }, bed: true, pillars: [0.085], tumble: 0.8,
    wheels: [{ f: 0.335, r: 0.44, w: 0.3, arch: 1.2 }, { f: -0.305, r: 0.44, w: 0.3, arch: 1.2 }], lightY: 0.53, tailY: 0.55,
    doors: [{ id: 'fl', f0: 0.085, f1: 0.26 }, { id: 'fr', f0: 0.085, f1: 0.26 }, { id: 'rl', f0: -0.09, f1: 0.075 }, { id: 'rr', f0: -0.09, f1: 0.075 }], cabin: { seats: [0.13, -0.05], dash: 0.27, lhd: true, yoke: true, dark: true } },
  robovan: { top: [[-0.5, 0.5], [-0.47, 0.86], [-0.4, 0.985], [-0.2, 1], [0.2, 1], [0.4, 0.985], [0.47, 0.86], [0.5, 0.5]], belt: [[-0.5, 0.42], [-0.44, 0.47], [0.44, 0.47], [0.5, 0.42]], bot: [[-0.5, 0.12], [-0.46, 0.035], [0.46, 0.035], [0.5, 0.12]],
    plan: [[-0.5, 0.8], [-0.46, 0.95], [-0.36, 1], [0.36, 1], [0.46, 0.95], [0.5, 0.8]], glass: { wb: 0.4, rs: 0.4, re: -0.4, dk: -0.4 }, roofGlass: false, pillars: [-0.2, 0.2], tumble: 0.9,
    wheels: [], lightY: 0.5, tailY: 0.5, doors: [{ id: 'sl', f0: -0.15, f1: 0.15 }, { id: 'sr', f0: -0.15, f1: 0.15 }], slide: true, van: true },
};

function buildCar(c) {
  const [L, W, H] = c.dims ? [c.dims.l / 1000, c.dims.w / 1000, c.dims.h / 1000] : FALLBACK[c.id];
  const parts = { body: new Part('body'), wheels: new Part('wheels'), interior: new Part('interior') }, extra = [];
  let flat = false;
  if (c.id === 'semi') return buildSemi(c, L, W, H);
  if (c.id === 'cyberquad') return buildQuad(c, L, W, H);
  const sp = SPECS[c.id]; flat = !!sp.sharp;
  const tmpPlan = curve(sp.plan), tmpBelt = curve(sp.belt);
  for (const d of sp.doors) { // 车门节点：原点放在铰链上
    const side = d.id.endsWith('l') ? -1 : 1, hx = d.f1 * L, hz = side * (W / 2) * tmpPlan(d.f1), hy = H * tmpBelt(d.f1);
    let origin = [hx, hy, hz], ex = null;
    if (sp.slide) ex = { slide: [-(d.f1 - d.f0) * L * 0.98, 0, side * 0.12] };
    else if (sp.falcon && d.roof) { origin = [(d.f0 + d.f1) / 2 * L, H * 0.985, side * 0.08]; ex = { axis: [1, 0, 0], angle: -side * 1.25 }; }
    else if (sp.butterfly) { const a = [0.42, 0.8, -side * 0.2]; ex = { axis: a, angle: side * 1.05 }; }
    else ex = { axis: [0, 1, 0], angle: side * 1.15 };
    parts['door_' + d.id] = new Part('door_' + d.id, origin, ex);
  }
  loft(sp, L, W, H, parts);
  wheels(parts, sp.wheels, W, L, curve(sp.plan));
  const fy = H * 0.14 + 0.06;
  if (sp.van) {
    interior(parts, { floorY: fy, floorL: L * 0.84, floorW: W * 0.84, mat: 'seat', sideBenches: [{ x: 0, z: W * 0.3, l: L * 0.26 }, { x: 0, z: -W * 0.3, l: L * 0.26 }, { x: L * 0.31, z: W * 0.3, l: L * 0.2 }, { x: L * 0.31, z: -W * 0.3, l: L * 0.2 }, { x: -L * 0.31, z: W * 0.3, l: L * 0.2 }, { x: -L * 0.31, z: -W * 0.3, l: L * 0.2 }], screen: { x: L * 0.4, y: fy + 1.5, w: 0.9, h: 0.3 } });
    extra.push({ name: 'cam_interior', translation: [-L * 0.3, fy + 1.25, 0] });
  } else {
    const cb = sp.cabin, zs = W * 0.2, seats = [];
    cb.seats.forEach((f, i) => { if (i === 0) seats.push({ x: f * L, z: zs }, { x: f * L, z: -zs }); });
    const dz = cb.lhd ? -zs : 0; // 车头朝 +X 时，左侧是 -Z
    const k = clamp((H - fy - 0.1) / 1.08, 0.62, 1);
    interior(parts, { k, floorY: fy, floorX: (cb.dash + (cb.seats.at(-1) ?? 0)) / 2 * L - 0.2, floorL: (cb.dash - cb.seats.at(-1)) * L + 1.3, floorW: W * 0.8, mat: cb.dark ? 'seat_dark' : 'seat', seats,
      bench: cb.seats.length > 1 ? { x: cb.seats[1] * L, w: W * 0.66 } : null, dashX: cb.dash * L + 0.12, dashW: W * 0.74, dashTrim: cb.dark ? 'dash' : 'wood',
      wheel: cb.noWheel ? null : { x: cb.dash * L - 0.2, z: dz, yoke: sp.yoke || cb.yoke }, screen: cb.bigScreen ? { x: cb.dash * L - 0.07, y: fy + 0.72 * k, w: 0.52, h: 0.28 * k } : { x: cb.dash * L - 0.08, y: fy + 0.7 * k, w: 0.36, h: 0.22 * k } });
    extra.push({ name: 'cam_interior', translation: [cb.seats[0] * L - 0.72, fy + 0.86 * k, 0] });
  }
  return { parts: Object.values(parts), flat, extra, dims: [L, W, H] };
}
function buildSemi(c, L, W, H) {
  const sp = { top: [[-0.06, 0.93], [-0.02, 0.985], [0.08, 1], [0.2, 0.985], [0.33, 0.83], [0.43, 0.58], [0.485, 0.42], [0.5, 0.3]], belt: [[-0.06, 0.5], [0.3, 0.5], [0.44, 0.42], [0.5, 0.3]], bot: [[-0.06, 0.1], [0.46, 0.1], [0.5, 0.17]],
    plan: [[-0.06, 0.93], [0.1, 0.93], [0.36, 0.84], [0.47, 0.7], [0.5, 0.52]], glass: { wb: 0.43, rs: 0.3, re: -0.2, dk: -0.2 }, roofGlass: false, pillars: [0.11], tumble: 0.8,
    wheels: [{ f: 0.335, r: 0.52, arch: 1.14 }], lightY: 0.3, lights: true, tailY: 2, doors: [{ id: 'fl', f0: 0.02, f1: 0.2, sill: 0.2 }, { id: 'fr', f0: 0.02, f1: 0.2, sill: 0.2 }], capMat: 'paint_body' };
  const parts = { body: new Part('body'), wheels: new Part('wheels'), interior: new Part('interior') }, pl = curve(sp.plan);
  for (const d of sp.doors) { const side = d.id.endsWith('l') ? -1 : 1; parts['door_' + d.id] = new Part('door_' + d.id, [d.f1 * L, H * 0.5, side * (W / 2) * pl(d.f1)], { axis: [0, 1, 0], angle: side * 1.2 }); }
  loft(sp, L, W, H, parts, -0.06, 0.5);
  const b = parts.body;
  b.box('trim', -L * 0.28, 0.82, 0, L * 0.45, 0.3, W * 0.36, 3); // 车架
  b.cyl('trim', -L * 0.33, 1.02, 0, 0.5, 0.1, 24, 'y'); // 鞍座
  for (const f of [-0.27, -0.405]) for (const s of [1, -1]) b.box('paint_body', f * L, 1.16, s * (W / 2 - 0.36), 1.16, 0.06, 0.7, 2); // 后轮挡泥板
  b.box('tail', -L * 0.498, 0.78, 0, 0.03, 0.1, W * 0.7, 1);
  wheels(parts, [{ f: 0.335, r: 0.52, w: 0.32, inset: 0.02 }, { f: -0.27, r: 0.52, w: 0.3, dual: true, inset: 0 }, { f: -0.405, r: 0.52, w: 0.3, dual: true, inset: 0 }], W, L);
  const fy = 1.25;
  interior(parts, { floorY: fy, floorX: L * 0.15, floorL: L * 0.42, floorW: W * 0.78, mat: 'seat_dark', seats: [{ x: L * 0.13, z: 0, w: 0.56 }], dashX: L * 0.3, dashW: W * 0.6, dashTrim: 'dash', wheel: { x: L * 0.3 - 0.3, z: 0 } });
  parts.interior.box('screen', L * 0.3 - 0.12, fy + 0.84, 0.42, 0.012, 0.24, 0.36, 2); parts.interior.box('screen', L * 0.3 - 0.12, fy + 0.84, -0.42, 0.012, 0.24, 0.36, 2);
  return { parts: Object.values(parts), flat: false, extra: [{ name: 'cam_interior', translation: [L * 0.13 - 0.5, fy + 1.15, 0] }], dims: [L, W, H] };
}
function buildQuad(c, L, W, H) {
  const sp = { sharp: true, lights: true, lightY: 0.62, tailY: 0.6, top: [[-0.5, 0.6], [-0.42, 0.7], [-0.1, 0.72], [0.08, 0.86], [0.3, 0.82], [0.46, 0.66], [0.5, 0.56]], belt: [[-0.5, 0.56], [0.1, 0.62], [0.5, 0.52]], bot: [[-0.5, 0.42], [-0.3, 0.3], [0.3, 0.3], [0.5, 0.44]],
    plan: [[-0.5, 0.36], [-0.2, 0.42], [0.1, 0.46], [0.38, 0.4], [0.5, 0.3]], tumble: 0.7, wheels: [], doors: [] };
  const parts = { body: new Part('body'), wheels: new Part('wheels') };
  loft(sp, L, W, H, parts, -0.42, 0.42);
  const b = parts.body, r = 0.3;
  b.box('seat_dark', -L * 0.14, H * 0.74, 0, L * 0.34, 0.09, W * 0.3, 2); // 座垫
  b.cyl('trim', L * 0.17, H * 0.955, 0, 0.022, W * 0.62, 10, 'z'); b.box('trim', L * 0.2, H * 0.88, 0, 0.05, 0.16, 0.06, 1); // 车把
  for (const f of [0.3, -0.3]) for (const s of [1, -1]) b.box('paint_body', f * L, r * 2 + 0.1, s * (W / 2 - 0.13), 0.62, 0.035, 0.26, 2); // 挡泥板
  b.box('trim', 0, r, 0, L * 0.62, 0.1, W * 0.5, 2);
  wheels(parts, [{ f: 0.3, r, w: 0.24, inset: 0 }, { f: -0.3, r, w: 0.24, inset: 0 }], W, L);
  return { parts: Object.values(parts), flat: true, extra: [], dims: [L, W, H] };
}

// ───── 把生成结果精确缩放到官方长宽高（自建模型按规格建，不是拉伸别人的模型）─────
function fit(res) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of res.parts) for (const g of Object.values(p.g)) for (let k = 0; k < g.P.length; k += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], g.P[k + c]); mx[c] = Math.max(mx[c], g.P[k + c]); }
  const [L, W, H] = res.dims, s = [L / (mx[0] - mn[0]), H / (mx[1] - mn[1]), W / (mx[2] - mn[2])], o = [(mx[0] + mn[0]) / 2, mn[1], (mx[2] + mn[2]) / 2];
  const T = (v, c) => (v - o[c]) * s[c];
  for (const p of res.parts) { for (const g of Object.values(p.g)) for (let k = 0; k < g.P.length; k++) g.P[k] = T(g.P[k], k % 3); p.o = p.o.map(T); if (p.extras && p.extras.slide) p.extras.slide = p.extras.slide.map((v, c) => v * s[c]); }
  for (const n of res.extra) n.translation = n.translation.map(T);
  return s;
}

const cars = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cars.json'), 'utf8'));
let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'models/meta.json'), 'utf8')); } catch (e) { }
const only = process.argv.slice(2);
fs.mkdirSync(path.join(ROOT, 'models'), { recursive: true });
for (const c of cars) {
  if (only.length ? !only.includes(c.id) : (meta[c.id] || {}).origin === 'community') continue;
  const res = buildCar(c), s = fit(res), file = path.join(ROOT, 'models', c.id + '.glb');
  writeGlb(file, res.parts, res.flat, res.extra);
  const tris = res.parts.reduce((a, p) => a + Object.values(p.g).reduce((b, g) => b + g.tris, 0), 0);
  console.log(`${c.id.padEnd(14)} ${tris} 面  ${(fs.statSync(file).size / 1024).toFixed(0)} KB  校正比例 ${s.map(v => v.toFixed(3)).join('/')}`);
}
