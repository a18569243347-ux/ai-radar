const { getDataset, providerMap } = require('../../utils/dataService')
const { toCNY, fmtMoney, tierLabel } = require('../../utils/format')

const HOT_IDS = [
  'openai-gpt-6-astra',
  'openai-gpt-5-6-luna',
  'anthropic-claude-opus-5',
  'anthropic-claude-sonnet-5',
  'google-gemini-3-8-flash',
  'deepseek-v4-flash',
  'zhipu-glm-5-3',
  'moonshot-kimi-k2-5'
]

function fmtDate(iso) {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

Page({
  data: {
    loading: true,
    dataSource: '',
    stats: { models: 0, providers: 0, plans: 0 },
    updatedAt: '—',
    banner: '',
    hot: []
  },

  onShow() {
    this.render()
  },

  render() {
    getDataset().then((ds) => {
      const pmap = providerMap(ds)
      const fx = ds.fx || { rates: { CNY: 7.15 } }
      const byId = {}
      ;(ds.models || []).forEach((m) => {
        byId[m.id] = m
      })
      const hot = HOT_IDS.filter((id) => byId[id]).map((id) => {
        const m = byId[id]
        const p = m.price
        return {
          id: m.id,
          name: m.name,
          provider: (pmap[m.provider] || {}).name || m.provider,
          region: (pmap[m.provider] || {}).region,
          tierText: tierLabel(m.tier),
          priceText:
            p == null
              ? '开源权重'
              : p.input_per_mtok === 0
                ? '免费'
                : `${fmtMoney(toCNY(p.input_per_mtok, p.currency, fx), 'CNY')} / ${fmtMoney(toCNY(p.output_per_mtok, p.currency, fx), 'CNY')}`
        }
      })
      this.setData({
        loading: false,
        dataSource: ds._source,
        stats: {
          models: (ds.models || []).length,
          providers: (ds.providers || []).length,
          plans: (ds.plans || []).length
        },
        updatedAt: fmtDate(ds.meta && ds.meta.updated_at),
        banner:
          ds.meta && ds.meta.status === 'seed-pending-review'
            ? '当前为种子数据（待人工核验），价格请以各官方页面为准'
            : '',
        hot
      })
    })
  },

  goPrices() {
    wx.switchTab({ url: '/pages/prices/prices' })
  },
  goPlans() {
    wx.switchTab({ url: '/pages/plans/plans' })
  },
  goFree() {
    wx.switchTab({ url: '/pages/free/free' })
  }
})
