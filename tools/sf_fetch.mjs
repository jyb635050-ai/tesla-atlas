// 从 Sketchfab 搜索并下载候选社区模型到 raw/<车 id>/<uid>/model.glb（raw/ 不入库），并打印结构摘要。
// 用法：SKETCHFAB_TOKEN=… node tools/sf_fetch.mjs search <车 id> "<搜索词>" [数量]     只列候选
//       SKETCHFAB_TOKEN=… node tools/sf_fetch.mjs get <车 id> <uid> [uid…]            下载并摘要
//       node tools/sf_fetch.mjs info <glb 路径>                                       只摘要
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), TOKEN = process.env.SKETCHFAB_TOKEN;
const OK = ['CC Attribution', 'CC Attribution-ShareAlike', 'CC0 Public Domain'];
const [cmd, a1, ...rest] = process.argv.slice(2);
const api = async (u, auth) => { const r = await fetch(u, auth ? { headers: { Authorization: 'Token ' + TOKEN } } : {}); if (!r.ok) throw new Error(u + ' → ' + r.status); return r.json(); };

export function info(file) {
  const b = fs.readFileSync(file), g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const names = (g.nodes || []).map(n => n.name || ''), hit = re => [...new Set(names.filter(n => re.test(n)))];
  let tris = 0; for (const m of g.meshes || []) for (const p of m.primitives) { const a = g.accessors[p.indices ?? p.attributes.POSITION]; tris += Math.floor(a.count / 3); }
  return { mb: +(b.length / 1048576).toFixed(1), nodes: names.length, meshes: (g.meshes || []).length, tris, anims: (g.animations || []).length, mats: (g.materials || []).map(m => m.name).slice(0, 60),
    door: hit(/door|porte|puerta|tür/i).slice(0, 24), interior: hit(/interior|seat|steer|dash|cabin|cockpit|salon/i).slice(0, 24), wheel: hit(/wheel|tire|tyre|rim/i).length, sample: names.filter(Boolean).slice(0, 40) };
}
if (cmd === 'info') console.log(JSON.stringify(info(a1), null, 1));
else if (cmd === 'search') {
  const d = await api(`https://api.sketchfab.com/v3/search?type=models&downloadable=true&count=${rest[1] || 24}&sort_by=-likeCount&q=${encodeURIComponent(rest[0])}`);
  for (const r of d.results) { if (!OK.includes(r.license?.label)) continue; const glb = r.archives?.glb?.size || 0; console.log(`${r.uid} | ${r.name.slice(0, 44).padEnd(44)} | ${r.user.username.padEnd(18)} | faces ${String(r.faceCount).padStart(8)} | glb ${(glb / 1048576).toFixed(0).padStart(3)}MB | ♥${r.likeCount} | anim ${r.animationCount} | ${r.publishedAt.slice(0, 10)}`); }
} else if (cmd === 'get') {
  if (!TOKEN) { console.error('没有 SKETCHFAB_TOKEN'); process.exit(1); }
  for (const uid of rest) {
    const dir = path.join(ROOT, 'raw', a1, uid), file = path.join(dir, 'model.glb'); fs.mkdirSync(dir, { recursive: true });
    try {
      const m = await api('https://api.sketchfab.com/v3/models/' + uid);
      if (!OK.includes(m.license?.label)) { console.log(uid, '许可不允许：', m.license?.label); continue; }
      fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ uid, name: m.name, author: m.user.username, displayName: m.user.displayName, license: m.license.label, url: m.viewerUrl, faceCount: m.faceCount, publishedAt: m.publishedAt, description: (m.description || '').slice(0, 600) }, null, 1));
      if (!fs.existsSync(file)) { const d = await api(`https://api.sketchfab.com/v3/models/${uid}/download`, true); const r = await fetch(d.glb.url); if (!r.ok) throw new Error('下载 ' + r.status); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); }
      const i = info(file); console.log(`\n== ${a1} ${uid} 「${m.name}」 by ${m.user.username} · ${m.license.label}\n   ${i.mb}MB nodes ${i.nodes} meshes ${i.meshes} tris ${i.tris} anims ${i.anims} wheelNodes ${i.wheel}\n   door: ${i.door.join(', ') || '—'}\n   interior: ${i.interior.join(', ') || '—'}\n   mats: ${i.mats.join(', ').slice(0, 500)}\n   nodes: ${i.sample.join(', ').slice(0, 500)}`);
    } catch (e) { console.log(uid, '失败：', e.message); }
  }
}
