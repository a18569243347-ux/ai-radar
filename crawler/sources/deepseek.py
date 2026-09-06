"""DeepSeek 官方定价页解析（尽力而为）。

合规实践：抓取前检查 robots.txt；每天只抓这一个定价页；自报 UA；
解析失败就保留种子数据 —— 抓取永远不能让数据变差。
页面为静态表格，每行三个数字 = 输入（缓存命中）/（缓存未命中）/ 输出（¥ / 1M tokens）。
"""

import re
import urllib.request
import urllib.robotparser
from urllib.parse import urlsplit

NAME = "deepseek"
URL = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing"
UA = {"User-Agent": "ai-radar-crawler/0.1 (data-verification; contact: set-your-email)"}
TAG = re.compile(r"<[^>]+>")
NUM = re.compile(r"[¥￥]\s*([0-9]+(?:\.[0-9]+)?)")


def _robots_allows(url):
    try:
        parts = urlsplit(url)
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"{parts.scheme}://{parts.netloc}/robots.txt")
        rp.read()
        return rp.can_fetch(UA["User-Agent"], url)
    except Exception:
        return True  # robots 不可达时按允许处理，但本爬虫每天仅访问一次定价页


def _fetch_text(timeout=25):
    req = urllib.request.Request(URL, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        html = resp.read().decode("utf-8", "replace")
    text = TAG.sub(" ", html)
    return re.sub(r"\s+", " ", text)


def _row_numbers(text, keyword, count=3):
    i = text.find(keyword)
    if i < 0:
        return None
    nums = [float(x) for x in NUM.findall(text[i:i + 800])]
    if len(nums) < count:
        return None
    nums = nums[:count]
    if not all(0 < n < 10000 for n in nums):
        return None
    return nums


def apply(dataset, ctx):
    if not _robots_allows(URL):
        return "robots.txt 不允许抓取，已保留种子数据"
    text = _fetch_text()
    updated = 0
    for model_id in ("deepseek-chat", "deepseek-reasoner"):
        nums = _row_numbers(text, model_id)
        if not nums:
            continue
        hit, miss, out = nums
        m = next((x for x in dataset["models"] if x["id"] == model_id), None)
        if not m or not m.get("price"):
            continue
        m["price"]["input_per_mtok"] = miss
        m["price"]["output_per_mtok"] = out
        m["price"]["cached_input_per_mtok"] = hit
        m["source_type"] = "auto:deepseek"
        m["fetched_at"] = ctx["now"]
        updated += 1
    if updated == 0:
        return "未能解析（页面结构可能变化），已保留种子数据"
    return f"已更新 {updated} 条（缓存命中 / 缓存未命中 / 输出）"
