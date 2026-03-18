"""TSビルドパイプラインのテスト.

TDD: RED → GREEN → REFACTOR
テスト対象:
  1. tsc --noEmit で型チェックが通る
  2. esbuild で TS → JS コンパイルが成功する
  3. embed_code が .ts を esbuild 経由でコンパイルしてから埋め込む
  4. 型エラーのある .ts は tsc で検出される
"""

import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.embed_code import embed_workflow

REPO_ROOT = os.path.join(os.path.dirname(__file__), "..")


def run_npx(*args, cwd=None):
    """Windows 互換で npx コマンドを実行する."""
    return subprocess.run(
        ["npx", *args],
        cwd=cwd or REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        shell=True,
    )


class TestTscTypeCheck:
    """tsc --noEmit による型チェック."""

    def test_tsc_passes_on_valid_ts(self):
        """既存の .ts ファイルが型チェックを通る."""
        result = run_npx("tsc", "--noEmit")
        assert result.returncode == 0, f"tsc failed:\n{result.stdout}\n{result.stderr}"

    def test_tsc_detects_type_error(self, tmp_path):
        """型エラーのある .ts は tsc で検出される."""
        bad_ts = tmp_path / "bad.ts"
        bad_ts.write_text(
            "const x: number = 'not a number';\n",
            encoding="utf-8",
        )

        result = run_npx("tsc", "--noEmit", "--strict", str(bad_ts))
        assert result.returncode != 0, "型エラーが検出されるべき"


class TestEsbuildCompile:
    """esbuild による TS → JS コンパイル."""

    def test_esbuild_compiles_ts_to_js(self, tmp_path):
        """esbuild で .ts を .js にコンパイルできる."""
        ts_file = tmp_path / "test.ts"
        ts_file.write_text(
            "const msg: string = 'hello';\nreturn [{ json: { msg } }];\n",
            encoding="utf-8",
        )

        result = run_npx(
            "esbuild", str(ts_file),
            "--bundle=false", "--format=esm", "--target=es2022",
        )
        assert result.returncode == 0, f"esbuild failed:\n{result.stderr}"
        assert ": string" not in result.stdout
        assert "hello" in result.stdout

    def test_esbuild_strips_type_annotations(self, tmp_path):
        """esbuild が型注釈を正しく除去する."""
        ts_file = tmp_path / "typed.ts"
        ts_file.write_text(
            "interface Item { name: string; value: number; }\n"
            "const item: Item = { name: 'test', value: 42 };\n"
            "return [{ json: item }];\n",
            encoding="utf-8",
        )

        result = run_npx(
            "esbuild", str(ts_file),
            "--bundle=false", "--format=esm", "--target=es2022",
        )
        assert result.returncode == 0
        output = result.stdout
        assert "interface" not in output
        assert ": Item" not in output
        assert "name" in output
        assert "42" in output


class TestEmbedWithTsCompilation:
    """embed_code の TS コンパイル統合テスト."""

    def test_embed_compiles_ts_and_embeds(self, tmp_path, monkeypatch):
        """.ts ファイルが esbuild でコンパイルされてから埋め込まれる."""
        code_dir = tmp_path / "code-nodes"
        ts_dir = code_dir / "test-wf"
        ts_dir.mkdir(parents=True)

        ts_code = (
            "export default function (): CodeNodeReturn {\n"
            "  const now: string = new Date()"
            ".toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });\n"
            "  return [{ json: { embed: { title: 'Test', description: now } } }];\n"
            "}\n"
        )
        (ts_dir / "FormatTest.ts").write_text(ts_code, encoding="utf-8")

        monkeypatch.setattr("scripts.embed_code.CODE_NODES_DIR", str(code_dir))

        wf = {
            "nodes": [
                {
                    "parameters": {"jsCode": "// @external test-wf/FormatTest.ts"},
                    "type": "n8n-nodes-base.code",
                    "typeVersion": 2,
                    "name": "FormatTest",
                }
            ]
        }

        embed_workflow(wf)

        embedded_code = wf["nodes"][0]["parameters"]["jsCode"]
        assert ": string" not in embedded_code
        assert "toLocaleString" in embedded_code
        assert "Asia/Tokyo" in embedded_code
