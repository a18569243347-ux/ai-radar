const { getDataset, providerMap } = require('../../utils/dataService')
const { toCNY, toUSD, fmtMoney, tierLabel } = require('../../utils/format')
const bundled = require('../../data/dataset.js')

const BOARDS = [
  { key: 'price', label: '价格榜' },
  { key: 'deepseek', label: 'DeepSeek本位榜' },
  { key: 'flagship', label: '旗舰档横评' },
  { key: 'tier', label: '档位定位榜' },
  { key: 'plans', label: '订阅价格榜' },
  { key: 'budget', label: '低价榜' }
]
const SORTS = [
  { key: 'output', label: '按输出价' },
  { key: 'input', label: '按输入价' }
]
const TIER_ORDER = { flagship: 0, reasoning: 1, mid: 2, lite: 3, open: 4, free: 5 }
const BUDGET_OUT_USD = 0.5

const BOARD_NOTES = {
  price: '按每百万 tokens 价格升序；开源权重模型无官方定价，未参与排序',
  deepseek: '以 DeepSeek V4 Flash (max·0731) 为基准（性价比=1.0），按「arena 跑分 ÷ 归一化价格」相对值降序；跑分源自 Artificial Analysis Intelligence Index，种子待核验。归一化价格 = (输入+输出)/2 折人民币。底部「无公开跑分」型号未参与排名，原因见各型号标注',
  flagship: '旗舰档 = 各厂商官方最高定位档，按输出价升序',
  tier: '档位为厂商官方定位：旗舰 → 推理 → 主力 → 轻量 → 开源',
  plans: '订阅月费换算人民币升序；以各官方页面为准',
  budget: '收录输出价 ≤ $0.5/百万 tokens 的低价档，按输出价升序'
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
  _scores: {},
  _excluded: [],

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

      // 云端 models 可能是旧快照（缺新模型），用内置 bundle 补齐缺失的模型条目，
      // 保证 DeepSeek 本位榜的基准模型和有分数模型都能找到。以 id 去重，云端优先。
      const cloudModels = (ds.models || [])
      const bundledModels = (bundled.models || []).filter((bm) => !cloudModels.some((cm) => cm.id === bm.id))
      const allModels = cloudModels.concat(bundledModels)

      this._modelRows = allModels
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

      this._scores = {}
      this._excluded = []
      // 云端 benchmarks.scores 异常为空时，用内置 bundle 兜底（跑分数据本就源自本地 data/benchmarks.json，
      // 云端只是镜像；云端链路不稳时直接用内置值，保证 DeepSeek 本位榜可用）
      const cloudBm = (ds.benchmarks && Array.isArray(ds.benchmarks.scores) && ds.benchmarks.scores.length > 0)
        ? ds.benchmarks
        : (bundled.benchmarks || {})
      ;(((cloudBm || {}).scores) || []).forEach((s) => {
        if (s.model_id != null && s.arena_score != null) this._scores[s.model_id] = s.arena_score
      })
      this._excluded = (((cloudBm || {}).excluded) || []).map((e) => ({
        model_id: e.model_id,
        reason: e.reason
      }))

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
    let baseRow = null
    if (board === 'plans') {
      rows = this._planRows.filter((r) => !r.isFree).slice().sort((a, b) => a.sortCny - b.sortCny)
    } else if (board === 'deepseek') {
      const BASE_ID = 'deepseek-v4-flash-max-20260731'
      baseRow = this._modelRows.find((r) => r.id === BASE_ID)
      const baseScore = this._scores[BASE_ID]
      const ranked =
        baseRow && baseScore != null
          ? this._modelRows
              .filter((r) => !r.isFree && this._scores[r.id] != null)
              .map((r) => {
                const score = this._scores[r.id]
                const blended = (r.sortIn + r.sortOut) / 2
                const baseBlended = (baseRow.sortIn + baseRow.sortOut) / 2
                return { ...r, score, blended, idx: score / baseScore / (blended / baseBlended) }
              })
              .sort((a, b) => b.idx - a.idx)
          : []
      const excludedIds = new Set(this._excluded.map((e) => e.model_id))
      const rankedIds = new Set(ranked.map((r) => r.id))
      const excludedRows = this._modelRows
        .filter((r) => !r.isFree && !rankedIds.has(r.id) && excludedIds.has(r.id))
        .map((r) => {
          const ex = this._excluded.find((e) => e.model_id === r.id)
          return { ...r, excludedReason: ex ? ex.reason : '无公开跑分', excluded: true }
        })
      rows = ranked.concat(excludedRows)
    } else if (board === 'flagship') {
      rows = this._modelRows.filter((r) => r.tier === 'flagship' && !r.isFree).sort((a, b) => a.sortOut - b.sortOut)
    } else if (board === 'tier') {
      rows = this._modelRows
        .filter((r) => r.tier !== 'free' && !r.isFree)
        .slice()
        .sort((a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) || a.sortOut - b.sortOut)
    } else if (board === 'budget') {
      rows = this._modelRows
        .filter((r) => !r.isFree && r.outUSD != null && r.outUSD <= BUDGET_OUT_USD)
        .sort((a, b) => (a.outUSD || 0) - (b.outUSD || 0))
    } else {
      const key = priceSort === 'input' ? 'sortIn' : 'sortOut'
      rows = this._modelRows.filter((r) => !r.isFree).slice().sort((a, b) => a[key] - b[key])
    }

    const metricOf = (r) => {
      if (board === 'plans') return r.metric
      if (board === 'deepseek') {
        if (r.excluded) return '无公开跑分'
        return `${r.idx.toFixed(2)}x · Arena ${r.score}`
      }
      return `${r.inText} / ${r.outText}`
    }

    const baseId = baseRow ? baseRow.id : null

    this.setData({
      rows: rows.map((r, i) => ({
        ...r,
        rank: r.excluded ? '—' : i + 1,
        tagText: board === 'tier' || board === 'deepseek' ? (r.excluded && r.excludedReason ? r.excludedReason : r.tierText) : r.regionText,
        metric: metricOf(r),
        isBase: board === 'deepseek' && r.id === baseId
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
  }
})
