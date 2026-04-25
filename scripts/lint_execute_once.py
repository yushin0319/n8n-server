"""n8n WF の executeOnce 漏れ・retryOnFail 不安全箇所を検出する lint.

## 背景

2026-04-22 OOM 事件: Gmail 取り込み WF の Notion ノードが executeOnce 未設定で、
N 件の入力を per-item 実行 → Notion API を N 倍呼び出し → メモリ枯渇。

## 検出パターン

### ERROR (CI を失敗させる)

1. SplitInBatches の loop 出力（v3 なら output[1]）から下流の Notion node が
   executeOnce 未設定。ループ毎に N 倍実行されるリスク。
2. Notion 書き込み (POST/PATCH api.notion.com or n8n-nodes-base.notion で create/update)
   が retryOnFail=true。リトライで重複ページ作成のリスク。

### WARN (情報提供、CI は通す)

1. その他の Notion 系 node で executeOnce 未設定。明示的に「per-item 実行が
   意図」なコメント等が無い限り、潜在リスク。

## 終了コード

- exit 0: ERROR ゼロ（WARN は許容）
- exit 1: ERROR 1 件以上

CI 統合: deploy.yml / ci.yml で validate_workflows.py の後に実行する。
"""

from __future__ import annotations

import glob
import json
import os
import sys
from typing import Any
from urllib.parse import urlparse

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

WORKFLOWS_DIR = os.path.join(os.path.dirname(__file__), "..", "workflows")

# Notion 専用ノード
NOTION_NODE_TYPE = "n8n-nodes-base.notion"
HTTP_NODE_TYPE = "n8n-nodes-base.httpRequest"

# SplitInBatches v3 の loop 出力 index
SPLITBATCH_TYPE = "n8n-nodes-base.splitInBatches"
SPLITBATCH_LOOP_OUTPUT_V3 = 1  # v3: [0]=done, [1]=loop


def _is_notion_host(url: str) -> bool:
    """URL のホスト名が api.notion.com (or サブドメイン) か判定する。

    substring match だと https://attacker.com/api.notion.com/x のような偽装に
    ヒットしてしまうため urlparse でホスト名を厳密に取り出す。
    """
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        return False
    return host == "api.notion.com" or host.endswith(".api.notion.com")


def _is_notion_node(node: dict[str, Any]) -> bool:
    """Notion 系のノード全般を判定する（読み書き両方）。"""
    node_type = node.get("type", "")
    if node_type == NOTION_NODE_TYPE:
        return True
    if node_type == HTTP_NODE_TYPE:
        params = node.get("parameters", {}) or {}
        url = str(params.get("url", "") or "")
        if _is_notion_host(url):
            return True
    return False


def _is_notion_create(node: dict[str, Any]) -> bool:
    """Notion で「新規作成」相当の操作か判定する（重複作成リスク）。

    - n8n-nodes-base.notion で operation が create / append（pageId 指定の update は除外）
    - HTTP Request で api.notion.com の POST（PATCH は pageId 指定なので冪等）
    """
    node_type = node.get("type", "")
    params = node.get("parameters", {}) or {}
    if node_type == NOTION_NODE_TYPE:
        op = str(params.get("operation", "") or "").lower()
        return op in {"create", "append"}
    if node_type == HTTP_NODE_TYPE:
        url = str(params.get("url", "") or "")
        method = str(params.get("method", "GET") or "GET").upper()
        if _is_notion_host(url) and method == "POST":
            return True
    return False


def _get_loop_predecessors(
    nodes_by_name: dict[str, dict[str, Any]],
    connections: dict[str, Any],
) -> set[str]:
    """SplitInBatches の loop 出力から流れ込む下流ノード名集合を返す。"""
    loop_targets: set[str] = set()

    # connections は { source_name: { "main": [ [target0], [target1], ... ] } }
    for src_name, conn in connections.items():
        src_node = nodes_by_name.get(src_name)
        if not src_node or src_node.get("type") != SPLITBATCH_TYPE:
            continue
        type_version = src_node.get("typeVersion", 1)
        # v3 のみ loop=output[1]。v1/v2 は output[0]=loop だがリポでは v3 統一
        loop_idx = SPLITBATCH_LOOP_OUTPUT_V3 if type_version >= 3 else 0
        main_outputs = conn.get("main", [])
        if loop_idx >= len(main_outputs):
            continue
        loop_branch = main_outputs[loop_idx] or []
        for target in loop_branch:
            tname = target.get("node")
            if tname:
                loop_targets.add(tname)
    return loop_targets


def _walk_downstream(
    start: str,
    connections: dict[str, Any],
    visited: set[str] | None = None,
) -> set[str]:
    """start から到達可能な全 node 名を返す（main 出力のみ追跡）。"""
    if visited is None:
        visited = set()
    if start in visited:
        return visited
    visited.add(start)
    conn = connections.get(start, {})
    for output_branch in conn.get("main", []):
        for target in output_branch or []:
            tname = target.get("node")
            if tname:
                _walk_downstream(tname, connections, visited)
    return visited


def lint_workflow(path: str) -> tuple[list[str], list[str]]:
    """1 WF を解析し (errors, warnings) を返す。"""
    errors: list[str] = []
    warnings: list[str] = []
    with open(path, encoding="utf-8") as f:
        wf = json.load(f)

    nodes = wf.get("nodes", []) or []
    connections = wf.get("connections", {}) or {}
    nodes_by_name = {n.get("name", ""): n for n in nodes}

    # SplitInBatches loop 配下に到達可能なノード名集合を計算
    loop_seeds = _get_loop_predecessors(nodes_by_name, connections)
    in_loop: set[str] = set()
    for seed in loop_seeds:
        in_loop |= _walk_downstream(seed, connections)

    for node in nodes:
        if not _is_notion_node(node):
            continue
        name = node.get("name", "?")
        execute_once = bool(node.get("executeOnce", False))
        retry = bool(node.get("retryOnFail", False))
        is_create = _is_notion_create(node)

        # ERROR 1: ループ配下で executeOnce 未設定
        if name in in_loop and not execute_once:
            errors.append(
                f"{name}: SplitInBatches loop 配下の Notion node で executeOnce 未設定"
                " → ループ毎の N 倍実行リスク。executeOnce: true を設定してください"
            )
        # ERROR 2: Notion 新規作成で retryOnFail=true（重複作成リスク）
        # 注: PATCH (pageId 指定の update) や GET は冪等なので除外
        if retry and is_create:
            errors.append(
                f"{name}: Notion create/POST で retryOnFail=true → リトライで重複ページ作成のリスク"
            )
        # WARN: それ以外で executeOnce 未設定
        if name not in in_loop and not execute_once:
            warnings.append(
                f"{name}: executeOnce 未設定（per-item 実行）。"
                " 上流が単一 item 確定なら問題なし、複数 item 来うるなら executeOnce: true 推奨"
            )

    return errors, warnings


def main() -> int:
    pattern = os.path.join(WORKFLOWS_DIR, "*.json")
    files = sorted(glob.glob(pattern))
    if not files:
        print("No workflow JSON found")
        return 0

    total_errors = 0
    total_warnings = 0
    for path in files:
        errs, warns = lint_workflow(path)
        if not errs and not warns:
            continue
        rel = os.path.relpath(path, os.path.dirname(WORKFLOWS_DIR))
        print(f"\n=== {rel} ===")
        for e in errs:
            print(f"  ERROR: {e}")
        for w in warns:
            print(f"  WARN:  {w}")
        total_errors += len(errs)
        total_warnings += len(warns)

    print(
        f"\nlint_execute_once: {len(files)} workflows, "
        f"{total_errors} errors, {total_warnings} warnings"
    )
    return 1 if total_errors > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
