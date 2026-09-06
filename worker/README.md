# Cloudflare Workers 后端（零成本路线）

把 CI 的价格更新直接落到你现有的 Cloudflare 账号上，小程序每次启动拉最新数据。
免费额度（Workers 10 万请求/天、KV 10 万读/天）对本项目绰绰有余，**¥0**。

> ⚠️ 前提：给小程序用的域名必须已完成 ICP 备案（微信 request 合法域名的硬性要求）。
> 如果你要复用现有小程序的 Workers 域名，确认它在备案状态即可。
> 另外建议 DNS 记录用「仅 DNS」模式直连/网关到 Worker 的自定义域配置，避免备案接入信息与解析不符的争议。

## 方式一：控制台部署（推荐，5 分钟，不用装任何工具）

1. Cloudflare Dashboard → **Workers & Pages → Create → Worker**，名字如 `ai-radar-dataset`，Deploy。
2. 点进该 Worker → **Edit code** → 把本目录 `worker.js` 的内容整体粘贴覆盖 → Deploy。
3. 建 KV：左侧 **Storage & Databases → KV → Create namespace**，名字如 `ai-radar-dataset`。
4. 绑定 KV：回到 Worker → **Settings → Bindings → Add → KV namespace**：
   - Variable name 填 `DATASET`，选择刚创建的 namespace → 保存。
5. 设密码：**Settings → Variables and Secrets → Add**：
   - Type: Secret，Name: `SYNC_TOKEN`，Value 自己编一串长随机字符 → 保存。
6. 绑定自己的备案域名：**Settings → Domains & Routes → Add → Custom domain**，如 `airadar.wechatwlxj.top`（该域名需已托管在 Cloudflare）。
7. 手动验证（Git Bash）：
   ```bash
   # 推送一次数据（记得先跑过一次构建，dist/dataset.json 存在）
   curl -X POST -H "Content-Type: application/json" -H "x-sync-token: 你的token" \
        --data-binary @dist/dataset.json "https://airadar.wechatwlxj.top"
   # 拉取验证
   curl "https://airadar.wechatwlxj.top/dataset.json" | head -c 200
   ```

## 方式二：wrangler CLI（适合顺手自动化）

```bash
npm install -g wrangler
wrangler login
cd worker
wrangler kv namespace create DATASET   # 把返回的 id 填进 wrangler.toml
wrangler secret put SYNC_TOKEN
wrangler deploy
```

## 接入 CI

GitHub 仓库 → Settings → Secrets and variables → Actions → 添加：
- `CLOUD_IMPORT_URL` = `https://airadar.wechatwlxj.top`
- `SYNC_TOKEN` = 第 5 步设置的 token

之后 `price-sync` 工作流发现价格变化时会自动 POST 到 Worker（没变化不推送——crawler 的内容哈希检测在起作用）。

## 接入小程序

1. `miniprogram/utils/dataService.js` 里把 `BACKEND` 改为：
   ```js
   const BACKEND = { type: 'worker', workerBase: 'https://airadar.wechatwlxj.top' }
   ```
2. 小程序后台（mp.weixin.qq.com → 开发 → 开发管理 → 开发设置 → 服务器域名）把 `https://airadar.wechatwlxj.top` 加进 **request 合法域名**（每月可修改 50 次）。
3. 开发者工具里重新编译 → 「关于」页数据来源应显示 `worker`。

## 排错

| 现象 | 处理 |
|---|---|
| 小程序里请求失败 | 域名没加合法域名 / 域名备案状态异常 |
| POST 返回 401 | SYNC_TOKEN 不一致（Worker Secret vs GitHub Secrets） |
| GET 返回 404 | 还没有成功 POST 过数据，先跑一次 crawler.crawl + 手动 curl 推送 |
