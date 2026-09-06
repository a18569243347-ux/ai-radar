const { getDataset, providerMap } = require('../../utils/dataService')
const { toCNY, toUSD, fmtMoney, tierLabel } = require('../../utils/format')

const REGION_TABS = [
  { key: 'all', label: '全部' },
  { key: 'overseas', label: '海外' },
  { key: 'cn', label: '国内' }
]
const SORTS = [
  { key: 'input', label: '按输入价' },
  { key: 'output', label: '按输出价' }
]

Page({
  data: {
    loading: true,
    banner: '',
    regionTabs: REGION_TABS,
    sorts: SORTS,
    region: 'all',
    sortBy: 'input',
    display: 'CNY',
    count: 0,
    rows: []
  },

  _all: [],

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
      this._all = (ds.models || []).map((m) => {
        const p = m.price
        const prov = pmap[m.provider] || {}
        return {
          id: m.id,
          name: m.name,
          tierText: tierLabel(m.tier),
          context: m.context,
          provider: prov.name || m.provider,
          region: prov.region || 'overseas',
          isFree: !!p && p.input_per_mtok === 0 && p.output_per_mtok === 0,
          isOpen: p == null,
          inCNY: p ? fmtMoney(toCNY(p.input_per_mtok, p.currency, fx), 'CNY') : '—',
          inUSD: p ? fmtMoney(toUSD(p.input_per_mtok, p.currency, fx), 'USD') : '—',
          outCNY: p ? fmtMoney(toCNY(p.output_per_mtok, p.currency, fx), 'CNY') : '—',
          outUSD: p ? fmtMoney(toUSD(p.output_per_mtok, p.currency, fx), 'USD') : '—',
          cachedCNY:
            p && p.cached_input_per_mtok != null
              ? fmtMoney(toCNY(p.cached_input_per_mtok, p.currency, fx), 'CNY')
              : '',
          cachedUSD:
            p && p.cached_input_per_mtok != null
              ? fmtMoney(toUSD(p.cached_input_per_mtok, p.currency, fx), 'USD')
              : '',
          sortIn: p ? toCNY(p.input_per_mtok, p.currency, fx) : Number.MAX_SAFE_INTEGER,
          sortOut: p ? toCNY(p.output_per_mtok, p.currency, fx) : Number.MAX_SAFE_INTEGER,
          url: m.official_url,
          note: m.note || ''
        }
      })
      this.setData({
        loading: false,
        banner:
          ds.meta && ds.meta.status === 'seed-pending-review'
            ? '当前为种子数据（待人工核验）；汇率 ' + (fx.source || '')
            : ''
      })
      this.applyFilters()
      if (done) done()
    })
  },

  applyFilters() {
    const { region, sortBy, display } = this.data
    let rows = this._all.filter((r) => region === 'all' || r.region === region)
    rows = rows.slice().sort((a, b) => (sortBy === 'input' ? a.sortIn - b.sortIn : a.sortOut - b.sortOut))
    rows = rows.map((r) => ({
      ...r,
      inText: r.isOpen ? '开源权重' : r.isFree ? '免费' : display === 'CNY' ? r.inCNY : r.inUSD,
      outText: r.isOpen ? '见托管平台' : r.isFree ? '免费' : display === 'CNY' ? r.outCNY : r.outUSD,
      cachedText: r.isOpen || r.isFree || !r.cachedCNY ? '' : display === 'CNY' ? r.cachedCNY : r.cachedUSD,
      regionText: r.region === 'cn' ? '国内' : '海外'
    }))
    this.setData({ rows, count: rows.length })
  },

  onRegionTap(e) {
    this.setData({ region: e.currentTarget.dataset.key })
    this.applyFilters()
  },
  onSortTap(e) {
    this.setData({ sortBy: e.currentTarget.dataset.key })
    this.applyFilters()
  },
  onCurrencyTap(e) {
    this.setData({ display: e.currentTarget.dataset.key })
    this.applyFilters()
  },

  onCopy(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '官网链接已复制', icon: 'none' })
    })
  }
})
