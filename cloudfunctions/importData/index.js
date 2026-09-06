// 云函数：importData —— 接收 CI（crawler/sync.py）推送的数据集快照，写入云数据库 datasets 集合。
// 部署后需要：
//   1. 在「云开发控制台 → HTTP 访问服务」为本函数绑定触发 URL（记为 CLOUD_IMPORT_URL）
//   2. 在本函数「云函数配置 → 环境变量」里设置 SYNC_TOKEN（与 GitHub Secrets 中一致）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  // HTTP 接入时 event 为 { path, httpMethod, headers, body, isBase64Encoded, ... }；
  // 本地/云端直接调用时 event 即数据集本体（便于调试）。
  let token = null
  let payload = event
  if (event && event.headers) {
    const headers = {}
    for (const k of Object.keys(event.headers)) headers[String(k).toLowerCase()] = event.headers[k]
    token = headers['x-sync-token'] || null
    let body = event.body || ''
    if (event.isBase64Encoded) body = Buffer.from(body, 'base64').toString('utf-8')
    try {
      payload = JSON.parse(body)
    } catch (e) {
      return { ok: false, error: 'bad-json' }
    }
  }

  const expected = process.env.SYNC_TOKEN
  if (!expected || token !== expected) return { ok: false, error: 'unauthorized' }

  for (const k of ['meta', 'fx', 'providers', 'models', 'plans', 'free_tiers', 'aggregators']) {
    if (!payload[k]) return { ok: false, error: 'missing ' + k }
  }

  const db = cloud.database()
  const now = Date.now()
  await db.collection('datasets').doc('latest').set({ data: { ...payload, imported_at: now } })
  return { ok: true, imported_at: now, models: (payload.models || []).length }
}
