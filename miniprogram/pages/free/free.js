const { getDataset, providerMap } = require('../../utils/dataService')

const TYPE_ORDER = ['免费模型', '免费额度', '新用户赠送', '免费App']

Page({
  data: {
    loading: true,
    groups: []
  },

  onLoad() {
    this.render()
  },

  onPullDownRefresh() {
    // 强制绕过缓存重新查云端
    this.render({ fresh: true, done: () => wx.stopPullDownRefresh() })
  },

  render({ fresh = false, done } = {}) {
    getDataset({ fresh }).then((ds) => {
      const pmap = providerMap(ds)
      const items = (ds.free_tiers || []).map((ft) => ({
        id: ft.id,
        name: ft.name,
        provider: (pmap[ft.provider] || {}).name || ft.provider,
        type: ft.type,
        detail: ft.detail,
        url: ft.url
      }))
      const groups = TYPE_ORDER.map((t) => ({
        type: t,
        list: items.filter((x) => x.type === t)
      })).filter((g) => g.list.length)
      this.setData({ loading: false, groups })
      if (done) done()
    })
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
