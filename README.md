# AI雷达 · 微信小程序

全网 AI 大厂 API 与订阅价格速查工具：官方 API 每百万 token 价格对比、订阅计划换算、免费模型资源。每 30 分钟自动核对官方调价，有变化才入库，小程序端最迟约半小时跟上。

> ⚠️ **合规第一**：本仓库只收录官方渠道与有授权的合规聚合平台，不收录转售 API 的「中转站」。
> 详见 [docs/compliance.md](docs/compliance.md) 与 [docs/launch-checklist.md](docs/launch-checklist.md)。
> 🚀 **零基础上手**：从注册小程序到上架的逐步操作教程见 [docs/beginner-guide.md](docs/beginner-guide.md)。

## 目录结构

```
├── data/                  # 种子数据（唯一编辑入口，JSON 格式）
│   ├── meta.json          # 版本 / 免责声明 / 更新说明
│   ├── providers.json     # 15 家厂商（海外/国内）
│   ├── models.json        # API 模型价格（每百万 tokens）
│   ├── plans.json         # 订阅计划（ChatGPT Plus / Claude Pro / Kimi 会员…）
│   ├── free_tiers.json    # 免费资源清单
│   └── aggregators.json   # 合规聚合平台（OpenRouter / 硅基流动…）
├── crawler/               # 采集与构建（纯 Python 标准库，无第三方依赖）
│   ├── crawl.py           # 入口：合并种子 + 抓取 + 校验 → 输出数据集
│   ├── fx.py              # ECB 参考汇率（frankfurter.app）
│   ├── validate.py        # 结构校验 + 广告法绝对化用语检查
│   ├── sync.py            # 推送数据集到云数据库（可选）
│   └── sources/           # 抓取源：openrouter（公开 API）、deepseek（页面解析）
├── cloudfunctions/        # 微信云开发函数
│   ├── importData/        # CI 推送数据入库（token 鉴权，HTTP 接入）
│   └── queryData/         # 小程序读取数据
├── miniprogram/           # 小程序前端（原生 WXML）
│   ├── pages/             # 首页 / 价格 / 订阅 / 免费 / 关于
│   ├── utils/             # 数据服务（云端优先、内置快照兜底）+ 换算
│   └── data/dataset.js    # 构建产物（离线兜底数据，勿手工编辑）
├── tools/build_offline.pl # 本机无 Python 时的离线构建（Perl）
└── .github/workflows/price-sync.yml     # 每 30 分钟核对 → 有变化才提交/入库
```

## 数据流

```
data/*.json（人工种子）
   └─ GitHub Actions 每 30 分钟 ──► 抓取 OpenRouter 公开 API + DeepSeek 官网 + 汇率
          ├─ 与种子价交叉核对 → 漂移超 25% 写入 meta.drift_report（人工复核信号）
          ├─ 校验（结构 + 广告法用语）
          ├─ 内容哈希比对：数据没变 → 不提交、不同步（仓库与云数据库保持干净）
          ├─ 有变化 → 提交 dist/dataset.json + miniprogram/data/dataset.js 回仓库
          └─ （可选）POST 到 importData 云函数 → 云数据库 → 小程序热更新免提审
```

### 更新频率与上限

- 默认每 30 分钟核对一次（`price-sync.yml` 的 cron）；想更快改成 `*/5 * * * *`（GitHub 最低 5 分钟，但调度本身常有几分钟延迟），想省资源可改每小时。
- 每轮运行约 1 分钟、3 个网络请求；即便扩到几十个数据源，日均请求量也远低于搜索引擎爬虫的水平，对官网无压力。
- 公开仓库 Actions 免费；私有仓库每月免费 2000 分钟，30 分钟一轮约用 1000 分钟。
- 注意：仓库 60 天没有任何活动，GitHub 会暂停定时任务（会发邮件提醒），推一个 commit 即可恢复。

小程序端读取顺序：**远端数据快照 → 失败则用打包内置的 dataset.js**，所以没配任何后端也能直接跑。
后端三选一（只改 `miniprogram/utils/dataService.js` 里的 `BACKEND` 配置）：**微信云开发**（cloudfunctions/，当前默认）· **Cloudflare Workers**（[worker/](worker/README.md)，¥0 备选）· **内置快照**（¥0，数据随版本更新）。

## 快速开始

1. **导入开发者工具**：用微信开发者工具「导入项目」选择本目录（appid 先用测试号，`project.config.json` 里替换）。
2. **直接预览**：内置快照已包含 48 个模型的价格数据，真机/模拟器可直接看五个页面。
3. **改数据**：编辑 `data/*.json` → 本地重建或交给 CI：
   ```bash
   python -m crawler.crawl            # 联网构建（推荐）
   python -m crawler.crawl --offline  # 离线合并
   perl tools/build_offline.pl        # 本机没有 Python 时
   ```
4. **开云开发（可选但推荐）**：开发者工具 → 云开发 → 开通环境：
   - 创建集合 `datasets`（权限：仅创建者可读写，前端经云函数读取不受影响）；
   - 右键 `cloudfunctions/importData`、`cloudfunctions/queryData` → 上传并部署；
   - 给 `importData` 设环境变量 `SYNC_TOKEN=<随机长字符串>`；
   - 云开发控制台 → HTTP 访问服务 → 为 `importData` 绑定触发 URL；
   - 在 `miniprogram/app.js` 把 `YOUR-CLOUD-ENV` 换成环境 ID。
5. **接 CI 自动同步（可选）**：GitHub 仓库 Secrets 配置 `CLOUD_IMPORT_URL` 与 `SYNC_TOKEN`，之后每 30 分钟自动核对、有变化才入库。

## ⚠️ 首次上线前必须做：核验种子数据

`data/*.json` 里所有 `verified: false` 的条目是种子价格，来源有三类：

- **官方页确认价**：如 DeepSeek V3.2 ¥2/¥3、GPT-5 $1.25/$10（已被聚合平台参考价印证）；
- **聚合平台参考价折算**：2026 现役旗舰（GPT-6 Astra、Claude Opus 5、Gemini 3.8、GLM-5.3、DeepSeek V4、Kimi K2.5、Qwen3.8 等），来自 OpenRouter 公开 API（≈官方价 + 服务费），**需到各 official_url 逐条核对**；
- **2025 存量参考价**：豆包 / 百度 / 腾讯 / 阶跃部分条目，**必须核验更新**。

核验完把 `meta.json` 的 `status` 改为 `reviewed`，页面上的「待核验」角标会消失。
CI 每次运行的「漂移报告」（`meta.drift_report`）会持续提示哪些官方价可能变了。

## 合规要点（详见 docs/compliance.md）

- 不收录无授权转售 API 的中转站（违反上游服务条款，监管整治中）；
- 每条价格标注官方来源链接；全站免责声明；榜单/文案不用绝对化用语（构建期自动拦截）；
- 只抓公开定价页、遵守 robots、每天一次（凌晨执行）、自报 UA、失败即回退种子；
- 不内置 AI 生成功能（避免触发大模型备案）；个人主体不开交易。

## 第二版路线

跑分排行榜（LMArena 等公开榜单引用 + 来源标注）→ 合规聚合平台比价页（数据已自动采集）→ 省钱攻略栏目（只写官方渠道：免费层 / 年付折扣 / 学生计划 / 缓存与离峰计费）→ UV≥1000 后开通流量主。
