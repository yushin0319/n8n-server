"""scripts/lint_execute_once.py の Notion create + retryOnFail 判定のテスト."""

import importlib.util
import json
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "lint_execute_once",
    Path(__file__).resolve().parent.parent / "scripts" / "lint_execute_once.py",
)
lint = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(lint)


def _write_wf(tmp_path: Path, node_extra: dict) -> str:
    node = {
        "name": "CreateNotionPage",
        "type": "n8n-nodes-base.httpRequest",
        "parameters": {"method": "POST", "url": "https://api.notion.com/v1/pages"},
        "retryOnFail": True,
        "executeOnce": True,
        **node_extra,
    }
    path = tmp_path / "wf.json"
    path.write_text(json.dumps({"nodes": [node], "connections": {}}), encoding="utf-8")
    return str(path)


def test_notion_create_with_retry_is_error(tmp_path):
    errors, _ = lint.lint_workflow(_write_wf(tmp_path, {}))
    assert any("重複ページ作成" in e for e in errors)


def test_allow_marker_with_reason_downgrades_to_warning(tmp_path):
    notes = "lint-allow: notion-create-retry 観測性 DB の記録は重複より欠落の方が困る"
    errors, warnings = lint.lint_workflow(_write_wf(tmp_path, {"notes": notes}))
    assert errors == []
    assert any("notion-create-retry" in w for w in warnings)


def test_allow_marker_without_reason_is_still_error(tmp_path):
    errors, _ = lint.lint_workflow(
        _write_wf(tmp_path, {"notes": "lint-allow: notion-create-retry"})
    )
    assert any("重複ページ作成" in e for e in errors)


def _write_http_wf(tmp_path: Path, url: str, query: dict[str, str] | None = None) -> str:
    params: dict = {"method": "GET", "url": url}
    if query is not None:
        params["sendQuery"] = True
        params["queryParameters"] = {
            "parameters": [{"name": k, "value": v} for k, v in query.items()]
        }
    node = {"name": "FetchErrors", "type": "n8n-nodes-base.httpRequest", "parameters": params}
    path = tmp_path / "wf.json"
    path.write_text(json.dumps({"nodes": [node], "connections": {}}), encoding="utf-8")
    return str(path)


def test_executions_list_with_include_data_is_error(tmp_path):
    path = _write_http_wf(
        tmp_path,
        "http://localhost:5678/api/v1/executions",
        {"limit": "50", "status": "error", "includeData": "true"},
    )
    errors, _ = lint.lint_workflow(path)
    assert any("includeData" in e for e in errors)


def test_executions_list_include_data_in_url_is_error(tmp_path):
    path = _write_http_wf(tmp_path, "http://localhost:5678/api/v1/executions?includeData=true")
    errors, _ = lint.lint_workflow(path)
    assert any("includeData" in e for e in errors)


def test_executions_list_without_data_is_ok(tmp_path):
    path = _write_http_wf(
        tmp_path,
        "http://localhost:5678/api/v1/executions",
        {"limit": "250", "includeData": "false"},
    )
    errors, _ = lint.lint_workflow(path)
    assert errors == []


def test_single_execution_with_include_data_is_ok(tmp_path):
    path = _write_http_wf(
        tmp_path,
        "=http://localhost:5678/api/v1/executions/{{ $json.id }}",
        {"includeData": "true"},
    )
    errors, _ = lint.lint_workflow(path)
    assert errors == []


def test_repo_db_archive_does_not_fetch_execution_list_with_data():
    # 2026-10-19〜22: FetchErrors が失敗実行を中身ごと 50 件取り、V8 heap 256MB を超えて
    # 毎晩 n8n が落ちた。リポの db-archive WF がこの形に戻らないことを確かめる。
    wf = Path(__file__).resolve().parent.parent / "workflows" / "cron-db-archive-execution.json"
    errors, _ = lint.lint_workflow(str(wf))
    assert not any("includeData" in e for e in errors)
