"""把构建好的数据集推送到云开发 importData 云函数（HTTP 访问服务）。

环境变量：
  CLOUD_IMPORT_URL  云开发「HTTP 访问服务」里绑定 importData 函数的触发 URL
  SYNC_TOKEN        与云函数环境变量 SYNC_TOKEN 一致的鉴权 token

用法：python -m crawler.sync
"""

import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATASET = ROOT / "dist" / "dataset.json"
CHANGED_MARKER = ROOT / "dist" / ".changed"


def main():
    if not CHANGED_MARKER.exists():
        print("skip: 数据无实际变化（crawl 未生成 dist/.changed），不同步云端")
        return
    url = os.environ.get("CLOUD_IMPORT_URL")
    token = os.environ.get("SYNC_TOKEN")
    if not url or not token:
        print("skip: 未配置 CLOUD_IMPORT_URL / SYNC_TOKEN 环境变量", file=sys.stderr)
        sys.exit(2)
    if not DATASET.exists():
        print(f"error: 数据集不存在，请先运行 python -m crawler.crawl（{DATASET}）", file=sys.stderr)
        sys.exit(1)

    req = urllib.request.Request(
        url,
        data=DATASET.read_bytes(),
        method="POST",
        headers={"Content-Type": "application/json", "x-sync-token": token},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        print(resp.status, resp.read().decode("utf-8", "replace"))


if __name__ == "__main__":
    main()
