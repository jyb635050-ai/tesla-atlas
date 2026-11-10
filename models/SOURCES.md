# 模型来源

## 社区模型（Sketchfab，知识共享许可，均已在署名页署名）

| 车 | 模型 | 作者 | 许可 | uid | 本站做的改动 |
|---|---|---|---|---|---|
| model-3 | [Tesla M3 model](https://sketchfab.com/3d-models/tesla-m3-model-3a602469d7874d1397efa67182198705) | wintrez | CC Attribution | 3a602469d7874d1397efa67182198705 | 摆正朝向、等比缩放到官方车长；按门缝位置切出车门并设铰链；贴图转 webp、meshopt 压缩 |
| model-s | [Tesla Model S Plaid](https://sketchfab.com/3d-models/tesla-model-s-plaid-9de8855fae324e6cbbb83c9b5288c961) | Lals | CC Attribution | 9de8855fae324e6cbbb83c9b5288c961 | 摆正朝向、等比缩放到官方车长；按门缝位置切出车门并设铰链；给丢了颜色的材质补色；贴图转 webp、meshopt 压缩 |
| model-x | [Tesla Model X](https://sketchfab.com/3d-models/tesla-model-x-6a5469a1b776431cb1e1e17a72a2c4f5) | Abdul.Hannan | CC Attribution | 6a5469a1b776431cb1e1e17a72a2c4f5 | 摆正朝向、等比缩放到官方车长；按门缝位置切出车门并设铰链；超密部件减面；原模型无内饰；贴图转 webp、meshopt 压缩 |
| model-y | [2021 Tesla Model Y](https://sketchfab.com/3d-models/2021-tesla-model-y-59e2ead369984b1a85c800ff6cf6789d) | tonielpro520 | CC Attribution | 59e2ead369984b1a85c800ff6cf6789d | 摆正朝向、等比缩放到官方车长；按门缝位置切出车门并设铰链；超密部件减面；贴图转 webp、meshopt 压缩 |
| cybertruck | [TESLA Cybertruck](https://sketchfab.com/3d-models/tesla-cybertruck-bd96c5be64cb4266b96edd1e6d8a5972) | zafarsniper | CC Attribution | bd96c5be64cb4266b96edd1e6d8a5972 | 摆正朝向、等比缩放到官方车长；按门缝位置切出车门并设铰链；高度微调 -1.5%（模型自身比例误差）；超密部件减面；给丢了颜色的材质补色；删掉地面；贴图转 webp、meshopt 压缩 |
| roadster-2008 | [2008 Tesla Roadster](https://sketchfab.com/3d-models/2008-tesla-roadster-317dabbe5e824948a92091f7bd39c2de) | the_86_guy | CC Attribution | 317dabbe5e824948a92091f7bd39c2de | 摆正朝向、等比缩放到官方车长；按门缝位置切出车门并设铰链；高度微调 1.5%（模型自身比例误差）；超密部件减面；贴图转 webp、meshopt 压缩 |
| roadster-next | [Tesla Roadster 2020](https://sketchfab.com/3d-models/tesla-roadster-2020-1fbf29e297bd4a17ac39a00a378441d8) | metarex.4d | CC Attribution | 1fbf29e297bd4a17ac39a00a378441d8 | 摆正朝向、等比缩放到官方车长；按门缝位置切出车门并设铰链；贴图转 webp、meshopt 压缩 |

流程：`tools/sf_fetch.mjs` 下载到 raw/（不入库）→ `tools/bl_process.py`（配置 `tools/models.json`）→ `tools/pack.mjs`。

没选的：684k 面的「Tesla 2018 Model 3」（节点命名是 GTA 模组格式，疑似游戏搬运，弃用）。

## 自建简化模型（`tools/build_models.mjs`）

- semi：社区候选要么宽度与估算尺寸差 11%，要么带挂车和人物需大量清理，暂用自建
- cybercab：Sketchfab 上只有一个 AI 生成的单网格（无内饰、不可拆门）
- robovan：只有一个 5 万面单网格（无内饰、不可拆门）
- cyberquad：唯一候选只有 1.4 万面，低于社区模型 3 万面的门槛
