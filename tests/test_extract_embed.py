"""extract_code / embed_code パイプラインのテスト.

TDD: RED → GREEN → REFACTOR
テスト対象:
  1. extract: WF JSONから jsCode を export default function ラッパー付き .ts に抽出
  2. embed: .ts を esbuild でコンパイルし、関数ボディだけを WF JSON に埋め戻し
  3. ラウンドトリップ: extract → embed で重要な識別子・値が保持される
  4. エッジケース: 外部ファイル不在、既に外部化済み、Code Nodeなし
"""

import json
import os
import sys
import textwrap

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.embed_code import EXTERNAL_PREFIX, embed_workflow, extract_function_body
from scripts.extract_code import extract_workflow

# テスト用の固定データ
SAMPLE_JSCODE = (
    "const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });\n"
    "return [{ json: { embed: {\n"
    "  title: 'Test',\n"
    "  description: now,\n"
    "  color: 15158332\n"
    "}}}];"
)

SAMPLE_WF = {
    "id": "test-wf-001",
    "name": "Test Workflow",
    "active": False,
    "nodes": [
        {
            "parameters": {"jsCode": SAMPLE_JSCODE},
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "name": "FormatTest",
            "id": "test-node-001",
        },
        {
            "parameters": {"method": "GET", "url": "https://example.com"},
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "name": "HTTPRequest",
            "id": "test-node-002",
        },
    ],
    "connections": {},
    "settings": {"executionOrder": "v1"},
}


@pytest.fixture
def temp_workspace(tmp_path):
    """テスト用のワークスペースを作成する."""
    wf_dir = tmp_path / "workflows"
    wf_dir.mkdir()
    code_dir = wf_dir / "code-nodes"
    code_dir.mkdir()

    wf_path = wf_dir / "test-wf.json"
    with open(wf_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(SAMPLE_WF, f, indent=2, ensure_ascii=False)
        f.write("\n")

    return tmp_path, wf_dir, code_dir, wf_path


class TestExtractFunctionBody:
    """esbuild 出力から関数ボディを抽出するユーティリティのテスト."""

    def test_extracts_simple_body(self):
        """単純な関数からボディを抽出できる."""
        esbuild_output = textwrap.dedent("""\
            export default function() {
              const x = 1;
              return [{ json: { x } }];
            }
        """)
        body = extract_function_body(esbuild_output)
        assert "const x = 1;" in body
        assert "return" in body
        assert "export default" not in body

    def test_extracts_multiline_body(self):
        """複数行のボディを正しく抽出する."""
        esbuild_output = textwrap.dedent("""\
            export default function() {
              const a = 1;
              const b = 2;
              const c = a + b;
              return [{ json: { c } }];
            }
        """)
        body = extract_function_body(esbuild_output)
        assert "const a = 1;" in body
        assert "const c = a + b;" in body

    def test_preserves_inner_braces(self):
        """ボディ内のブレースが保持される."""
        esbuild_output = textwrap.dedent("""\
            export default function() {
              const obj = { key: "value" };
              if (obj.key) {
                return [{ json: obj }];
              }
              return [{ json: {} }];
            }
        """)
        body = extract_function_body(esbuild_output)
        assert '{ key: "value" }' in body
        assert "if (obj.key) {" in body

    def test_dedents_body(self):
        """ボディが2スペースデデントされる."""
        esbuild_output = textwrap.dedent("""\
            export default function() {
              const x = 1;
              return x;
            }
        """)
        body = extract_function_body(esbuild_output)
        lines = body.split("\n")
        # 先頭がスペースで始まらない（デデント済み）
        assert lines[0] == "const x = 1;"

    def test_handles_bundle_format(self):
        """esbuild --bundle の出力形式を正しく処理する."""
        # 実際のesbuild --bundle出力を再現
        esbuild_output = (
            "// workflows/code-nodes/test/Node.ts\n"
            "function Node_default() {\n"
            "  const x = 1;\n"
            "  return [{ json: { x } }];\n"
            "}\n"
            "export {\n"
            "  Node_default as default\n"
            "};\n"
        )
        body = extract_function_body(esbuild_output)
        assert "const x = 1;" in body
        assert "return" in body
        assert "export" not in body
        assert "Node_default" not in body
        # 末尾に閉じ}が残っていないこと
        assert not body.rstrip().endswith("}")
        # デデント済み
        assert body.split("\n")[0] == "const x = 1;"


class TestExtract:
    """extract_code.py のテスト."""

    def test_extract_creates_ts_with_wrapper(self, temp_workspace, monkeypatch):
        """jsCodeがexport default functionラッパー付きの.tsとして抽出される."""
        tmp_path, wf_dir, code_dir, wf_path = temp_workspace
        monkeypatch.setattr("scripts.extract_code.WORKFLOWS_DIR", str(wf_dir))
        monkeypatch.setattr("scripts.extract_code.CODE_NODES_DIR", str(code_dir))

        extract_workflow(str(wf_path))

        ts_file = code_dir / "test-wf" / "FormatTest.ts"
        assert ts_file.exists()

        content = ts_file.read_text(encoding="utf-8")
        # ラッパーが付いている
        assert content.startswith("export default function (): CodeNodeReturn {")
        assert content.rstrip().endswith("}")
        # 元のコードの内容が含まれる（インデントされた状態）
        assert "toLocaleString" in content

    def test_extract_replaces_jscode_with_marker(self, temp_workspace, monkeypatch):
        """JSON内のjsCodeが外部参照マーカーに置換される."""
        tmp_path, wf_dir, code_dir, wf_path = temp_workspace
        monkeypatch.setattr("scripts.extract_code.WORKFLOWS_DIR", str(wf_dir))
        monkeypatch.setattr("scripts.extract_code.CODE_NODES_DIR", str(code_dir))

        extract_workflow(str(wf_path))

        with open(wf_path, encoding="utf-8") as f:
            wf = json.load(f)

        code_node = [n for n in wf["nodes"] if n["type"] == "n8n-nodes-base.code"][0]
        assert code_node["parameters"]["jsCode"].startswith(EXTERNAL_PREFIX)
        assert code_node["parameters"]["jsCode"].endswith(".ts")

    def test_extract_skips_non_code_nodes(self, temp_workspace, monkeypatch):
        """Code Node以外のノードは変更されない."""
        tmp_path, wf_dir, code_dir, wf_path = temp_workspace
        monkeypatch.setattr("scripts.extract_code.WORKFLOWS_DIR", str(wf_dir))
        monkeypatch.setattr("scripts.extract_code.CODE_NODES_DIR", str(code_dir))

        extract_workflow(str(wf_path))

        with open(wf_path, encoding="utf-8") as f:
            wf = json.load(f)

        http_node = [n for n in wf["nodes"] if n["type"] == "n8n-nodes-base.httpRequest"][0]
        assert http_node["parameters"]["url"] == "https://example.com"

    def test_extract_skips_already_externalized(self, temp_workspace, monkeypatch):
        """既に外部化済みのCode Nodeはスキップされる."""
        tmp_path, wf_dir, code_dir, wf_path = temp_workspace
        monkeypatch.setattr("scripts.extract_code.WORKFLOWS_DIR", str(wf_dir))
        monkeypatch.setattr("scripts.extract_code.CODE_NODES_DIR", str(code_dir))

        extract_workflow(str(wf_path))
        count = extract_workflow(str(wf_path))
        assert count == 0

    def test_extract_no_code_nodes(self, temp_workspace, monkeypatch):
        """Code Nodeがない WF は0件を返す."""
        tmp_path, wf_dir, code_dir, wf_path = temp_workspace
        monkeypatch.setattr("scripts.extract_code.WORKFLOWS_DIR", str(wf_dir))
        monkeypatch.setattr("scripts.extract_code.CODE_NODES_DIR", str(code_dir))

        no_code_wf = {
            "id": "no-code",
            "name": "No Code",
            "nodes": [
                {"type": "n8n-nodes-base.httpRequest", "name": "HTTP", "parameters": {}}
            ],
            "connections": {},
        }
        no_code_path = wf_dir / "no-code.json"
        with open(no_code_path, "w", encoding="utf-8") as f:
            json.dump(no_code_wf, f)

        count = extract_workflow(str(no_code_path))
        assert count == 0


class TestEmbed:
    """embed_code.py のテスト."""

    def test_embed_compiles_ts_and_extracts_body(self, temp_workspace, monkeypatch):
        """外部.tsのラッパーが除去され、関数ボディだけがjsCodeに埋め込まれる."""
        tmp_path, wf_dir, code_dir, wf_path = temp_workspace
        monkeypatch.setattr("scripts.embed_code.CODE_NODES_DIR", str(code_dir))

        ts_dir = code_dir / "test-wf"
        ts_dir.mkdir()
        (ts_dir / "FormatTest.ts").write_text(
            'export default function (): CodeNodeReturn {\n'
            '  const x: number = 42;\n'
            '  return [{ json: { x } }];\n'
            '}\n',
            encoding="utf-8",
        )

        wf = json.loads(json.dumps(SAMPLE_WF))
        wf["nodes"][0]["parameters"]["jsCode"] = "// @external test-wf/FormatTest.ts"

        embed_workflow(wf)

        embedded = wf["nodes"][0]["parameters"]["jsCode"]
        # ラッパーが除去されている
        assert "export default" not in embedded
        # 型注釈が除去されている
        assert ": number" not in embedded
        # 関数ボディは残っている
        assert "42" in embedded
        assert "return" in embedded

    def test_embed_leaves_inline_code_unchanged(self, temp_workspace, monkeypatch):
        """マーカーがないCode Nodeはそのまま残る."""
        tmp_path, wf_dir, code_dir, wf_path = temp_workspace
        monkeypatch.setattr("scripts.embed_code.CODE_NODES_DIR", str(code_dir))

        wf = json.loads(json.dumps(SAMPLE_WF))
        embed_workflow(wf)

        code_node = [n for n in wf["nodes"] if n["type"] == "n8n-nodes-base.code"][0]
        assert code_node["parameters"]["jsCode"] == SAMPLE_JSCODE

    def test_embed_raises_on_missing_file(self, temp_workspace, monkeypatch):
        """外部ファイルが見つからない場合はエラーになる."""
        tmp_path, wf_dir, code_dir, wf_path = temp_workspace
        monkeypatch.setattr("scripts.embed_code.CODE_NODES_DIR", str(code_dir))

        wf = json.loads(json.dumps(SAMPLE_WF))
        wf["nodes"][0]["parameters"]["jsCode"] = "// @external nonexistent/Missing.ts"

        with pytest.raises(FileNotFoundError):
            embed_workflow(wf)


class TestRoundTrip:
    """extract → embed のラウンドトリップテスト."""

    def test_roundtrip_preserves_semantics(self, temp_workspace, monkeypatch):
        """extract → embed で重要な識別子・値が保持される."""
        tmp_path, wf_dir, code_dir, wf_path = temp_workspace
        monkeypatch.setattr("scripts.extract_code.WORKFLOWS_DIR", str(wf_dir))
        monkeypatch.setattr("scripts.extract_code.CODE_NODES_DIR", str(code_dir))
        monkeypatch.setattr("scripts.embed_code.CODE_NODES_DIR", str(code_dir))

        extract_workflow(str(wf_path))

        with open(wf_path, encoding="utf-8") as f:
            wf = json.load(f)
        embed_workflow(wf)

        embedded = wf["nodes"][0]["parameters"]["jsCode"]
        assert "toLocaleString" in embedded
        assert "Asia/Tokyo" in embedded
        assert "15158332" in embedded
        assert "export default" not in embedded

    def test_roundtrip_with_japanese(self, temp_workspace, monkeypatch):
        """日本語を含むjsCodeがラウンドトリップで保持される."""
        tmp_path, wf_dir, code_dir, wf_path = temp_workspace
        monkeypatch.setattr("scripts.extract_code.WORKFLOWS_DIR", str(wf_dir))
        monkeypatch.setattr("scripts.extract_code.CODE_NODES_DIR", str(code_dir))
        monkeypatch.setattr("scripts.embed_code.CODE_NODES_DIR", str(code_dir))

        special_code = "const msg = 'ヘルスチェック失敗';\nreturn [{ json: { msg } }];"

        wf = json.loads(json.dumps(SAMPLE_WF))
        wf["nodes"][0]["parameters"]["jsCode"] = special_code
        with open(wf_path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(wf, f, indent=2, ensure_ascii=False)
            f.write("\n")

        extract_workflow(str(wf_path))
        with open(wf_path, encoding="utf-8") as f:
            wf_after = json.load(f)
        embed_workflow(wf_after)

        embedded = wf_after["nodes"][0]["parameters"]["jsCode"]
        assert "ヘルスチェック失敗" in embedded
        assert "msg" in embedded
        assert "export default" not in embedded

    def test_roundtrip_multiple_code_nodes(self, temp_workspace, monkeypatch):
        """複数のCode Nodeがすべてラウンドトリップで保持される."""
        tmp_path, wf_dir, code_dir, wf_path = temp_workspace
        monkeypatch.setattr("scripts.extract_code.WORKFLOWS_DIR", str(wf_dir))
        monkeypatch.setattr("scripts.extract_code.CODE_NODES_DIR", str(code_dir))
        monkeypatch.setattr("scripts.embed_code.CODE_NODES_DIR", str(code_dir))

        code_a = "return [{ json: { result: 'A' } }];"
        code_b = "const items = $input.all();\nreturn items;"

        wf = json.loads(json.dumps(SAMPLE_WF))
        wf["nodes"][0]["parameters"]["jsCode"] = code_a
        wf["nodes"].append({
            "parameters": {"jsCode": code_b},
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "name": "SecondCode",
            "id": "test-node-003",
        })
        with open(wf_path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(wf, f, indent=2, ensure_ascii=False)
            f.write("\n")

        extract_workflow(str(wf_path))
        with open(wf_path, encoding="utf-8") as f:
            wf_after = json.load(f)
        embed_workflow(wf_after)

        codes = {
            n["name"]: n["parameters"]["jsCode"]
            for n in wf_after["nodes"]
            if n["type"] == "n8n-nodes-base.code"
        }
        assert "result" in codes["FormatTest"]
        assert "$input.all()" in codes["SecondCode"]
        # ラッパーが残っていないこと
        for code in codes.values():
            assert "export default" not in code
