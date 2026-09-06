"""汇率获取：优先 open.er-api.com（覆盖 160+ 币种，含 TRY/INR/NGN，免费无鉴权），
回退 frankfurter.app（ECB，仅 CNY 等主要币种），再回退种子默认值。
网络失败绝不让整次构建挂掉。
"""

import json
import sys
import urllib.request
from datetime import datetime, timezone

# TODO: 上线前把 UA 换成你的仓库地址或邮箱，方便站点方识别与联系
UA = {"User-Agent": "ai-radar-crawler/0.1 (data-verification; contact: set-your-email)"}

DEFAULT_FX = {
    "base": "USD",
    "rates": {
        "USD": 1.0,
        "CNY": 7.15,
        "TRY": 42.0,
        "INR": 88.0,
        "NGN": 1500.0,
        "JPY": 150.0,
        "EUR": 0.92,
    },
    "fetched_at": None,
    "source": "seed-default（离线默认值，非实时）",
}

# 需要的币种（地区订阅价格矩阵用到的）
NEEDED = ["CNY", "TRY", "INR", "NGN", "JPY", "EUR"]


def _fetch_erapi(timeout=20):
    """open.er-api.com：USD 基准，币种最全（含 NGN）。"""
    url = "https://open.er-api.com/v6/latest/USD"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.load(resp)
    if data.get("result") != "success":
        raise ValueError("er-api 响应异常")
    rates = {k: round(float(v), 4) for k, v in data["rates"].items() if k in NEEDED}
    rates["USD"] = 1.0
    return {
        "base": "USD",
        "rates": rates,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "open.er-api.com",
    }


def _fetch_frankfurter(timeout=20):
    """frankfurter.app（ECB 参考汇率）：兜底，只有主要币种。"""
    url = "https://api.frankfurter.app/latest?from=USD&to=CNY,TRY,INR,JPY,EUR"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.load(resp)
    rates = {k: round(float(v), 4) for k, v in data["rates"].items()}
    rates["USD"] = 1.0
    return {
        "base": "USD",
        "rates": rates,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "frankfurter.app (ECB 参考汇率)",
    }


def get_fx(offline=False):
    if offline:
        return dict(DEFAULT_FX)
    for fetcher in (_fetch_erapi, _fetch_frankfurter):
        try:
            return fetcher()
        except Exception as exc:
            print(f"[fx] WARN {fetcher.__name__} 失败（{exc}），尝试下一个汇率源", file=sys.stderr)
    print("[fx] WARN 全部汇率源失败，使用默认汇率", file=sys.stderr)
    return dict(DEFAULT_FX)
