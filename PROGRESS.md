# 进度记录

## 开工回执（2026-11-10）
- 目标：特斯拉 11 台车的 3D 图鉴站——换色、开门看内饰、数据看板；本地与线上两条全量验收全 PASS，判卷指纹不变，--prove 退出码 1
- 顺序：任务 0 → 因令牌未设，先做任务 2（数据）、任务 3（网站），再做任务 1（模型）→ 任务 4（上线）
- 最大风险：没有 Sketchfab 令牌则社区模型下不了，只能全自建，data.quota（自建 ≤4）必不过
- 第二风险：社区模型车门没分件、没内饰，拆门工作量大

## 任务 0（完成）
- 指纹 7d8bf9a0566f0edcf9b9edbd757b554ed4bc3f54f063542b621fcfb185300a48 ✔
- 空项目 `--only data`：FAIL data.schema ✔
- SKETCHFAB_TOKEN：用户级/系统级环境变量都没设 ✘ → 见 BLOCKED.md

## 任务 2 数据（完成，2026-11-10）
- `tools/build_cars.mjs` 生成 `data/cars.json`（事实改这个脚本；模型信息读 `models/meta.json`）
- `--only data,sources`：src.designer/unveilYear/price/status/sales 全 PASS；src.dims 仅 cybercab 不过（见 BLOCKED 2）
- 初代 Roadster 设计师＝Barney Hatt（出处：维基 The Index Project 词条）

## 任务 3 网站（进行中）
- 结构：index.html + css/app.css + js/{app,viewer,i18n}.js + vendor/three（0.187 本地）
- 模型没到位前用 `node tools/placeholder.mjs` 的方盒子占位（会被真模型覆盖）
- 2026-11-10 停在这里（用量上限）：vendor/three 已就位（three.module.js + three.core.js + addons），tools/placeholder.mjs 是从样板站抄来的占位车模生成器（ROOT 指向 tools/，用前要把输出路径改到项目根，并且它会覆盖 data/cars.json——改掉这一行再用）。index.html / css / js 还没写。
- 下一步：写网站四个页面 → 查令牌，有就下社区模型、没有就自建 → 上线 → --prove

## 任务 3 网站（完成，2026-11-10）
- index.html + css/app.css + js/app.js（路由/语言/主题/四页）+ js/viewer.js（three.js 展示）
- 首页海报：`node tools/posters.mjs`（从自己的 3D 页截透明底图）→ `node tools/build_cars.mjs` 把 poster 字段写进数据

## 任务 1 车模（未达标，卡在令牌）
- 令牌始终没设 → 11 台全部自建：`tools/build_models.mjs` 参数化生成，全部标「简化模型」，都有车门、内饰、车漆
- `model.*` 全 PASS；`data.quota` FAIL（自建 11 台 > 4）——这是如实结果，不是故障
- 坑：three.js 里车头朝 +X 时左侧是 −Z（第一次把方向盘放到了右边）

## 任务 4 上线（完成，2026-11-10）
- 仓库 jyb635050-ai/tesla-atlas（公开），Pages 从 main 根目录发布：https://jyb635050-ai.github.io/tesla-atlas/
- 本地全量：42/44（FAIL：data.quota、src.dims〔仅 cybercab 车长〕）
- 线上全量：37/38（FAIL：data.quota）；online.same 12 个文件逐字节相同
- 改了数据或模型后：重跑 build_models → posters → build_cars → 本地验收 → commit → 单独一条 `git push`

## 任务 1 车模（完成，2026-11-10 第二轮）
- 领导提供了令牌 → 7 台换成 Sketchfab 社区模型（model-3/s/x/y、cybertruck、roadster-2008、roadster-next），4 台自建（semi、cybercab、robovan、cyberquad）
- 流程：`SKETCHFAB_TOKEN=… node tools/sf_fetch.mjs get <id> <uid>` → `blender -b --python tools/bl_process.py -- <id>`（配置 tools/models.json）→ `node tools/pack.mjs <id>` → models/meta.json 登记 → build_cars → posters
- 调试截图：`node tools/shot.mjs <id>`；看原始模型：`tools/bl_preview.py`、`tools/bl_list.py`（路径要给绝对路径）
- 坑：gltf-transform 的 simplify 对这些模型几乎不减面，要在 Blender 里用 Decimate；原模型顶点不共用，先 remove_doubles；有的模型材质没颜色，配置里 tint 补
- 本地全量：43/44（只剩 src.dims 的 cybercab 车长，见 BLOCKED 2）
