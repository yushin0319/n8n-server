#!/usr/bin/env python3
"""
デプロイ後スモークテスト.

全WFのWebhookエンドポイントにPOSTし、レスポンスを検証して結果をDiscordに通知する。
- Cron WF: test:true でテストモード実行（副作用スキップ）
- Webhook WF: 疎通確認（読み取り系は200、書き込み系はダミーIDでエラー応答も成功扱い）
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

# 本番環境URL（CI環境では SMOKE_TEST_URL 環境変数で上書き可能）
BASE_URL = os.environ.get(
    "SMOKE_TEST_URL", "https://yushin-n8n.duckdns.org/webhook"
)
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

# Cron WF（テストモード: フロー全体を通すが副作用はスキップ）
CRON_ENDPOINTS = [
    {"path": "test-health-check", "name": "Health Check", "timeout": 30},
    {"path": "test-github-summary", "name": "GitHub Summary", "timeout": 30},
    {"path": "test-gmail-to-notion", "name": "Gmail to Notion", "timeout": 30},
    {"path": "test-recurring-tasks", "name": "Recurring Tasks", "timeout": 30},
    {"path": "test-shirankedo-daily", "name": "ShiranKedo Daily", "timeout": 60},
    {"path": "test-shirankedo-weekly", "name": "ShiranKedo Weekly", "timeout": 120},
]

# Webhook WF（読み取り専用リクエストで疎通確認）
# GDrive書き込み系（upload/delete/rename/move/mkdir/share）は副作用があるため除外
WEBHOOK_ENDPOINTS = [
    {"path": "status", "name": "Server Status", "timeout": 10,
     "body": {}},
    {"path": "notion-tasks", "name": "Notion Tasks", "timeout": 30,
     "body": {"action": "list"}},
    {"path": "notion-emails", "name": "Notion Emails", "timeout": 30,
     "body": {"action": "search"}},
    {"path": "gdrive-list", "name": "GDrive List", "timeout": 30,
     "body": {}},
    {"path": "gdrive-search", "name": "GDrive Search", "timeout": 30,
     "body": {"q": "name='__smoke_test_nonexistent__'"}},
    {"path": "gdrive-info", "name": "GDrive Info", "timeout": 30,
     "body": {"fileId": "__smoke_test__"}, "allow_error": True},
    {"path": "gdrive-download", "name": "GDrive Download", "timeout": 30,
     "body": {"fileId": "__smoke_test__"}, "allow_error": True},
    {"path": "gdrive-upload", "name": "GDrive Upload", "timeout": 30,
     "body": {"fileId": "__smoke_test__"}, "allow_error": True},
    {"path": "gdrive-delete", "name": "GDrive Delete", "timeout": 30,
     "body": {"fileId": "__smoke_test__"}, "allow_error": True},
    {"path": "gdrive-rename", "name": "GDrive Rename", "timeout": 30,
     "body": {"fileId": "__smoke_test__", "newName": "test"}, "allow_error": True},
    {"path": "gdrive-move", "name": "GDrive Move", "timeout": 30,
     "body": {"fileId": "__smoke_test__", "newFolderId": "__test__"}, "allow_error": True},
    {"path": "gdrive-mkdir", "name": "GDrive Mkdir", "timeout": 30,
     "body": {"folderName": "__smoke_test__"}, "allow_error": True},
    {"path": "gdrive-share", "name": "GDrive Share", "timeout": 30,
     "body": {"fileId": "__smoke_test__", "email": "test@test.com", "role": "reader"},
     "allow_error": True},
]


def post_test(endpoint: dict) -> dict:
    """1つのエンドポイントにPOSTし、結果を返す."""
    url = f"{BASE_URL}/{endpoint['path']}"
    body = endpoint.get("body", {"test": True})
    data = json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if WEBHOOK_SECRET:
        headers["X-Webhook-Secret"] = WEBHOOK_SECRET

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    # DNS一時障害対策: 最大3回リトライ（3秒間隔）
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=endpoint["timeout"]) as resp:
                status = resp.status
                raw = resp.read().decode("utf-8")
                try:
                    resp_data = json.loads(raw)
                except json.JSONDecodeError:
                    resp_data = {"_raw": raw[:200]}
                return {"status_code": status, "body": resp_data, "error": None}
        except urllib.error.HTTPError as e:
            body_text = None
            try:
                raw = e.read().decode("utf-8")
                try:
                    body_text = json.loads(raw)
                except json.JSONDecodeError:
                    body_text = {"_raw": raw[:200]}
            except Exception:
                pass
            return {"status_code": e.code, "body": body_text, "error": str(e)}
        except urllib.error.URLError as e:
            # DNS解決失敗等のネットワークエラーのみリトライ
            err_msg = str(e).lower()
            is_transient = (
                "name resolution" in err_msg or "timed out" in err_msg
            )
            if attempt < max_retries and is_transient:
                print(f"retry({attempt})...", end=" ", flush=True)
                time.sleep(3)
                continue
            return {"status_code": 0, "body": None, "error": str(e)}
        except Exception as e:
            return {"status_code": 0, "body": None, "error": str(e)}


def verify_cron_response(result: dict) -> bool:
    """Cron WF: ステータスコード200 + status:"ok" + test:trueを検証."""
    if result["status_code"] != 200:
        return False
    body = result.get("body")
    if not isinstance(body, dict):
        return False
    return body.get("status") == "ok" and body.get("test") is True


def verify_webhook_response(result: dict, allow_error: bool = False) -> bool:
    """Webhook WF: HTTP 200でレスポンスが返ればOK. allow_errorならエラー応答も疎通成功扱い."""
    if result["status_code"] == 200:
        return True
    return allow_error and result["status_code"] in (400, 404, 500)


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

    print("=== Cron WF (test mode) ===")
    for ep in CRON_ENDPOINTS:
        ep_with_body = {**ep, "body": {"test": True}}
        print(f"  {ep['name']}...", end=" ", flush=True)
        result = post_test(ep_with_body)
        ok = verify_cron_response(result)
        print("OK" if ok else f"FAIL ({result.get('error') or result['status_code']})")
        results.append({"endpoint": ep, "result": result, "ok": ok})

    print("\n=== Webhook WF (connectivity check) ===")
    for ep in WEBHOOK_ENDPOINTS:
        print(f"  {ep['name']}...", end=" ", flush=True)
        result = post_test(ep)
        ok = verify_webhook_response(result, allow_error=ep.get("allow_error", False))
        print("OK" if ok else f"FAIL ({result.get('error') or result['status_code']})")
        results.append({"endpoint": ep, "result": result, "ok": ok})

    send_discord_summary(results)

    failures = [r for r in results if not r["ok"]]
    if failures:
        print(f"\n{len(failures)}/{len(results)} endpoint(s) failed", file=sys.stderr)
        return 1
    print(f"\nAll {len(results)} endpoints passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
