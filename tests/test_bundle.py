"""bundle モード（import 解決）のテスト.

TDD: RED → GREEN → REFACTOR
テスト対象:
  1. import を含む .ts が esbuild --bundle で1ファイルにまとまる
  2. 共通モジュールの関数が埋め込まれる
  3. export default function ラッパーが除去される
  4. 既存の import なしファイルも引き続き動く
"""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.embed_code import EXTERNAL_PREFIX, embed_workflow


@pytest.fixture
def code_workspace(tmp_path):
    """共通モジュール付きのテスト用ワークスペース."""
    code_dir = tmp_path / "code-nodes"
    shared_dir = code_dir / "_shared"
    shared_dir.mkdir(parents=True)
    wf_dir = code_dir / "test-wf"
    wf_dir.mkdir()
    return code_dir, shared_dir, wf_dir


class TestBundleImport:
    """import を含む .ts の bundle テスト."""

    def test_shared_function_is_inlined(self, code_workspace, monkeypatch):
        """import した共通関数がインライン化される."""
        code_dir, shared_dir, wf_dir = code_workspace
        monkeypatch.setattr("scripts.embed_code.CODE_NODES_DIR", str(code_dir))

        # 共通モジュール
        (shared_dir / "greet.ts").write_text(
            'export function greet(name: string): string {\n'
            '  return `Hello, ${name}!`;\n'
            '}\n',
            encoding="utf-8",
        )

        # Code Node（共通モジュールを import）
        (wf_dir / "TestNode.ts").write_text(
            'import { greet } from "../_shared/greet";\n'
            '\n'
            'export default function (): CodeNodeReturn {\n'
            '  const msg = greet("n8n");\n'
            '  return [{ json: { msg } }];\n'
            '}\n',
            encoding="utf-8",
        )

        wf = {
            "nodes": [{
                "parameters": {"jsCode": "// @external test-wf/TestNode.ts"},
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "name": "TestNode",
            }],
        }

        embed_workflow(wf)
        embedded = wf["nodes"][0]["parameters"]["jsCode"]

        # import 文が消えている
        assert "import" not in embedded
        # 共通関数の中身がインライン化されている
        assert "Hello" in embedded
        # ラッパーが除去されている
        assert "export default" not in embedded
        # 実行コードが残っている
        assert "greet" in embedded

    def test_no_import_still_works(self, code_workspace, monkeypatch):
        """import なしのファイルも引き続き動く."""
        code_dir, shared_dir, wf_dir = code_workspace
        monkeypatch.setattr("scripts.embed_code.CODE_NODES_DIR", str(code_dir))

        (wf_dir / "Simple.ts").write_text(
            'export default function (): CodeNodeReturn {\n'
            '  return [{ json: { x: 42 } }];\n'
            '}\n',
            encoding="utf-8",
        )

        wf = {
            "nodes": [{
                "parameters": {"jsCode": "// @external test-wf/Simple.ts"},
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "name": "Simple",
            }],
        }

        embed_workflow(wf)
        embedded = wf["nodes"][0]["parameters"]["jsCode"]

        assert "42" in embedded
        assert "export default" not in embedded

    def test_type_annotations_stripped_in_bundle(self, code_workspace, monkeypatch):
        """bundle モードでも型注釈が除去される."""
        code_dir, shared_dir, wf_dir = code_workspace
        monkeypatch.setattr("scripts.embed_code.CODE_NODES_DIR", str(code_dir))

        (shared_dir / "utils.ts").write_text(
            'export function double(n: number): number {\n'
            '  return n * 2;\n'
            '}\n',
            encoding="utf-8",
        )

        (wf_dir / "TypedNode.ts").write_text(
            'import { double } from "../_shared/utils";\n'
            '\n'
            'export default function (): CodeNodeReturn {\n'
            '  const result: number = double(21);\n'
            '  return [{ json: { result } }];\n'
            '}\n',
            encoding="utf-8",
        )

        wf = {
            "nodes": [{
                "parameters": {"jsCode": "// @external test-wf/TypedNode.ts"},
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "name": "TypedNode",
            }],
        }

        embed_workflow(wf)
        embedded = wf["nodes"][0]["parameters"]["jsCode"]

        assert ": number" not in embedded
        assert "double" in embedded
        assert "21" in embedded
