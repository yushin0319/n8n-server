"""cron WF の Schedule 直後に PingHealthchecks (HTTP Request) ノードを冪等に挿入する。

目的 (A7): cron WF の Schedule トリガーが発火したことを Healthchecks.io に ping し、
期待時刻に ping が来なければリアルタイムで Discord 通知を発火させる。

設計:
- 各 cron WF (workflows/cron-*.json) の Schedule トリガー直後に
  HTTP Request ノードを直列挿入する。
- URL: https://hc-ping.com/{{ $env.HC_PING_KEY }}/{slug}
  slug = WF 名から "cron/" を除去したもの (cron/system-heartbeat → system-heartbeat)
- WebhookTest (test mode 起動) 経由の path には ping を入れない (Schedule 起点と分離されているため)
- onError=continueRegularOutput で ping 失敗時もメインフロー継続
- 既に PingHealthchecks ノードがある WF はスキップ (冪等)

CLI:
    python scripts/inject_healthchecks_ping.py            # 実行
    python scripts/inject_healthchecks_ping.py --dry-run  # 差分のみ表示
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WF_DIR = REPO_ROOT / "workflows"
SCHED_TYPE = "n8n-nodes-base.scheduleTrigger"
PING_NODE_NAME = "PingHealthchecks"


def build_ping_node(slug: str, sched_position: list[int], node_id: str) -> dict:
    # n8n の expression として評価させるため URL は "=" プレフィックスが必須
    return {
        "parameters": {
            "method": "GET",
            "url": f"=https://hc-ping.com/{{{{ $env.HC_PING_KEY }}}}/{slug}",
            "options": {
                "timeout": 5000,
            },
            "onError": "continueRegularOutput",
        },
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [sched_position[0] + 200, sched_position[1]],
        "name": PING_NODE_NAME,
        "id": node_id,
        "retryOnFail": True,
        "maxTries": 2,
        "waitBetweenTries": 3000,
    }


def process_workflow(wf_path: Path, dry_run: bool) -> str:
    """1 つの cron WF を処理し、結果（"create" / "noop" / "skip:xxx"）を返す。"""
    with wf_path.open(encoding="utf-8") as fp:
        d = json.load(fp)

    name = d.get("name", "")
    if not name.startswith("cron/"):
        return "skip:not-cron"

    nodes = d.get("nodes", [])
    sched_node = next((n for n in nodes if n.get("type") == SCHED_TYPE), None)
    if sched_node is None:
        return "skip:no-schedule"
    sched_name = sched_node["name"]

    slug = name.removeprefix("cron/")
    node_id = f"hc-ping-{slug[:30]}"
    new_ping_node = build_ping_node(slug, sched_node["position"], node_id)

    existing_ping = next((n for n in nodes if n.get("name") == PING_NODE_NAME), None)
    if existing_ping is not None:
        # 既存 PingHealthchecks があれば parameters / id を上書き（接続はそのまま）
        if existing_ping.get("parameters") == new_ping_node["parameters"]:
            return "noop:up-to-date"
        if dry_run:
            return f"update:{slug}"
        existing_ping["parameters"] = new_ping_node["parameters"]
        with wf_path.open("w", encoding="utf-8") as fp:
            json.dump(d, fp, indent=2, ensure_ascii=False)
            fp.write("\n")
        return f"update:{slug}"

    sched_conns = d.get("connections", {}).get(sched_name, {}).get("main", [])
    if not sched_conns or not sched_conns[0]:
        return "skip:schedule-has-no-downstream"
    original_targets = sched_conns[0]

    if dry_run:
        return f"create:{slug}"

    d.setdefault("nodes", []).append(new_ping_node)
    d.setdefault("connections", {})[sched_name] = {
        "main": [[{"node": PING_NODE_NAME, "type": "main", "index": 0}]],
    }
    d["connections"][PING_NODE_NAME] = {
        "main": [original_targets],
    }

    with wf_path.open("w", encoding="utf-8") as fp:
        json.dump(d, fp, indent=2, ensure_ascii=False)
        fp.write("\n")

    return f"create:{slug}"


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    wf_paths = sorted(WF_DIR.glob("cron-*.json"))
    if not wf_paths:
        print("no cron-*.json found")
        sys.exit(1)

    summary: dict[str, int] = {}
    for p in wf_paths:
        result = process_workflow(p, args.dry_run)
        head = result.split(":", 1)[0]
        summary[head] = summary.get(head, 0) + 1
        print(f"  [{head:8}] {p.name}: {result}")

    print(f"\nsummary ({'dry-run' if args.dry_run else 'applied'}):")
    for k, v in sorted(summary.items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
