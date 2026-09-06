const { getDataset, providerMap } = require('../../utils/dataService')

Page({
  data: {
    meta: null,
    fx: null,
    sources: [],
    version: '',
    statusText: '',
    dataSource: ''
  },

  onLoad() {
    this.render()
  },

  render() {
    getDataset().then((ds) => {
      const pmap = providerMap(ds)
      const sources = (ds.providers || []).map((p) => ({
        id: p.id,
        name: p.name,
        url: p.pricing_url
      }))
      const status = (ds.meta && ds.meta.status) || ''
      this.setData({
        meta: ds.meta || {},
        fx: ds.fx || null,
        sources,
        version: (ds.meta && ds.meta.dataset_version) || '—',
        statusText:
          status === 'seed-pending-review' ? '种子数据（待人工核验）' : '已核验',
        dataSource:
          ds._source === 'cloud'
            ? '云端数据'
            : ds._source === 'worker'
              ? 'Workers 数据'
              : '内置快照'
      })
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
