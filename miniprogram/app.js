// AI雷达 —— 全网 AI 价格雷达（信息查询工具，不提供任何 AI 生成内容）
App({
  onLaunch() {
    if (!wx.cloud) return
    // TODO: 开通云开发后，把 YOUR-CLOUD-ENV 替换为你的云环境 ID（云开发控制台可查）。
    // 环境未配置/不可用时，数据层会自动回退到内置快照 miniprogram/data/dataset.js。
    try {
      wx.cloud.init({ env: 'tangs-miniapp2-d7gjdw5nh4c861713', traceUser: true })
    } catch (e) {
      console.warn('[app] 云环境初始化失败，将使用内置数据快照', e)
    }
  },
  globalData: {}
})
