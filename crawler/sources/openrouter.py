"""OpenRouter 公开模型列表 API（https://openrouter.ai/api/v1/models，无需鉴权）。

两个用途：
1) 更新聚合平台 OpenRouter 的价格展示（aggregators[].prices）；
2) 把 OpenRouter 价格与种子里的官方价交叉核对，超出容差即写入 meta.drift_report，
   提醒人工复核官方价是否变动（OpenRouter 价格 ≈ 官方价 + 约 5% 服务费）。
"""

import json
import urllib.request

NAME = "openrouter"
API = "https://openrouter.ai/api/v1/models"
UA = {"User-Agent": "ai-radar-crawler/0.1 (data-verification; contact: set-your-email)"}
DRIFT_TOLERANCE = 0.25

# 本库 model id -> OpenRouter model id（只映射需要比价/展示的条目）
# 注意：映射目标若在 OpenRouter 下架会自动跳过；新增模型时同步补这里
MAPPING = {
    "openai-gpt-6-astra": "openai/gpt-6-astra",
    "openai-gpt-5-6-sol": "openai/gpt-5.6-sol",
    "openai-gpt-5-6-terra": "openai/gpt-5.6-terra",
    "openai-gpt-5-6-luna": "openai/gpt-5.6-luna",
    "openai-gpt-5": "openai/gpt-5",
    "anthropic-claude-fable-5-1": "anthropic/claude-fable-5.1",
    "anthropic-claude-opus-5": "anthropic/claude-opus-5",
    "anthropic-claude-sonnet-5": "anthropic/claude-sonnet-5",
    "anthropic-claude-haiku-4-5": "anthropic/claude-haiku-4.5",
    "anthropic-claude-sonnet-4-5": "anthropic/claude-sonnet-4.5",
    "google-gemini-3-1-pro": "google/gemini-3.1-pro-preview",
    "google-gemini-3-8-flash": "google/gemini-3.8-flash",
    "google-gemini-3-5-flash-lite": "google/gemini-3.5-flash-lite",
    "google-gemini-2-5-pro": "google/gemini-2.5-pro",
    "xai-grok-4-5": "x-ai/grok-4.5",
    "xai-grok-4-20": "x-ai/grok-4.20",
    "mistral-large-2512": "mistralai/mistral-large-2512",
    "deepseek-v4-pro": "deepseek/deepseek-v4-pro-0813",
    "deepseek-v4-flash": "deepseek/deepseek-v4-flash-0731",
    "deepseek-chat": "deepseek/deepseek-v3.2",
    "moonshot-kimi-k2-5": "moonshotai/kimi-k2.5",
    "moonshot-kimi-k2-0905": "moonshotai/kimi-k2-0905",
    "zhipu-glm-5-3": "z-ai/glm-5.3",
    "zhipu-glm-5-3-flash": "z-ai/glm-5.3-flash",
    "zhipu-glm-5": "z-ai/glm-5",
    "zhipu-glm-4-6": "z-ai/glm-4.6",
    "aliyun-qwen3-8-max": "qwen/qwen3.8-max-0902",
    "aliyun-qwen3-6-plus": "qwen/qwen3.6-plus",
    "aliyun-qwen3-7-flash": "qwen/qwen3.7-flash",
    "minimax-m3": "minimax/minimax-m3",
    "minimax-m2-7": "minimax/minimax-m2.7",
}


def _fetch_models(timeout=30):
    req = urllib.request.Request(API, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)["data"]


def _usd_per_mtok(v):
    """OpenRouter 返回的是 USD per token 的字符串，换算成 per 1M tokens。"""
    try:
        return float(v) * 1_000_000
    except (TypeError, ValueError):
        return None


def apply(dataset, ctx):
    models = {m["id"]: m for m in dataset["models"]}
    fx_cny = ctx["fx"]["rates"]["CNY"]
    rows = _fetch_models()
    by_id = {r.get("id"): r for r in rows}

    prices, drift = [], []
    for ours, orid in MAPPING.items():
        r = by_id.get(orid)
        if not r:
            continue
        p = r.get("pricing") or {}
        pin, pout = _usd_per_mtok(p.get("prompt")), _usd_per_mtok(p.get("completion"))
        if pin is None or pout is None:
            continue
        prices.append({
            "model_id": ours,
            "name": r.get("name", orid),
            "prompt_per_mtok_usd": round(pin, 4),
            "completion_per_mtok_usd": round(pout, 4),
        })
        m = models.get(ours)
        if m and m.get("price"):
            c = m["price"]["currency"]
            k = fx_cny if c == "CNY" else 1.0
            off_in = m["price"]["input_per_mtok"] / k
            off_out = m["price"]["output_per_mtok"] / k
            for label, off, orp in (("input", off_in, pin), ("output", off_out, pout)):
                if off and orp and abs(orp - off) / max(off, 1e-9) > DRIFT_TOLERANCE:
                    drift.append({
                        "model_id": ours,
                        "field": label,
                        "official_usd": round(off, 4),
                        "openrouter_usd": round(orp, 4),
                    })

    for ag in dataset["aggregators"]:
        if ag.get("auto_source") == "openrouter_api":
            ag["prices"] = prices
            ag["prices_fetched_at"] = ctx["now"]

    dataset["meta"]["drift_report"] = drift
    return f"{len(prices)} 个模型价格已同步，{len(drift)} 条与官方价偏差超 {int(DRIFT_TOLERANCE * 100)}%（见 meta.drift_report）"
