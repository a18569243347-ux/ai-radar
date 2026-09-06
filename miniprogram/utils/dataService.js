// 数据服务后端配置——按阶段升级，默认零成本。
//
//   type: 'none'    只用打包内置的 miniprogram/data/dataset.js（数据更新随小程序发版）。
//                   验证期推荐：¥0 成本，不依赖任何后端。
//   type: 'worker'  Cloudflare Workers 后端（部署方法见 worker/README.md）。
//                   workerBase 填你的备案域名，如 'https://api.example.com'。
//                   CI 有价格变化时自动 POST 推送，小程序每次启动拉最新——热更新免提审。
//   type: 'cloud'   微信云开发（cloudfunctions/），需先在 app.js 完成 wx.cloud.init。
//
// 切换后端只改这里，页面代码无需变动。
const BACKEND = {
  type: 'worker',
  workerBase: 'https://airadar.wechatwlxj.top'
}

const bundled = require('../data/dataset.js')

const bundledSource = () => ({ ...bundled, ok: true, _source: 'bundled' })

let _cache = null
let _loading = null

function fromCloud() {
  return new Promise((resolve, reject) => {
    if (!wx.cloud || !wx.cloud.callFunction) return reject(new Error('wx.cloud 不可用'))
    wx.cloud
      .callFunction({ name: 'queryData', data: { page: 'all' } })
      .then((res) => {
        const r = res && res.result
        if (r && r.ok) return resolve(r)
        reject(new Error((r && r.error) || '云端返回异常'))
      })
      .catch(reject)
  })
}

function fromWorker() {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BACKEND.workerBase}/dataset.json`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.models) return resolve(res.data)
        reject(new Error(`Workers 返回异常（${res.statusCode}）`))
      },
      fail: () => reject(new Error('Workers 请求失败'))
    })
  })
}

function fetchRemote() {
  if (BACKEND.type === 'cloud') return fromCloud()
  if (BACKEND.type === 'worker') return fromWorker()
  return Promise.reject(new Error('未配置后端'))
}

function getDataset(opts) {
  const fresh = !!(opts && opts.fresh)
  if (BACKEND.type === 'none') return Promise.resolve(bundledSource())
  if (!fresh && _cache) return Promise.resolve(_cache)
  if (_loading) return _loading
  _loading = fetchRemote()
    .then((r) => {
      _cache = { ...r, ok: true, _source: BACKEND.type }
      return _cache
    })
    .catch((e) => {
      console.warn('[dataService] 远端数据不可用：', e && e.message)
      if (_cache) return _cache
      _cache = bundledSource()
      return _cache
    })
    .finally(() => {
      _loading = null
    })
  return _loading
}

function providerMap(ds) {
  const map = {}
  ;(ds.providers || []).forEach((p) => {
    map[p.id] = p
  })
  return map
}

module.exports = { getDataset, providerMap }
