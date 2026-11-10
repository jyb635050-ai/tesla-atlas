// 占位车模：按 data/cars.json 的尺寸和车门生成方盒子 .glb，只在真模型到位前调试网站用。
// 用法：node tools/placeholder.mjs [id …]   不带 id＝给所有还没有 .glb 的车生成；带 id＝强制重生成这些
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function box(w, h, d, n, o = [0, 0, 0]) {
  const P = [], N = [], I = [];
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
  const S = [w / 2, h / 2, d / 2];
  for (const [nn, u, v] of faces) {
    const b = P.length / 3;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const a = i / n * 2 - 1, c = j / n * 2 - 1; P.push(...[0, 1, 2].map(k => (nn[k] + u[k] * a + v[k] * c) * S[k] + o[k])); N.push(...nn); }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const p = b + i * (n + 1) + j; I.push(p, p + n + 1, p + 1, p + 1, p + n + 1, p + n + 2); }
  }
  return { P, N, I };
}
function glb(parts) {
  const bufs = [], views = [], acc = [], meshes = [], nodes = [{ name: 'car', children: [] }], mats = [], matIdx = {};
  let off = 0;
  const push = (ta, target) => { const b = Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength); views.push({ buffer: 0, byteOffset: off, byteLength: b.length, target }); bufs.push(b); off += b.length; const pad = (4 - off % 4) % 4; if (pad) { bufs.push(Buffer.alloc(pad)); off += pad; } return views.length - 1; };
  for (const p of parts) {
    if (!(p.mat.name in matIdx)) { matIdx[p.mat.name] = mats.length; mats.push({ name: p.mat.name, pbrMetallicRoughness: { baseColorFactor: [...p.mat.color, 1], metallicFactor: 0.1, roughnessFactor: 0.6 } }); }
    const P = new Float32Array(p.geo.P), N = new Float32Array(p.geo.N), I = new Uint16Array(p.geo.I);
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
    const a0 = acc.length;
    acc.push({ bufferView: push(P, 34962), componentType: 5126, count: P.length / 3, type: 'VEC3', min: mn, max: mx });
    acc.push({ bufferView: push(N, 34962), componentType: 5126, count: N.length / 3, type: 'VEC3' });
    acc.push({ bufferView: push(I, 34963), componentType: 5123, count: I.length, type: 'SCALAR' });
    meshes.push({ primitives: [{ attributes: { POSITION: a0, NORMAL: a0 + 1 }, indices: a0 + 2, material: matIdx[p.mat.name] }] });
    nodes.push({ name: p.name, mesh: meshes.length - 1, translation: p.t || [0, 0, 0], ...(p.extras ? { extras: p.extras } : {}) }); nodes[0].children.push(nodes.length - 1);
  }
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes, meshes, materials: mats, accessors: acc, bufferViews: views, buffers: [{ byteLength: off }] }));
  const jp = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]), bin = Buffer.concat(bufs);
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + jp.length + 8 + bin.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(jp.length, 0); c1.writeUInt32LE(0x4E4F534A, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(bin.length, 0); c2.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([h, c1, jp, c2, bin]);
}
const cars = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cars.json'), 'utf8')), force = process.argv.slice(2);
fs.mkdirSync(path.join(ROOT, 'models'), { recursive: true });
const FALLBACK = { 'roadster-next': [4.3, 2.0, 1.15], robovan: [5.6, 2.2, 2.3], cyberquad: [1.9, 1.15, 1.1] };
for (const c of cars) {
  const out = path.join(ROOT, 'models', c.id + '.glb');
  if (force.length ? !force.includes(c.id) : fs.existsSync(out)) continue;
  const [L, W, H] = c.dims ? [c.dims.l / 1000, c.dims.w / 1000, c.dims.h / 1000] : FALLBACK[c.id];
  const th = 0.04, paint = { name: 'paint_body', color: [0.9, 0.9, 0.9] }, dark = { name: 'trim', color: [0.15, 0.15, 0.17] };
  const parts = [{ name: 'body', geo: box(L, H * 0.8, W - 2 * th, 20, [0, H * 0.6, 0]), mat: paint }, { name: 'floor', geo: box(L * 0.9, H * 0.2, W * 0.8, 2, [0, H * 0.1, 0]), mat: dark }];
  for (const dn of c.doors) {
    const s = dn.endsWith('l') ? 1 : -1, rear = dn[0] === 'r', x0 = rear ? -L * 0.02 : L * 0.2;
    parts.push({ name: 'door_' + dn, t: [x0, H * 0.3, s * (W / 2 - th / 2)], geo: box(L * 0.2, H * 0.5, th, 3, [-L * 0.1, H * 0.25, 0]), mat: dark, ...(dn[0] === 's' ? { extras: { slide: [-L * 0.2, 0, s * 0.1] } } : {}) });
  }
  if (c.model.interior) parts.push({ name: 'interior', geo: box(L * 0.25, H * 0.35, W * 0.5, 7, [-L * 0.05, H * 0.45, 0]), mat: { name: 'seat', color: [0.75, 0.55, 0.35] } });
  fs.writeFileSync(out, glb(parts)); console.log('占位', c.id);
}
