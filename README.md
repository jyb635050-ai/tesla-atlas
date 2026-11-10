# 特斯拉车型图鉴（非官方）

非官方爱好者作品，与 Tesla, Inc. 无关。历代 11 台车型的 3D 展示（换色、开门、看内饰）＋数据看板。

- 数据：`node tools/build_cars.mjs` → `data/cars.json`（每个数字带原网页与原句）
- 模型：`node tools/build_models.mjs` → `models/*.glb`（自建简化模型）；`node tools/posters.mjs` 生成首页海报
- 验收：`node tools/accept.mjs`（本地）｜`--url <网址>`（线上）｜`--prove`（反向验证）。`tools/accept.mjs` 是冻结的判卷标准，不要改
- 进度见 `PROGRESS.md`，待裁决事项见 `BLOCKED.md`
