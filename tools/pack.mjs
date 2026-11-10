// 把 raw/<id>/processed.glb 压缩成 models/<id>.glb（减面、贴图转 webp、meshopt），保留节点名。用法：node tools/pack.mjs <id> [保留比例=1]
import { execFileSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), [id, ratio = '1', tex = '1024'] = process.argv.slice(2);
const src = path.join(ROOT, 'raw', id, 'processed.glb'), out = path.join(ROOT, 'models', id + '.glb');
execFileSync(process.execPath, [path.join(ROOT, 'node_modules/@gltf-transform/cli/bin/cli.js'), 'optimize', src, out, '--flatten', 'false', '--join', 'false', '--instance', 'false', '--palette', 'false', '--prune', 'false',
  '--compress', 'meshopt', '--simplify', String(+ratio < 1), '--simplify-ratio', ratio, '--simplify-error', +ratio < 1 ? '0.004' : '0.0001', '--texture-compress', 'webp', '--texture-size', tex], { stdio: ['ignore', 'ignore', 'inherit'] });
console.log(id, (fs.statSync(out).size / 1048576).toFixed(2), 'MB');
