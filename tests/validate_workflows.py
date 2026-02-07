"""n8n ワークフローJSON 静的解析テスト.

検出する既知の問題:
1. Code Node 内で予約語 'content' を変数名として使用 (Task Runner衝突)
2. jsCode 内の文字列リテラルに生の改行が混入 (JSONエンコーディング不備)
3. HTTP Request → Respond to Webhook 直結 ($json 式が空になるバグ)
"""
import json
import re
import sys
import os
import glob

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

WORKFLOWS_DIR = os.path.join(os.path.dirname(__file__), '..', 'workflows')

# Code Node 内で禁止する変数宣言パターン
RESERVED_VARS = ['content']

# HTTP Request 系のノードタイプ
HTTP_REQUEST_TYPES = {
    'n8n-nodes-base.httpRequest',
}

# Respond to Webhook のノードタイプ
RESPOND_TYPES = {
    'n8n-nodes-base.respondToWebhook',
}


def load_workflow(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def check_reserved_variable_names(wf, errors):
    """Code Node 内で予約語を変数名に使っていないか."""
    for node in wf.get('nodes', []):
        if node.get('type') != 'n8n-nodes-base.code':
            continue
        code = node.get('parameters', {}).get('jsCode', '')
        name = node.get('name', '???')
        for var in RESERVED_VARS:
            # const content = / let content = / var content =
            pattern = rf'\b(const|let|var)\s+{re.escape(var)}\s*='
            if re.search(pattern, code):
                errors.append(
                    f'[{name}] 予約語 "{var}" を変数名に使用しています。'
                    f' Task Runner と衝突するため別名を使ってください。'
                )


def check_newline_encoding(wf, errors):
    """jsCode 内の文字列リテラルに生の改行が含まれていないか."""
    for node in wf.get('nodes', []):
        if node.get('type') != 'n8n-nodes-base.code':
            continue
        code = node.get('parameters', {}).get('jsCode', '')
        name = node.get('name', '???')

        # シングルクォート文字列内に生の改行があるか検出
        # 正常: split('\\n')  → JSON上は split('\\n')
        # 異常: split('\n改行')  → JSON上は split('(改行)')
        in_string = False
        quote_char = None
        i = 0
        while i < len(code):
            ch = code[i]
            if not in_string:
                if ch in ("'", '"', '`'):
                    in_string = True
                    quote_char = ch
            else:
                if ch == '\\':
                    i += 1  # エスケープをスキップ
                elif ch == '\n' and quote_char != '`':
                    # テンプレートリテラル(`)以外で文字列内に生の改行
                    # 前後のコンテキストを取得
                    start = max(0, i - 30)
                    end = min(len(code), i + 30)
                    context = code[start:end].replace('\n', '⏎')
                    errors.append(
                        f'[{name}] 文字列リテラル内に生の改行があります。'
                        f' JSONエンコーディングを確認してください。'
                        f' 付近: ...{context}...'
                    )
                    break  # 1ノードにつき1回報告
                elif ch == quote_char:
                    in_string = False
            i += 1


def check_http_to_respond_direct(wf, errors):
    """HTTP Request が直接 Respond to Webhook に接続されていないか."""
    # ノード名 → タイプ のマップ
    node_types = {}
    for node in wf.get('nodes', []):
        node_types[node['name']] = node.get('type', '')

    connections = wf.get('connections', {})
    for src_name, conn_data in connections.items():
        src_type = node_types.get(src_name, '')
        if src_type not in HTTP_REQUEST_TYPES:
            continue

        # main 出力の接続先を確認
        for output_group in conn_data.get('main', []):
            for conn in output_group:
                dst_name = conn.get('node', '')
                dst_type = node_types.get(dst_name, '')
                if dst_type in RESPOND_TYPES:
                    errors.append(
                        f'[{src_name}] → [{dst_name}]: HTTP Request が'
                        f' Respond to Webhook に直結しています。'
                        f' $json 式が空になるため、間に Code ノードを挟んでください。'
                    )


def validate_workflow(path):
    """1つのワークフローを検証し、エラーリストを返す."""
    wf = load_workflow(path)
    errors = []
    check_reserved_variable_names(wf, errors)
    check_newline_encoding(wf, errors)
    check_http_to_respond_direct(wf, errors)
    return errors


def main():
    pattern = os.path.join(WORKFLOWS_DIR, '*.json')
    files = sorted(glob.glob(pattern))

    if not files:
        print(f'WARNING: No workflow files found in {WORKFLOWS_DIR}')
        sys.exit(1)

    total_errors = 0
    for path in files:
        name = os.path.basename(path)
        errors = validate_workflow(path)
        if errors:
            print(f'FAIL  {name}')
            for e in errors:
                print(f'  - {e}')
            total_errors += len(errors)
        else:
            print(f'OK    {name}')

    print(f'\n{len(files)} workflows, {total_errors} errors')
    sys.exit(1 if total_errors > 0 else 0)


if __name__ == '__main__':
    main()
