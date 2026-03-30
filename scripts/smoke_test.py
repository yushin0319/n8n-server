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
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ModuleNotFoundError:
    print("python-dotenv未インストール、.envの読み込みスキップ", file=sys.stderr)

# 本番環境URL（CI環境では SMOKE_TEST_URL 環境変数で上書き可能）
BASE_URL = os.environ.get("SMOKE_TEST_URL", "https://yushin-n8n.duckdns.org/webhook")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

# --- 設定（JSONから自動取得できないもののみ） ---

# タイムアウト上書き（未指定WFはデフォルト値を使用）
_TIMEOUT_OVERRIDES = {
    "cron-shirankedo-daily-articles": 120,
    "cron-shirankedo-daily-releases": 120,
    "cron-shirankedo-daily-stars": 120,
    "cron-shirankedo-weekly-report": 120,
    "cron-shirankedo-weekly-comments": 120,
    "cron-shirankedo-weekly-llm": 120,
    "cron-shirankedo-daily-repos": 120,
}
_DEFAULT_CRON_TIMEOUT = 60
_DEFAULT_WEBHOOK_TIMEOUT = 30

# Webhook WFのテスト用body（未指定は空dict → post_testで {"test": true} になる）
# 複数アクションを検証する場合はリストで指定
_WEBHOOK_BODIES: dict[str, dict | list[dict]] = {
    "api-notion-tasks": [
        {"action": "list"},
        {"action": "search", "query": "test"},
    ],
    "api-notion-emails": [
        {"action": "search"},
    ],
    "api-notion-recurring-tasks": [
        {"action": "list"},
    ],
    "api-gdrive": {"action": "search"},
}

# スモークテスト対象外WF
_EXCLUDE_WFS = {"system-error-handler", "api-discord-notify"}


def scan_workflows() -> tuple[list[dict], list[dict]]:
    """workflows/*.json をスキャンしてCron/Webhookエンドポイントを自動生成."""
    wf_dir = Path(__file__).resolve().parent.parent / "workflows"
    cron_endpoints: list[dict] = []
    webhook_endpoints: list[dict] = []

    for json_file in sorted(wf_dir.glob("*.json")):
        wf_base = json_file.stem
        if wf_base in _EXCLUDE_WFS:
            continue

        with open(json_file, encoding="utf-8") as f:
            wf = json.load(f)

        # Webhookノードからpathを抽出
        webhook_paths = [
            node["parameters"]["path"]
            for node in wf.get("nodes", [])
            if node.get("type") == "n8n-nodes-base.webhook"
            and node.get("parameters", {}).get("path")
        ]

        if not webhook_paths:
            continue

        if wf_base.startswith(("cron-", "trigger-")):
            # Cron/Trigger WF → test-* パスを使用
            test_path = next((p for p in webhook_paths if p.startswith("test-")), None)
            if test_path:
                timeout = _TIMEOUT_OVERRIDES.get(wf_base, _DEFAULT_CRON_TIMEOUT)
                cron_endpoints.append(
                    {
                        "path": test_path,
                        "name": wf_base,
                        "timeout": timeout,
                        "wf": f"{wf_base}.json",
                    }
                )
        elif wf_base.startswith("api-"):
            # API WF → メインpathを使用
            main_path = webhook_paths[0]
            timeout = _TIMEOUT_OVERRIDES.get(wf_base, _DEFAULT_WEBHOOK_TIMEOUT)
            body = _WEBHOOK_BODIES.get(wf_base, {})
            webhook_endpoints.append(
                {
                    "path": main_path,
                    "name": wf_base,
                    "timeout": timeout,
                    "body": body,
                    "wf": f"{wf_base}.json",
                }
            )

    return cron_endpoints, webhook_endpoints


CRON_ENDPOINTS, WEBHOOK_ENDPOINTS = scan_workflows()


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


# --- レスポンス構造バリデータ ---
# 読み取り系アクションのレスポンスが期待する構造を持っているか検証する。
# 戻り値: (ok, error_detail)


def _validate_list_with_key(body: dict, key: str) -> tuple[bool, str]:
    """共通: action, count(int), key(list) を検証."""
    if not isinstance(body, dict):
        return False, "response is not dict"
    if "action" not in body:
        return False, "missing 'action'"
    if not isinstance(body.get("count"), int):
        return False, f"'count' is not int: {type(body.get('count')).__name__}"
    if not isinstance(body.get(key), list):
        return False, f"'{key}' is not list: {type(body.get(key)).__name__}"
    if body["count"] != len(body[key]):
        return False, f"count mismatch: count={body['count']}, len({key})={len(body[key])}"
    return True, ""


def _validate_notion_tasks_list(body: dict) -> tuple[bool, str]:
    return _validate_list_with_key(body, "tasks")


def _validate_notion_tasks_search(body: dict) -> tuple[bool, str]:
    return _validate_list_with_key(body, "tasks")


def _validate_notion_emails_search(body: dict) -> tuple[bool, str]:
    return _validate_list_with_key(body, "emails")


def _validate_notion_recurring_tasks_list(body: dict) -> tuple[bool, str]:
    return _validate_list_with_key(body, "tasks")


# (wf_name, action) → バリデータ
_RESPONSE_VALIDATORS: dict[tuple[str, str], callable] = {
    ("api-notion-tasks", "list"): _validate_notion_tasks_list,
    ("api-notion-tasks", "search"): _validate_notion_tasks_search,
    ("api-notion-emails", "search"): _validate_notion_emails_search,
    ("api-notion-recurring-tasks", "list"): _validate_notion_recurring_tasks_list,
}


def validate_response_structure(wf_name: str, action: str, result: dict) -> tuple[bool, str]:
    """レスポンス構造を検証. バリデータ未定義のアクションはスキップ(常にOK)."""
    validator = _RESPONSE_VALIDATORS.get((wf_name, action))
    if validator is None:
        return True, ""
    body = result.get("body")
    if body is None:
        return False, "no response body"
    return validator(body)


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
        headers={
            "Content-Type": "application/json",
            "User-Agent": "n8n-server-smoke-test/1.0",
        },
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
        print("\n=== Webhook WF (response validation) ===")
        for ep in webhook_targets:
            bodies = ep.get("body", {})
            # 単一dictの場合はリストに正規化
            if isinstance(bodies, dict):
                bodies = [bodies]
            for body in bodies:
                action = body.get("action", "unknown")
                label = f"{ep['name']}:{action}"
                test_ep = {**ep, "body": body}
                print(f"  {label}...", end=" ", flush=True)
                result = post_test(test_ep)
                ok = verify_webhook_response(result, allow_error=ep.get("allow_error", False))
                # HTTP成功時はレスポンス構造も検証
                detail = ""
                if ok:
                    struct_ok, detail = validate_response_structure(ep["name"], action, result)
                    if not struct_ok:
                        ok = False
                if ok:
                    print("OK")
                else:
                    error = detail or result.get("error") or f"HTTP {result['status_code']}"
                    print(f"FAIL ({error})")
                results.append(
                    {
                        "endpoint": {**ep, "name": label},
                        "result": result,
                        "ok": ok,
                    }
                )

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
