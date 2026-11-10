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
