const { getDataset, providerMap } = require('../../utils/dataService')
const { toCNY, fmtMoney, convert, fmtLocal } = require('../../utils/format')

// 地区对比视图的展示顺序
const REGIONAL_ORDER = ['chatgpt-plus', 'chatgpt-go', 'claude-pro', 'google-ai-plus', 'google-ai-pro']

Page({
  data: {
    loading: true,
    banner: '',
    mode: 'default', // default=订阅计划 | regional=地区对比
    groups: [],
    regionalGroups: [],
    regionalNote: '数据抓取自各地区 App Store 公开页面；跨区购买可能违反平台服务条款，本页仅供了解，请以当地商店实际展示为准。'
  },

  onLoad() {
    this.render()
  },

  onPullDownRefresh() {
    // 强制绕过缓存重新查云端，保证第一时间看到最新价格
    this.render({ fresh: true, done: () => wx.stopPullDownRefresh() })
  },

  render({ fresh = false, done } = {}) {
    getDataset({ fresh }).then((ds) => {
      const pmap = providerMap(ds)
      const fx = ds.fx || { rates: { CNY: 7.15 } }
      this.setData({
        loading: false,
        banner:
          ds.meta && ds.meta.status === 'seed-pending-review'
            ? '当前为种子数据（待人工核验）；订阅权益以官方页面为准'
            : '',
        groups: this.buildDefaultGroups(ds, pmap, fx),
        regionalGroups: this.buildRegionalGroups(ds, fx)
      })
      if (done) done()
    })
  },

  buildDefaultGroups(ds, pmap, fx) {
    const items = (ds.plans || []).map((pl) => {
      const prov = pmap[pl.provider] || {}
      const pr = pl.price || {}
      const cnyMonthly = pr.monthly == null ? null : toCNY(pr.monthly, pr.currency, fx)
      return {
        id: pl.id,
        name: pl.name,
        provider: prov.name || pl.provider,
        region: prov.region || 'overseas',
        regionText: prov.region === 'cn' ? '国内' : '海外',
        isFree: pr.monthly === 0,
        priceText:
          pr.monthly == null
            ? '—'
            : pr.monthly === 0
              ? '免费'
              : `${pr.currency === 'CNY' ? '¥' : '$'}${pr.monthly}/月`,
        cnyText: pr.monthly == null || pr.monthly === 0 ? '' : `≈ ${fmtMoney(cnyMonthly, 'CNY')}/月`,
        annualText: pr.annual ? `年付 ${pr.currency === 'CNY' ? '¥' : '$'}${pr.annual}/年` : '',
        highlights: pl.highlights || [],
        note: pl.note || '',
        url: pl.official_url
      }
    })
    return [
      { key: 'overseas', title: '海外订阅', list: items.filter((x) => x.region === 'overseas') },
      { key: 'cn', title: '国内订阅 / 免费 App', list: items.filter((x) => x.region === 'cn') }
    ].filter((g) => g.list.length)
  },

  buildRegionalGroups(ds, fx) {
    const regionsMap = {}
    ;(ds.regions || []).forEach((r) => {
      regionsMap[r.id] = r
    })
    const byPlanKey = {}
    ;(ds.regional_plans || []).forEach((rp) => {
      const cny = convert(rp.price, rp.currency, 'CNY', fx)
      const row = {
        id: rp.id,
        regionName: (regionsMap[rp.region] || {}).name || rp.region,
        verified: !!rp.verified,
        localText: fmtLocal(rp.price, rp.currency),
        cnyValue: cny,
        cnyText: cny == null ? '汇率缺失' : `≈ ${fmtMoney(cny, 'CNY')}/月`,
        url: rp.source_url
      }
      ;(byPlanKey[rp.plan_key] = byPlanKey[rp.plan_key] || { plan_name: rp.plan_name, rows: [] }).rows.push(row)
    })
    return REGIONAL_ORDER.filter((k) => byPlanKey[k]).map((k) => {
      const g = byPlanKey[k]
      g.rows.sort((a, b) => (a.cnyValue == null ? 1 : b.cnyValue == null ? -1 : a.cnyValue - b.cnyValue))
      return g
    })
  },

  onModeTap(e) {
    this.setData({ mode: e.currentTarget.dataset.key })
  },

  onCopy(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '链接已复制', icon: 'none' })
    })
  }
})
