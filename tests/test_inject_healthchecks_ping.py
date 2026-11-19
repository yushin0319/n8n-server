"""scripts/inject_healthchecks_ping.py のテスト (onError をノード本体に置くこと)."""

import importlib.util
import json
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "inject_healthchecks_ping",
    Path(__file__).resolve().parent.parent / "scripts" / "inject_healthchecks_ping.py",
)
inject = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(inject)


def _ping_node() -> dict:
    return inject.build_ping_node("sample", [0, 0], "hc-ping-sample")


def _write_cron_wf(tmp_path: Path, ping_node: dict | None) -> Path:
    nodes = [
        {"name": "Schedule", "type": inject.SCHED_TYPE, "parameters": {}, "position": [0, 0]},
        {"name": "Work", "type": "n8n-nodes-base.code", "parameters": {}, "position": [400, 0]},
    ]
    if ping_node is not None:
        nodes.append(ping_node)
    wf = {
        "name": "cron/sample",
        "nodes": nodes,
        "connections": {"Schedule": {"main": [[{"node": "Work", "type": "main", "index": 0}]]}},
    }
    path = tmp_path / "cron-sample.json"
    path.write_text(json.dumps(wf, ensure_ascii=False), encoding="utf-8")
    return path


def _assert_onerror_on_node(path: Path) -> None:
    wf = json.loads(path.read_text(encoding="utf-8"))
    ping = next(n for n in wf["nodes"] if n["name"] == inject.PING_NODE_NAME)
    assert ping["onError"] == "continueRegularOutput"
    assert "onError" not in ping["parameters"]


def test_pingが無いWFに足すとonErrorはノード本体(tmp_path):
    path = _write_cron_wf(tmp_path, None)
    assert inject.process_workflow(path, dry_run=False) == "create:sample"
    _assert_onerror_on_node(path)


def test_parametersの中にonErrorがある古い形はノード本体へ直す(tmp_path):
    old = _ping_node()
    old["parameters"]["onError"] = old.pop("onError")
    path = _write_cron_wf(tmp_path, old)
    assert inject.process_workflow(path, dry_run=False) == "update:sample"
    _assert_onerror_on_node(path)


def test_正しい形なら書き換えない(tmp_path):
    path = _write_cron_wf(tmp_path, _ping_node())
    before = path.read_text(encoding="utf-8")
    assert inject.process_workflow(path, dry_run=False) == "noop:up-to-date"
    assert path.read_text(encoding="utf-8") == before
