#!/usr/bin/env python3
"""Uptime Kuma 初回 monitor 一括登録スクリプト（冪等）.

既に同名の monitor が存在する場合はスキップし、新規分のみ追加する。
Push monitor の pushToken は ~/.kuma/push-urls.json に保存し、
crypto-ai-trader / n8n の heartbeat 送信実装で参照する。

実行（OCI 上、Kuma と同ホスト）:
    cd ~/n8n-server
    uv run --with uptime-kuma-api python scripts/kuma_bootstrap_monitors.py

認証情報: ~/.kuma/credentials.json {"username":"...","password":"..."}
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import sys
from pathlib import Path

from uptime_kuma_api import MonitorType, UptimeKumaApi  # type: ignore[import-not-found]

CREDENTIALS_PATH = Path.home() / ".kuma" / "credentials.json"
PUSH_URLS_PATH = Path.home() / ".kuma" / "push-urls.json"

# 監視対象定義。冪等性のため name は不変キー。
MONITORS: list[dict] = [
    {
        "name": "crypto-ai-trader heartbeat",
        "type": MonitorType.PUSH,
        "interval": 300,
        "maxretries": 0,
    },
    {
        "name": "n8n heartbeat",
        "type": MonitorType.PUSH,
        "interval": 300,
        "maxretries": 0,
    },
    {
        "name": "n8n HTTP",
        "type": MonitorType.HTTP,
        "url": "https://yushin-n8n.duckdns.org/",
        "interval": 300,
        "maxretries": 1,
    },
    {
        "name": "swipe-persona-api",
        "type": MonitorType.HTTP,
        "url": "https://swipe-persona-api.y-fudo.workers.dev/health",
        "interval": 300,
        "maxretries": 1,
    },
    {
        "name": "worldpulse-api",
        "type": MonitorType.HTTP,
        "url": "https://worldpulse-api.y-fudo.workers.dev/health",
        "interval": 300,
        "maxretries": 1,
    },
    {
        "name": "worldpulse-front",
        "type": MonitorType.HTTP,
        "url": "https://worldpulse.pages.dev/",
        "interval": 300,
        "maxretries": 1,
    },
    {
        "name": "shirankedo",
        "type": MonitorType.HTTP,
        "url": "https://shirankedo.y-fudo.workers.dev/",
        "interval": 300,
        "maxretries": 1,
    },
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--kuma-url",
        default=os.getenv("KUMA_URL", "http://127.0.0.1:3001"),
        help="Kuma の WebSocket 接続先（OCI 同居なら 127.0.0.1:3001）",
    )
    args = parser.parse_args()

    if not CREDENTIALS_PATH.exists():
        print(
            f"ERROR: {CREDENTIALS_PATH} が無い。下記の手順で作成してください:\n"
            "  mkdir -p ~/.kuma && "
            'read -s -p "user: " U && read -s -p "pass: " P && '
            'printf \'{"username":"%s","password":"%s"}\\n\' "$U" "$P" '
            "> ~/.kuma/credentials.json && chmod 600 ~/.kuma/credentials.json && unset U P",
            file=sys.stderr,
        )
        return 1

    creds = json.loads(CREDENTIALS_PATH.read_text(encoding="utf-8"))
    api = UptimeKumaApi(args.kuma_url)
    try:
        api.login(creds["username"], creds["password"])
        existing = {m["name"]: m for m in api.get_monitors()}
        push_tokens: dict[str, str] = {}
        if PUSH_URLS_PATH.exists():
            push_tokens = json.loads(PUSH_URLS_PATH.read_text(encoding="utf-8"))

        for spec in MONITORS:
            name = spec["name"]
            mid: int | None = None
            if name in existing:
                print(f"skip (exists): {name}")
                mid = existing[name]["id"]
            else:
                print(f"add:           {name}")
                try:
                    r = api.add_monitor(**spec)
                    mid = r.get("monitorID")
                    if mid is None:
                        print(
                            f"  ERROR: monitorID 取得失敗 ({name}): response={r}",
                            file=sys.stderr,
                        )
                        continue
                    existing[name] = api.get_monitor(mid)
                except Exception as e:
                    print(f"  ERROR: add_monitor 失敗 ({name}): {e}", file=sys.stderr)
                    continue

            if spec["type"] == MonitorType.PUSH and mid is not None:
                try:
                    mon = api.get_monitor(mid)
                    token = mon.get("pushToken") or mon.get("push_token")
                    if token:
                        push_tokens[name] = token
                except Exception as e:
                    print(
                        f"  WARN: push_token 取得失敗 ({name}): {e}",
                        file=sys.stderr,
                    )

        PUSH_URLS_PATH.parent.mkdir(parents=True, exist_ok=True)
        PUSH_URLS_PATH.write_text(
            json.dumps(push_tokens, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        # token 自体は秘匿性中（誰でも heartbeat を送れるが致命的ではない）
        # 念のため 600 に
        PUSH_URLS_PATH.chmod(0o600)
        print(f"\nPush tokens saved: {PUSH_URLS_PATH}")
        for name, tok in push_tokens.items():
            print(f"  {name}: {args.kuma_url.rstrip('/')}/api/push/{tok}")
    finally:
        with contextlib.suppress(Exception):
            api.disconnect()

    return 0


if __name__ == "__main__":
    sys.exit(main())
