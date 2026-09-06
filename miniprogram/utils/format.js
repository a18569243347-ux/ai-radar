// 金额格式化与币种换算（所有价格统一为「每百万 tokens」口径）
const DEFAULT_CNY = 7.15

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

// 小额价格（如 $0.005）需要保留足够精度：按 3 位有效数字动态取整
function fmtMoney(v, currency) {
  if (v == null) return '—'
  const sym = currency === 'CNY' ? '¥' : '$'
  if (v === 0) return sym + '0'
  let n = v >= 100 ? v.toFixed(0) : v.toPrecision(3)
  return sym + String(parseFloat(n))
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

module.exports = { toCNY, toUSD, fmtMoney, tierLabel }
