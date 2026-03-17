#!/usr/bin/env python3
"""
デプロイ後スモークテスト.

各Cron WFのWebhookテストエンドポイントにPOST {test: true} し、
レスポンスを検証して結果をDiscordに通知する。
"""
import json
import os
import sys
import urllib.error
import urllib.request

# 本番環境URL（CI環境では SMOKE_TEST_URL 環境変数で上書き可能）
BASE_URL = os.environ.get(
    "SMOKE_TEST_URL", "https://yushin-n8n.duckdns.org/webhook"
)
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

ENDPOINTS = [
    {"path": "test-health-check", "name": "Health Check", "timeout": 30},
    {"path": "test-github-summary", "name": "GitHub Summary", "timeout": 30},
    {"path": "test-gmail-to-notion", "name": "Gmail to Notion", "timeout": 30},
    {"path": "test-recurring-tasks", "name": "Recurring Tasks", "timeout": 30},
    {"path": "test-shirankedo-daily", "name": "ShiranKedo Daily", "timeout": 30},
    {"path": "test-shirankedo-weekly", "name": "ShiranKedo Weekly", "timeout": 30},
]


def post_test(endpoint: dict) -> dict:
    """1つのエンドポイントにPOST test:trueし、結果を返す."""
    url = f"{BASE_URL}/{endpoint['path']}"
    body = json.dumps({"test": True}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if WEBHOOK_SECRET:
        headers["X-Webhook-Secret"] = WEBHOOK_SECRET

    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=endpoint["timeout"]) as resp:
            status = resp.status
            data = json.loads(resp.read().decode("utf-8"))
            return {"status_code": status, "body": data, "error": None}
    except urllib.error.HTTPError as e:
        return {"status_code": e.code, "body": None, "error": str(e)}
    except Exception as e:
        return {"status_code": 0, "body": None, "error": str(e)}


def verify_response(result: dict) -> bool:
    """ステータスコード200 + status:"ok" + test:trueを検証."""
    if result["status_code"] != 200:
        return False
    body = result.get("body")
    if not isinstance(body, dict):
        return False
    return body.get("status") == "ok" and body.get("test") is True


def send_discord_summary(results: list[dict]) -> None:
    """全結果をDiscord webhookに送信."""
    if not DISCORD_WEBHOOK_URL:
        print("DISCORD_WEBHOOK_URL未設定、Discord通知スキップ")
        return

    passed = sum(1 for r in results if r["ok"])
    failed = len(results) - passed
    color = 0x2ECC71 if failed == 0 else 0xE74C3C

    lines = []
    for r in results:
        icon = "\u2705" if r["ok"] else "\u274C"
        name = r["endpoint"]["name"]
        if r["ok"]:
            lines.append(f"{icon} {name}")
        else:
            error = r["result"].get("error") or f"HTTP {r['result']['status_code']}"
            lines.append(f"{icon} {name}: {error}")

    embed = {
        "title": f"Smoke Test: {passed}/{len(results)} passed",
        "description": "\n".join(lines),
        "color": color,
    }
    payload = json.dumps({"embeds": [embed]}).encode("utf-8")
    req = urllib.request.Request(
        DISCORD_WEBHOOK_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f"Discord通知失敗: {e}", file=sys.stderr)


def main() -> int:
    """スモークテストを実行し、結果を返す."""
    results = []
    for ep in ENDPOINTS:
        print(f"Testing {ep['name']}...", end=" ", flush=True)
        result = post_test(ep)
        ok = verify_response(result)
        print("OK" if ok else f"FAIL ({result.get('error') or result['status_code']})")
        results.append({"endpoint": ep, "result": result, "ok": ok})

    send_discord_summary(results)

    failures = [r for r in results if not r["ok"]]
    if failures:
        print(f"\n{len(failures)} endpoint(s) failed", file=sys.stderr)
        return 1
    print(f"\nAll {len(results)} endpoints passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
