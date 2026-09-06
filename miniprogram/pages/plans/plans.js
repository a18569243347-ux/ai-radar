const { getDataset, providerMap } = require('../../utils/dataService')
const { toCNY, fmtMoney } = require('../../utils/format')

Page({
  data: {
    loading: true,
    banner: '',
    groups: []
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
      const items = (ds.plans || []).map((pl) => {
        const prov = pmap[pl.provider] || {}
        const pr = pl.price || {}
        const cnyMonthly =
          pr.monthly == null ? null : toCNY(pr.monthly, pr.currency, fx)
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
              : (pr.monthly === 0
                  ? '免费'
                  : `${pr.currency === 'CNY' ? '¥' : '$'}${pr.monthly}/月`),
          cnyText:
            pr.monthly == null || pr.monthly === 0
              ? ''
              : `≈ ${fmtMoney(cnyMonthly, 'CNY')}/月`,
          annualText: pr.annual ? `年付 ${pr.currency === 'CNY' ? '¥' : '$'}${pr.annual}/年` : '',
          highlights: pl.highlights || [],
          note: pl.note || '',
          url: pl.official_url
        }
      })
      const groups = [
        { key: 'overseas', title: '海外订阅', list: items.filter((x) => x.region === 'overseas') },
        { key: 'cn', title: '国内订阅 / 免费 App', list: items.filter((x) => x.region === 'cn') }
      ].filter((g) => g.list.length)
      this.setData({
        loading: false,
        groups,
        banner:
          ds.meta && ds.meta.status === 'seed-pending-review'
            ? '当前为种子数据（待人工核验）；订阅权益以官方页面为准'
            : ''
      })
      if (done) done()
    })
  },

  onCopy(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '官方页面已复制', icon: 'none' })
    })
  }
})
