// 云函数：pullWorker —— 定时从数据源拉取最新数据集，写入云数据库 datasets.latest。
// 触发：定时触发器（config.json，每小时 :13/:43）+ 手动测试
// 数据源按顺序尝试：CI 推送的 Worker（主）→ jsdelivr 镜像 → GitHub 原始文件（兜底）
const cloud = require('wx-server-sdk')
const https = require('https')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const SOURCES = [
  'https://airadar.wechatwlxj.top/dataset.json',
  'https://cdn.jsdelivr.net/gh/a18569243347-ux/ai-radar@main/dist/dataset.json',
  'https://raw.githubusercontent.com/a18569243347-ux/ai-radar/main/dist/dataset.json'
]

function fetchJson(url, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'ai-radar-crawler/0.1 (data-verification)' } },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error('HTTP ' + res.statusCode))
        }
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (raw += c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw))
          } catch (e) {
            reject(new Error('bad-json'))
          }
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')))
  })
}

exports.main = async () => {
  let dataset = null
  let lastErr = 'unknown'
  for (const url of SOURCES) {
    try {
      dataset = await fetchJson(url)
      break
    } catch (e) {
      lastErr = `${url} → ${e.message}`
    }
  }
  if (!dataset || !dataset.models || !dataset.meta) {
    return { ok: false, error: 'all sources failed', last: lastErr }
  }

  const db = cloud.database()
  const now = Date.now()
  let prev = null
  try {
    prev = (await db.collection('datasets').doc('latest').get()).data
  } catch (e) {
    /* 首次运行时记录尚不存在 */
  }
  const newStamp = dataset.meta.updated_at
  const oldStamp = prev && prev.meta && prev.meta.updated_at
  if (prev && oldStamp && newStamp && oldStamp >= newStamp) {
    return { ok: true, skipped: true, note: '数据无更新', dataset_at: oldStamp }
  }

  await db.collection('datasets').doc('latest').set({ data: { ...dataset, imported_at: now } })
  return { ok: true, imported_at: now, models: dataset.models.length, dataset_at: newStamp }
}
