"""試験モードの判定方法のテスト.

n8n 2.44.4 では、CheckTestMode (Code ノード) が `$execution.customData.set('isTest')` した値を
同じ実行の後続 IF ノードの式 `$execution.customData.get('isTest')` から読めない
(実行の最後に保存はされるが、実行中には見えない。2026-10-24 確認)。
そのため試験の判定は、CheckTestMode が受け取った webhook body (`{"test": true}`) を直接見る。
"""

import glob
import json
import os
from pathlib import Path

import pytest

ROOT = os.path.join(os.path.dirname(__file__), "..")
WF_FILES = sorted(glob.glob(os.path.join(ROOT, "workflows", "*.json")))
TEST_FLAG_EXPR = "={{ String(($('CheckTestMode').first().json.body || {}).test === true) }}"


def _load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _ancestors(wf, target):
    parents = {}
    for src, conn in wf.get("connections", {}).items():
        for outs in conn.get("main", []):
            for c in outs or []:
                parents.setdefault(c["node"], set()).add(src)
    seen, stack = set(), [target]
    while stack:
        for p in parents.get(stack.pop(), ()):
            if p not in seen:
                seen.add(p)
                stack.append(p)
    return seen


@pytest.mark.parametrize("path", WF_FILES, ids=os.path.basename)
def test_no_node_reads_is_test_from_custom_data(path):
    wf = _load(path)
    for node in wf["nodes"]:
        params = json.dumps(node.get("parameters", {}))
        assert "customData.get('isTest')" not in params, node["name"]


@pytest.mark.parametrize("path", WF_FILES, ids=os.path.basename)
def test_test_flag_if_nodes_run_after_check_test_mode(path):
    wf = _load(path)
    for node in wf["nodes"]:
        params = json.dumps(node.get("parameters", {}), ensure_ascii=False)
        if "$('CheckTestMode')" not in params:
            continue
        assert TEST_FLAG_EXPR in [
            c.get("leftValue") for c in node["parameters"]["conditions"]["conditions"]
        ], node["name"]
        # 未実行のノードを $('...') で参照すると式がエラーになるので、必ず下流に置く
        assert "CheckTestMode" in _ancestors(wf, node["name"]), node["name"]


def test_code_nodes_do_not_read_is_test_from_custom_data():
    pattern = os.path.join(ROOT, "workflows", "code-nodes", "**", "*.ts")
    offenders = [
        os.path.relpath(p, ROOT)
        for p in glob.glob(pattern, recursive=True)
        if not p.endswith(".test.ts")
        and 'customData.get("isTest")' in Path(p).read_text(encoding="utf-8")
    ]
    assert offenders == []
