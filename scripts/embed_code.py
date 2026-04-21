"""外部化した Code Node の jsCode を WF JSON に埋め戻す.

.ts ファイルは esbuild で JS にコンパイルし、
export default function() { ... } ラッパーの関数ボディだけを抽出して埋め込む。

CLI: python scripts/embed_code.py workflows/health-check.json > /tmp/embedded.json
モジュール: from scripts.embed_code import embed_workflow
"""

import json
import os
import platform
import subprocess
import sys
import textwrap

# Windows では bunx を shell 経由で呼ぶ必要がある
_SHELL = platform.system() == "Windows"

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

CODE_NODES_DIR = os.path.join(os.path.dirname(__file__), "..", "workflows", "code-nodes")

# 外部参照マーカーのプレフィックス
EXTERNAL_PREFIX = "// @external "


def extract_function_body(esbuild_output):
    """esbuild 出力から export default 関数のボディを抽出する.

    対応する出力形式:
    (A) 非bundleモード（単一関数）:
        export default function() { <body> }
    (B) bundleモード（単一関数）:
        // comment
        function Xxx_default() { <body> }
        export { Xxx_default as default };
    (C) bundleモード（ヘルパー関数あり）:
        // comment
        function helper1() { ... }
        function helper2() { ... }
        function Xxx_default() { <body> }
        export { Xxx_default as default };
        → ヘルパー関数群 + <body> を返す
    """
    lines = esbuild_output.rstrip("\n").split("\n")

    # 先頭コメント行を除去
    while lines and lines[0].startswith("//"):
        lines.pop(0)

    # 末尾の export ブロック + 空行を除去
    # export { ... }; は複数行にまたがる場合がある（re-export時）
    # 正順スキャンで最後の "export {" から末尾の "};" までを除去する
    export_start = None
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].startswith("export {"):
            export_start = i
            break
    if export_start is not None:
        lines = lines[:export_start]
    # 末尾の空行を除去
    while lines and lines[-1].strip() == "":
        lines.pop()

    if len(lines) < 2:
        return esbuild_output.strip()

    # _default 関数の開始行を探す（bundleモードでヘルパー関数がある場合）
    default_idx = None
    for i, line in enumerate(lines):
        if "_default(" in line and line.startswith("function "):
            default_idx = i
            break

    if default_idx is not None and default_idx > 0:
        # (C) ヘルパー関数あり: ヘルパー部分はそのまま残し、_default のボディだけアンラップ
        helper_lines = lines[:default_idx]
        # _default 関数の宣言行と閉じ } を除去してボディを取得
        default_body = lines[default_idx + 1 : -1]
        dedented_body = textwrap.dedent("\n".join(default_body))
        return "\n".join(helper_lines).strip("\n") + "\n" + dedented_body.strip("\n")

    # (A)(B) 単一関数: 従来どおり最初の行と最後の行を除去
    body_lines = lines[1:-1]

    # 2スペースデデント
    dedented = textwrap.dedent("\n".join(body_lines))
    return dedented.strip("\n")


def compile_ts(file_path):
    """esbuild で .ts → .js にコンパイルする（import解決 + 型除去）."""
    result = subprocess.run(
        [
            "bunx",
            "esbuild",
            file_path,
            "--bundle",
            "--format=esm",
            "--target=es2022",
            "--charset=utf8",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        shell=_SHELL,
    )
    if result.returncode != 0:
        raise RuntimeError(f"esbuild コンパイルエラー: {file_path}\n{result.stderr}")
    return result.stdout


def resolve_external(js_code):
    """jsCode が外部参照なら読み込み（.tsならコンパイル+ボディ抽出）、そうでなければそのまま返す."""
    if not js_code.startswith(EXTERNAL_PREFIX):
        return js_code

    ref_path = js_code[len(EXTERNAL_PREFIX) :].strip()
    file_path = os.path.join(CODE_NODES_DIR, ref_path)

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"外部ファイルが見つかりません: {file_path}")

    if file_path.endswith(".ts"):
        compiled = compile_ts(file_path)
        return extract_function_body(compiled)

    with open(file_path, encoding="utf-8") as f:
        content = f.read()
    return content.rstrip("\n")


def embed_workflow(wf_dict):
    """WF辞書内の全Code Nodeの外部参照を解決する（破壊的変更）."""
    resolved = 0
    for node in wf_dict.get("nodes", []):
        if node.get("type") != "n8n-nodes-base.code":
            continue
        js_code = node.get("parameters", {}).get("jsCode", "")
        if js_code.startswith(EXTERNAL_PREFIX):
            node["parameters"]["jsCode"] = resolve_external(js_code)
            resolved += 1
    return resolved


def embed_workflow_json(json_path):
    """JSONファイルを読み込み、外部参照を解決した辞書を返す."""
    with open(json_path, encoding="utf-8") as f:
        wf = json.load(f)
    embed_workflow(wf)
    return wf


def main():
    if len(sys.argv) < 2:
        print("Usage: python embed_code.py <workflow.json>", file=sys.stderr)
        sys.exit(1)

    json_path = sys.argv[1]
    wf = embed_workflow_json(json_path)
    json.dump(wf, sys.stdout, indent=2, ensure_ascii=False)
    print()


if __name__ == "__main__":
    main()
