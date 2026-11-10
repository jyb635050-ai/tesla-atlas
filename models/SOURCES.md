# 模型来源

2026-11-10：11 台全部是本站自建的简化模型，由 `tools/build_models.mjs` 按 `data/cars.json` 的长宽高参数化生成（侧面轮廓＋俯视轮廓放样，切出车门、车窗、轮拱，配车轮与内饰）。
原因：`SKETCHFAB_TOKEN` 未设置，Sketchfab 社区模型下载接口返回 401（见 BLOCKED.md 第 1 条）。
拿到令牌后：把社区模型处理成 `models/<id>.glb`，在 `models/meta.json` 里登记 `{ "<id>": { "origin": "community", "simplified": false, "interior": true, "sources": [{url, author, license}] } }`，再跑 `node tools/build_cars.mjs`。
