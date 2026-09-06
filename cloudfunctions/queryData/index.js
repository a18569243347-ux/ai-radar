// 云函数：queryData —— 小程序端通过 wx.cloud.callFunction 读取数据集。
// 云数据库里没有快照时返回错误，小程序端会自动回退到内置快照（miniprogram/data/dataset.js）。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const PAGES = ['all', 'home', 'prices', 'plans', 'free']

exports.main = async (event) => {
  const page = PAGES.includes(event.page) ? event.page : 'all'
  const db = cloud.database()

  let doc
  try {
    doc = (await db.collection('datasets').doc('latest').get()).data
  } catch (e) {
    return { ok: false, error: 'dataset-not-found（请先运行 importData 导入，或使用小程序内置快照）' }
  }

  const { meta, fx, providers, models, plans, free_tiers, aggregators, regions, regional_plans } = doc
  switch (page) {
    case 'home':
      return { ok: true, page, meta, fx, providers, models }
    case 'prices':
      return { ok: true, page, meta, fx, providers, models }
    case 'plans':
      return { ok: true, page, meta, fx, plans, regions, regional_plans }
    case 'free':
      return { ok: true, page, meta, free_tiers }
    default:
      return { ok: true, page, meta, fx, providers, models, plans, free_tiers, aggregators, regions, regional_plans }
  }
}
