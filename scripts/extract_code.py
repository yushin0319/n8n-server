"""Code Node の jsCode を外部ファイルに抽出する.

使い方:
    python scripts/extract_code.py                    # 全WF
    python scripts/extract_code.py health-check.json  # 指定WFのみ
"""

import json
import os
import sys
import textwrap

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

WORKFLOWS_DIR = os.path.join(os.path.dirname(__file__), "..", "workflows")
CODE_NODES_DIR = os.path.join(WORKFLOWS_DIR, "code-nodes")

# 外部参照マーカーのプレフィックス
EXTERNAL_PREFIX = "// @external "


def extract_workflow(json_path):
    """1つのWF JSONからCode NodeのjsCodeを外部化する."""
    with open(json_path, encoding="utf-8") as f:
        wf = json.load(f)

    wf_name = os.path.splitext(os.path.basename(json_path))[0]
    out_dir = os.path.join(CODE_NODES_DIR, wf_name)

    code_nodes = [n for n in wf.get("nodes", []) if n.get("type") == "n8n-nodes-base.code"]
    if not code_nodes:
        print(f"  SKIP: Code Node なし")
        return 0

    os.makedirs(out_dir, exist_ok=True)
    count = 0

    for node in code_nodes:
        js_code = node.get("parameters", {}).get("jsCode", "")
        node_name = node.get("name", "Unknown")

        # 既に外部化済みならスキップ
        if js_code.startswith(EXTERNAL_PREFIX):
            print(f"  SKIP: {node_name} (既に外部化済み)")
            continue

        # ファイル名: ノード名をそのまま使う（スペース→アンダースコア）
        safe_name = node_name.replace(" ", "_")
        file_name = f"{safe_name}.ts"
        file_path = os.path.join(out_dir, file_name)

        # jsCode を export default function ラッパー付きで書き出し
        indented = textwrap.indent(js_code, "  ")
        wrapped = f"export default function (): CodeNodeReturn {{\n{indented}\n}}\n"
        with open(file_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(wrapped)

        # JSON内のjsCodeを外部参照マーカーに置換
        ref = f"{wf_name}/{file_name}"
        node["parameters"]["jsCode"] = f"{EXTERNAL_PREFIX}{ref}"

        print(f"  OK: {node_name} → code-nodes/{ref}")
        count += 1

    # 変更をJSONに書き戻し
    if count > 0:
        with open(json_path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(wf, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return count


def main():
    if len(sys.argv) > 1:
        targets = sys.argv[1:]
    else:
        targets = sorted(
            f for f in os.listdir(WORKFLOWS_DIR) if f.endswith(".json")
        )

    total = 0
    for filename in targets:
        json_path = os.path.join(WORKFLOWS_DIR, filename)
        if not os.path.isfile(json_path):
            print(f"ERROR: {filename} が見つかりません")
            continue
        print(f"--- {filename} ---")
        total += extract_workflow(json_path)

    print(f"\n抽出完了: {total} ファイル")


if __name__ == "__main__":
    main()
