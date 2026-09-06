// AI雷达 数据集 Worker：GET 下发最新数据集，POST（token 鉴权）接收 CI 推送。
// 与 crawler/sync.py 配对使用：CI 有价格变化时 POST dataset.json 到本 Worker，
// 小程序端 GET /dataset.json 即可拿到最新数据（热更新，无需提审）。
//
// 绑定要求：
//   KV namespace：binding 名为 DATASET（wrangler.toml 或控制台 Settings → Bindings）
//   环境变量/Secret：SYNC_TOKEN（与 GitHub Secrets 中的 SYNC_TOKEN 一致）

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'GET') {
      const data = await env.DATASET.get('latest', 'json')
      if (!data) {
        return new Response(JSON.stringify({ ok: false, error: 'dataset-not-imported' }), {
          status: 404,
          headers: { 'content-type': 'application/json; charset=utf-8' }
        })
      }
      return new Response(JSON.stringify(data), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, max-age=300' // 5 分钟边缘缓存，降低 KV 读次数
        }
      })
    }

    if (request.method === 'POST') {
      const token = request.headers.get('x-sync-token')
      if (!env.SYNC_TOKEN || token !== env.SYNC_TOKEN) {
        return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json; charset=utf-8' }
        })
      }
      let body
      try {
        body = await request.json()
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'bad-json' }), {
          status: 400,
          headers: { 'content-type': 'application/json; charset=utf-8' }
        })
      }
      for (const k of ['meta', 'fx', 'providers', 'models', 'plans', 'free_tiers', 'aggregators']) {
        if (!body[k]) {
          return new Response(JSON.stringify({ ok: false, error: 'missing ' + k }), {
            status: 400,
            headers: { 'content-type': 'application/json; charset=utf-8' }
          })
        }
      }
      body.imported_at = Date.now()
      await env.DATASET.put('latest', JSON.stringify(body))
      return new Response(JSON.stringify({ ok: true, imported_at: body.imported_at, models: (body.models || []).length }), {
        headers: { 'content-type': 'application/json; charset=utf-8' }
      })
    }

    return new Response(JSON.stringify({ ok: false, error: 'method-not-allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    })
  }
}
