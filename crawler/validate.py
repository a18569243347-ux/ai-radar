"""数据集校验（纯标准库）。返回错误列表，空列表即通过。
除了结构校验，还内置了广告法绝对化用语检查——内容红线要在构建期拦住，而不是等审核被打回。
"""

import json

CURRENCIES = {"USD", "CNY"}
TIERS = {"flagship", "mid", "lite", "reasoning", "open", "free"}
BANNED_WORDS = ["最全", "最低价", "最便宜", "第一名", "最好", "第一品牌"]


def validate(ds):
    errors = []
    for key in ("meta", "fx", "providers", "models", "plans", "free_tiers", "aggregators"):
        if key not in ds:
            errors.append(f"缺少顶层字段 {key}")
    if errors:
        return errors

    if "CNY" not in ds["fx"].get("rates", {}):
        errors.append("fx.rates 缺少 CNY")

    pids = {p.get("id") for p in ds["providers"]}
    if len(pids) != len(ds["providers"]):
        errors.append("providers.id 存在重复")

    mids = set()
    for m in ds["models"]:
        mid = m.get("id")
        mids.add(mid)
        if m.get("provider") not in pids:
            errors.append(f"model {mid}: 未知 provider")
        if m.get("tier") not in TIERS:
            errors.append(f"model {mid}: 非法 tier {m.get('tier')}")
        price = m.get("price")
        if price is not None:
            if price.get("currency") not in CURRENCIES:
                errors.append(f"model {mid}: 非法币种 {price.get('currency')}")
            for k in ("input_per_mtok", "output_per_mtok"):
                v = price.get(k)
                if not isinstance(v, (int, float)) or v < 0:
                    errors.append(f"model {mid}: {k} 非法（{v!r}）")
        if not m.get("official_url"):
            errors.append(f"model {mid}: 缺 official_url（合规要求每条价格标注官方来源）")
    if len(mids) != len(ds["models"]):
        errors.append("models.id 存在重复")

    for pl in ds["plans"]:
        if pl.get("provider") not in pids:
            errors.append(f"plan {pl.get('id')}: 未知 provider")
        pr = pl.get("price") or {}
        if pr.get("currency") not in CURRENCIES:
            errors.append(f"plan {pl.get('id')}: 非法币种")
        if not pl.get("official_url"):
            errors.append(f"plan {pl.get('id')}: 缺 official_url")

    for ft in ds["free_tiers"]:
        if not ft.get("url"):
            errors.append(f"free_tier {ft.get('id')}: 缺 url")

    for ag in ds["aggregators"]:
        if not ag.get("compliance_note"):
            errors.append(f"aggregator {ag.get('id')}: 缺 compliance_note（聚合平台必须注明授权/条款情况）")

    blob = json.dumps(ds, ensure_ascii=False)
    for w in BANNED_WORDS:
        if w in blob:
            errors.append(f"内容包含绝对化用语「{w}」（广告法风险），请修改 data/*.json")

    return errors
