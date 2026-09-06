// 金额格式化与币种换算（API 价格统一为「每百万 tokens」口径；地区订阅价为当地原币月价）
const DEFAULT_CNY = 7.15

const SYMBOLS = {
  USD: '$',
  CNY: '¥',
  TRY: '₺',
  INR: '₹',
  NGN: '₦',
  JPY: '¥',
  EUR: '€'
}

function cnyRate(fx) {
  return (fx && fx.rates && fx.rates.CNY) || DEFAULT_CNY
}

function toCNY(amount, currency, fx) {
  if (amount == null) return null
  return currency === 'CNY' ? amount : amount * cnyRate(fx)
}

function toUSD(amount, currency, fx) {
  if (amount == null) return null
  return currency === 'USD' ? amount : amount / cnyRate(fx)
}

// 通用换算：amount 个 from 币种 → to 币种。汇率缺失时返回 null（由调用方显示「—」并排到最后）
function convert(amount, from, to, fx) {
  if (amount == null || from == null || to == null) return null
  if (from === to) return amount
  const rates = (fx && fx.rates) || {}
  const rFrom = rates[from] != null ? rates[from] : from === 'USD' ? 1 : null
  const rTo = rates[to] != null ? rates[to] : to === 'USD' ? 1 : null
  if (!rFrom || !rTo) return null
  return (amount / rFrom) * rTo
}

// 小额价格（如 $0.005）需要保留足够精度：按 3 位有效数字动态取整
function fmtMoney(v, currency) {
  if (v == null) return '—'
  const sym = currency === 'CNY' ? '¥' : '$'
  if (v === 0) return sym + '0'
  let n = v >= 100 ? v.toFixed(0) : v.toPrecision(3)
  return sym + String(parseFloat(n))
}

// 当地原币展示：按币种选符号，整数位千分位分隔（₦31,500 这类大额更易读）
function fmtLocal(amount, currency) {
  if (amount == null) return '—'
  const sym = SYMBOLS[currency] || currency + ' '
  const s = Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return sym + s
}

const TIER_TEXT = {
  flagship: '旗舰',
  mid: '主力',
  lite: '轻量',
  reasoning: '推理',
  open: '开源权重',
  free: '免费'
}

function tierLabel(tier) {
  return TIER_TEXT[tier] || tier || ''
}

module.exports = { toCNY, toUSD, convert, fmtMoney, fmtLocal, tierLabel }
