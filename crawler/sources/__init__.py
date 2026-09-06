"""抓取源注册表。每个源实现 `NAME` 与 `apply(dataset, ctx)`，失败只记 note、绝不弄脏数据。
新增源：在本目录建模块，然后加进 SOURCES 列表即可。
"""

from crawler.sources import deepseek, openrouter

SOURCES = [openrouter, deepseek]


def run_sources(dataset, ctx):
    notes = []
    for src in SOURCES:
        if ctx.get("offline"):
            notes.append(f"{src.NAME}: offline 模式跳过")
            continue
        try:
            notes.append(f"{src.NAME}: {src.apply(dataset, ctx)}")
        except Exception as exc:  # 任何抓取失败都回退种子数据
            notes.append(f"{src.NAME}: 抓取失败，保留种子数据（{type(exc).__name__}: {exc}）")
    return notes
