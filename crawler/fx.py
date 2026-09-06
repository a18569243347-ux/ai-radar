"""汇率获取：欧洲央行参考汇率（经 frankfurter.app），美元兑人民币。
网络失败时回退到种子默认值，绝不让整次构建失败。
"""

import json
import sys
import urllib.request
from datetime import datetime, timezone

# TODO: 上线前把 UA 换成你的仓库地址或邮箱，方便站点方识别与联系
UA = {"User-Agent": "ai-radar-crawler/0.1 (data-verification; contact: set-your-email)"}

DEFAULT_FX = {
    "base": "USD",
    "rates": {"USD": 1.0, "CNY": 7.15},
    "fetched_at": None,
    "source": "seed-default（离线默认值，非实时）",
}


def _fetch(timeout=20):
    url = "https://api.frankfurter.app/latest?from=USD&to=CNY"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.load(resp)
    cny = float(data["rates"]["CNY"])
    return {
        "base": "USD",
        "rates": {"USD": 1.0, "CNY": round(cny, 4)},
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "frankfurter.app (ECB 参考汇率)",
    }


def get_fx(offline=False):
    if offline:
        return dict(DEFAULT_FX)
    try:
        return _fetch()
    except Exception as exc:
        print(f"[fx] WARN 抓取失败（{exc}），使用默认汇率 CNY=7.15", file=sys.stderr)
        return dict(DEFAULT_FX)
