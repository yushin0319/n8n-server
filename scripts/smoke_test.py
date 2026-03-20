#!/usr/bin/env python3
"""
デプロイ後スモークテスト.

全WFのWebhookエンドポイントにPOSTし、レスポンスを検証して結果をDiscordに通知する。
- Cron WF: test:true でテストモード実行（副作用スキップ）
- Webhook WF: 疎通確認（読み取り系は200、書き込み系はダミーIDでエラー応答も成功扱い）

使い方:
    python smoke_test.py                     # 全エンドポイントをテスト
    python smoke_test.py --only-file FILE    # FILEに記載されたWFのみテスト
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

# 本番環境URL（CI環境では SMOKE_TEST_URL 環境変数で上書き可能）
BASE_URL = os.environ.get("SMOKE_TEST_URL", "https://yushin-n8n.duckdns.org/webhook")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

# wf: 対応するワークフローJSONファイル名（フィルタ用）

# WFファイル名 → エンドポイントのマッピングを自動生成
# (wf_file_base, webhook_path_suffix, timeout)
_CRON_WFS = [
    ("cron-health-check", "health-check", 30),
    ("cron-recurring-tasks", "recurring-tasks", 30),
    ("cron-shirankedo-daily-articles", "shirankedo-daily-articles", 60),
    ("cron-shirankedo-daily-vulns", "shirankedo-daily-vulns", 60),
    ("cron-shirankedo-daily-releases", "shirankedo-daily-releases", 120),
    ("cron-shirankedo-daily-security", "shirankedo-daily-security", 60),
    ("cron-shirankedo-weekly-stars", "shirankedo-weekly-stars", 120),
    ("cron-shirankedo-weekly-report", "shirankedo-weekly-report", 120),
    ("cron-shirankedo-weekly-comments", "shirankedo-weekly-comments", 120),
    ("cron-shirankedo-weekly-llm", "shirankedo-weekly-llm", 120),
    ("cron-shirankedo-weekly-repos", "shirankedo-weekly-repos", 120),
]
CRON_ENDPOINTS = [
    {
        "path": f"test-{path_suffix}",
        "name": wf_base,
        "timeout": timeout,
        "wf": f"{wf_base}.json",
    }
    for wf_base, path_suffix, timeout in _CRON_WFS
]

# Webhook WF（読み取り専用リクエストで疎通確認）
# GDrive書き込み系は副作用があるため除外
WEBHOOK_ENDPOINTS = [
    {
        "path": "notion-tasks",
        "name": "Notion Tasks",
        "timeout": 30,
        "body": {"action": "list"},
        "wf": "api-notion-tasks.json",
    },
    {
        "path": "notion-emails",
        "name": "Notion Emails",
        "timeout": 30,
        "body": {"action": "search"},
        "wf": "api-notion-emails.json",
    },
    {
        "path": "notion-recurring-tasks",
        "name": "Recurring Tasks API",
        "timeout": 30,
        "body": {"action": "list"},
        "wf": "api-notion-recurring-tasks.json",
    },
    {
        "path": "gdrive",
        "name": "GDrive Search",
        "timeout": 30,
        "body": {"action": "search"},
        "wf": "api-gdrive.json",
    },
]


def parse_only_file(filepath: str) -> set[str]:
    """--only-file から対象WFファイル名のセットを返す."""
    with open(filepath, encoding="utf-8") as f:
        lines = f.read().strip().splitlines()
    # "workflows/xxx.json" → "xxx.json" に正規化
    return {os.path.basename(line.strip()) for line in lines if line.strip()}


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
            is_transient = "name resolution" in err_msg or "timed out" in err_msg
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
        icon = "\u2705" if r["ok"] else "\u274c"
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


def gdrive_request(action: str, body: dict | None = None, timeout: int = 30) -> dict:
    """GDrive統合WFにリクエストを送信. 失敗時は例外."""
    ep = {
        "path": "gdrive",
        "name": action,
        "timeout": timeout,
        "body": {"action": action, **(body or {})},
    }
    result = post_test(ep)
    if result["status_code"] != 200:
        error = result.get("error") or f"HTTP {result['status_code']}"
        raise RuntimeError(f"{action}: {error}")
    return result["body"]


def _make_result(name: str, ok: bool, resp=None, error=None) -> dict:
    """E2Eテスト結果を統一フォーマットで返す."""
    code = 200 if ok else 0
    return {
        "endpoint": {"name": name},
        "result": {
            "status_code": code,
            "body": resp,
            "error": error,
        },
        "ok": ok,
    }


def run_gdrive_e2e() -> list[dict]:
    """GDrive統合WFの実データE2Eテスト."""
    results = []
    file_id = None
    copy_id = None
    folder_id = None

    # (名前, アクション, パラメータ生成関数)
    def _steps():
        """各ステップを順番に yield する."""
        nonlocal file_id, copy_id, folder_id

        # ファイル操作
        yield (
            "CreateFromText",
            "createFromText",
            {
                "content": "smoke test",
                "name": "smoke_test.txt",
            },
        )
        yield "Download", "download", {"file_id": file_id}
        yield "Copy", "copy", {"file_id": file_id}
        yield (
            "Update",
            "update",
            {
                "file_id": file_id,
                "name": "smoke_renamed.txt",
            },
        )
        yield (
            "Share",
            "share",
            {
                "file_id": file_id,
                "type": "anyone",
                "role": "reader",
            },
        )
        yield "Search", "search", {"query": "smoke_test"}
        # フォルダ操作
        yield (
            "CreateFolder",
            "createFolder",
            {
                "name": "smoke_test_folder",
            },
        )
        yield (
            "Move",
            "move",
            {
                "file_id": copy_id,
                "folder_id": folder_id,
            },
        )
        yield (
            "ShareFolder",
            "shareFolder",
            {
                "folder_id": folder_id,
                "type": "anyone",
                "role": "reader",
            },
        )
        # 掃除
        yield "DeleteFile (orig)", "deleteFile", {"file_id": file_id}
        yield "DeleteFile (copy)", "deleteFile", {"file_id": copy_id}
        yield "DeleteFolder", "deleteFolder", {"folder_id": folder_id}

    for label, action, params in _steps():
        name = f"GDrive {label}"
        print(f"  {name}...", end=" ", flush=True)
        try:
            resp = gdrive_request(action, params)
            # 作成系レスポンスからIDを抽出
            if action == "createFromText" and isinstance(resp, dict):
                file_id = resp.get("file_id") or resp.get("id")
            elif action == "copy" and isinstance(resp, dict):
                copy_id = resp.get("file_id") or resp.get("id")
            elif action == "createFolder" and isinstance(resp, dict):
                folder_id = resp.get("folder_id") or resp.get("id")
            print("OK")
            results.append(_make_result(name, True, resp=resp))
        except Exception as e:
            print(f"FAIL ({e})")
            results.append(_make_result(name, False, error=str(e)))
            # 掃除ステップ以外で作成系が失敗したらスキップ
            is_cleanup = name.startswith("GDrive Delete")
            is_create = action in ("createFromText", "createFolder")
            if not is_cleanup and is_create:
                break

    return results


def main() -> int:
    """スモークテストを実行し、結果を返す."""
    # --only-file オプション: 指定されたWFのみテスト
    target_wfs: set[str] | None = None
    if "--only-file" in sys.argv:
        idx = sys.argv.index("--only-file")
        if idx + 1 < len(sys.argv):
            target_wfs = parse_only_file(sys.argv[idx + 1])
            print(f"Mode: testing {len(target_wfs)} changed WF(s) only")
            for wf in sorted(target_wfs):
                print(f"  - {wf}")
            print()

    def should_test(ep: dict) -> bool:
        if target_wfs is None:
            return True
        return ep.get("wf", "") in target_wfs

    cron_targets = [ep for ep in CRON_ENDPOINTS if should_test(ep)]
    webhook_targets = [ep for ep in WEBHOOK_ENDPOINTS if should_test(ep)]
    run_gdrive = target_wfs is None or "api-gdrive.json" in target_wfs

    results = []

    if cron_targets:
        print("=== Cron WF (test mode) ===")
        for ep in cron_targets:
            ep_with_body = {**ep, "body": {"test": True}}
            print(f"  {ep['name']}...", end=" ", flush=True)
            result = post_test(ep_with_body)
            ok = verify_cron_response(result)
            print("OK" if ok else f"FAIL ({result.get('error') or result['status_code']})")
            results.append({"endpoint": ep, "result": result, "ok": ok})

    if webhook_targets:
        print("\n=== Webhook WF (connectivity check) ===")
        for ep in webhook_targets:
            print(f"  {ep['name']}...", end=" ", flush=True)
            result = post_test(ep)
            ok = verify_webhook_response(result, allow_error=ep.get("allow_error", False))
            print("OK" if ok else f"FAIL ({result.get('error') or result['status_code']})")
            results.append({"endpoint": ep, "result": result, "ok": ok})

    if run_gdrive:
        print("\n=== GDrive E2E (real data flow) ===")
        gdrive_results = run_gdrive_e2e()
        results.extend(gdrive_results)

    if not results:
        print("No matching endpoints to test (skipped)")
        return 0

    send_discord_summary(results)

    failures = [r for r in results if not r["ok"]]
    if failures:
        print(f"\n{len(failures)}/{len(results)} endpoint(s) failed", file=sys.stderr)
        return 1
    print(f"\nAll {len(results)} endpoints passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
