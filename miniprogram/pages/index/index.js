const { getDataset, providerMap } = require('../../utils/dataService')
const { toCNY, toUSD, fmtMoney, tierLabel } = require('../../utils/format')

const BOARDS = [
  { key: 'price', label: '价格榜' },
  { key: 'flagship', label: '旗舰档横评' },
  { key: 'tier', label: '档位定位榜' },
  { key: 'plans', label: '订阅价格榜' },
  { key: 'budget', label: '免费与低价榜' }
]
const SORTS = [
  { key: 'output', label: '按输出价' },
  { key: 'input', label: '按输入价' }
]
const TIER_ORDER = { flagship: 0, reasoning: 1, mid: 2, lite: 3, open: 4, free: 5 }
const BUDGET_OUT_USD = 0.5

const BOARD_NOTES = {
  price: '按每百万 tokens 价格升序；开源权重模型无官方定价，未参与排序',
  flagship: '旗舰档 = 各厂商官方最高定位档，按输出价升序',
  tier: '档位为厂商官方定位：旗舰 → 推理 → 主力 → 轻量 → 开源 → 免费',
  plans: '订阅月费换算人民币升序，免费 App 置顶；以各官方页面为准',
  budget: '收录免费模型与输出价 ≤ $0.5/百万 tokens 的低价档，按输出价升序'
}

Page({
  data: {
    banner: '',
    boards: BOARDS,
    sorts: SORTS,
    board: 'price',
    priceSort: 'output',
    rows: [],
    note: BOARD_NOTES.price
  },

  _modelRows: [],
  _planRows: [],

  onShow() {
    this.render()
  },

  onPullDownRefresh() {
    this.render({ fresh: true, done: () => wx.stopPullDownRefresh() })
  },

  render({ fresh = false, done } = {}) {
    getDataset({ fresh }).then((ds) => {
      const pmap = providerMap(ds)
      const fx = ds.fx || { rates: { CNY: 7.15 } }

      this._modelRows = (ds.models || [])
        .filter((m) => m.price != null)
        .map((m) => {
          const p = m.price
          const prov = pmap[m.provider] || {}
          return {
            id: m.id,
            name: m.name,
            provider: prov.name || m.provider,
            regionText: prov.region === 'cn' ? '国内' : '海外',
            tierText: tierLabel(m.tier),
            tier: m.tier,
            isFree: p.input_per_mtok === 0 && p.output_per_mtok === 0,
            sortIn: toCNY(p.input_per_mtok, p.currency, fx),
            sortOut: toCNY(p.output_per_mtok, p.currency, fx),
            outUSD: toUSD(p.output_per_mtok, p.currency, fx),
            inText: fmtMoney(toCNY(p.input_per_mtok, p.currency, fx), 'CNY'),
            outText: fmtMoney(toCNY(p.output_per_mtok, p.currency, fx), 'CNY'),
            url: m.official_url
          }
        })

      this._planRows = (ds.plans || []).map((pl) => {
        const prov = pmap[pl.provider] || {}
        const pr = pl.price || {}
        const cny = pr.monthly == null ? null : toCNY(pr.monthly, pr.currency, fx)
        return {
          id: pl.id,
          name: pl.name,
          provider: prov.name || pl.provider,
          regionText: prov.region === 'cn' ? '国内' : '海外',
          isFree: pr.monthly === 0,
          sortCny: cny == null ? Number.MAX_SAFE_INTEGER : cny,
          metric: pr.monthly == null ? '—' : pr.monthly === 0 ? '免费' : `${pr.currency === 'CNY' ? '¥' : '$'}${pr.monthly}`,
          cnyText: cny == null || pr.monthly === 0 ? '' : `≈ ${fmtMoney(cny, 'CNY')}/月`,
          url: pl.official_url
        }
      })

      this.setData({
        banner:
          ds.meta && ds.meta.status === 'seed-pending-review'
            ? '当前为种子数据（待人工核验），价格请以各官方页面为准'
            : ''
      })
      this.applyBoard()
      if (done) done()
    })
  },

  applyBoard() {
    const { board, priceSort } = this.data
    let rows = []
    if (board === 'plans') {
      rows = this._planRows.slice().sort((a, b) => a.sortCny - b.sortCny)
    } else if (board === 'flagship') {
      rows = this._modelRows.filter((r) => r.tier === 'flagship').sort((a, b) => a.sortOut - b.sortOut)
    } else if (board === 'tier') {
      rows = this._modelRows
        .slice()
        .sort((a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) || a.sortOut - b.sortOut)
    } else if (board === 'budget') {
      rows = this._modelRows
        .filter((r) => r.isFree || (r.outUSD != null && r.outUSD <= BUDGET_OUT_USD))
        .sort((a, b) => (b.isFree ? 1 : 0) - (a.isFree ? 1 : 0) || (a.outUSD || 0) - (b.outUSD || 0))
    } else {
      const key = priceSort === 'input' ? 'sortIn' : 'sortOut'
      rows = this._modelRows.slice().sort((a, b) => (b.isFree ? 1 : 0) - (a.isFree ? 1 : 0) || a[key] - b[key])
    }

    const metricOf = (r) =>
      board === 'plans' ? r.metric : `${r.inText} / ${r.outText}`

    this.setData({
      rows: rows.map((r, i) => ({
        ...r,
        rank: r.isFree ? '免费' : i + 1,
        tagText: board === 'tier' ? r.tierText : r.regionText,
        metric: metricOf(r)
      })),
      note: BOARD_NOTES[board]
    })
  },

  onBoardTap(e) {
    this.setData({ board: e.currentTarget.dataset.key })
    this.applyBoard()
  },

  onSortTap(e) {
    this.setData({ priceSort: e.currentTarget.dataset.key })
    this.applyBoard()
  },

  onCopy(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '官网链接已复制', icon: 'none' })
    })
  },

  // 微信扫一扫：能识别的码（含部分非微信系码的文本内容）直接走流程；
  // 微信解不出的码（fail）引导手动输入，流程同样走完，而不是无反应。
  onScan() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => this.handleScanned(res.result || ''),
      fail: (err) => {
        if (err && /cancel/i.test(err.errMsg || '')) return
        // 微信无法解码的码：给手动输入入口兜底，保证流程能走完
        wx.showModal({
          title: '该码微信无法识别',
          content: '部分非微信系二维码微信无法解码。你可以手动输入/粘贴内容（链接或文本）继续。',
          confirmText: '手动输入',
          cancelText: '取消',
          success: (m) => {
            if (m.confirm) this.showManualInput()
          }
        })
      }
    })
  },

  showManualInput() {
    wx.showModal({
      title: '手动输入',
      editable: true,
      placeholderText: '粘贴链接或二维码文本内容',
      success: (m) => {
        if (m.confirm) this.handleScanned((m.content || '').trim())
      }
    })
  },

  // 统一处理识别/输入的内容：链接 → 复制并提示；文本 → 展示并可复制
  handleScanned(content) {
    if (!content) {
      wx.showToast({ title: '内容为空', icon: 'none' })
      return
    }
    if (/^https?:\/\//i.test(content)) {
      wx.setClipboardData({
        data: content,
        success: () =>
          wx.showModal({
            title: '识别到链接',
            content: content.slice(0, 300),
            confirmText: '复制链接',
            cancelText: '关闭',
            success: (m) => {
              if (m.confirm) {
                wx.setClipboardData({ data: content })
                wx.showToast({ title: '已复制', icon: 'success' })
              }
            }
          })
      })
      return
    }
    wx.showModal({
      title: '识别结果',
      content: content.slice(0, 300),
      confirmText: '复制内容',
      cancelText: '关闭',
      success: (m) => {
        if (m.confirm) {
          wx.setClipboardData({ data: content })
          wx.showToast({ title: '已复制', icon: 'success' })
        }
      }
    })
  }
})
