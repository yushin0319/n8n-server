"""validate_workflows.check_list_without_output の判定のテスト.

応答を応答ノードに任せる Webhook の後ろで、一覧取得 (getAll / search) が 0 件だと
次へ何も流さず、応答ノードまで届かずに中身の空の応答 (HTTP 200・0 バイト) になる。
alwaysOutputData の無いものを検出する。
"""

import importlib.util
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "validate_workflows", Path(__file__).resolve().parent / "validate_workflows.py"
)
vw = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(vw)


def _wf(list_extra: dict | None = None, response_mode: str = "responseNode") -> dict:
    nodes = [
        {
            "name": "Webhook",
            "type": "n8n-nodes-base.webhook",
            "parameters": {"responseMode": response_mode},
        },
        {
            "name": "Query",
            "type": "n8n-nodes-base.notion",
            "parameters": {"resource": "databasePage", "operation": "getAll"},
            **(list_extra or {}),
        },
        {"name": "Format", "type": "n8n-nodes-base.code", "parameters": {}},
        {"name": "Respond", "type": "n8n-nodes-base.respondToWebhook", "parameters": {}},
    ]
    connections = {
        "Webhook": {"main": [[{"node": "Query"}]]},
        "Query": {"main": [[{"node": "Format"}]]},
        "Format": {"main": [[{"node": "Respond"}]]},
    }
    return {"nodes": nodes, "connections": connections}


def _check(wf: dict) -> list[str]:
    errors: list[str] = []
    vw.check_list_without_output(wf, errors)
    return errors


def test_応答ノードまでの途中の一覧取得にalwaysOutputDataが無ければエラー():
    errors = _check(_wf())
    assert len(errors) == 1
    assert "Query" in errors[0]
    assert "alwaysOutputData" in errors[0]


def test_alwaysOutputDataがあれば通す():
    assert _check(_wf({"alwaysOutputData": True})) == []


def test_応答をノードに任せないWebhookは対象外():
    assert _check(_wf(response_mode="lastNode")) == []


def test_Google_Driveの検索も一覧取得として見る():
    wf = _wf()
    wf["nodes"][1] = {
        "name": "Query",
        "type": "n8n-nodes-base.googleDrive",
        "parameters": {"resource": "fileFolder", "operation": "search"},
    }
    assert len(_check(wf)) == 1


def test_応答ノードにつながらない枝の一覧取得は対象外():
    wf = _wf({"alwaysOutputData": True})
    wf["nodes"].append(
        {
            "name": "SideQuery",
            "type": "n8n-nodes-base.notion",
            "parameters": {"operation": "getAll"},
        }
    )
    wf["connections"]["Webhook"]["main"][0].append({"node": "SideQuery"})
    assert _check(wf) == []
