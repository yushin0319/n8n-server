"""
gdrive.json を10個のアクション別ワークフローに分割するスクリプト。
- 各ワークフロー: Webhook → AuthCheck → [action nodes] → Respond
- AuthCheck の secret をハードコードから $env.WEBHOOK_SECRET に統一
- AuthCheck ノードにコメントを追加（共通パターン明記）
"""
import json
import uuid
import os

WORKFLOWS_DIR = os.path.join(os.path.dirname(__file__), '..', 'workflows')
SOURCE = os.path.join(WORKFLOWS_DIR, 'gdrive.json')

# AuthCheck コード（共通パターン。秘密は環境変数から取得）
AUTH_CHECK_CODE = (
    "// [共通パターン] Webhook認証チェック - 全n8nワークフロー共通\n"
    "// WEBHOOK_SECRET 環境変数で認証キーを管理（n8n設定 > Environment Variables）\n"
    "const secret = $input.first().json.headers['x-webhook-secret'];\n"
    "if (secret !== $env.WEBHOOK_SECRET) {\n"
    "  throw new Error('Forbidden: Invalid webhook secret');\n"
    "}\n"
    "return $input.all();"
)

# RespondToWebhook 共通パラメータ
RESPOND_PARAMS = {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify($json) }}",
    "options": {}
}


def make_webhook_node(action: str, node_id: str, webhook_id: str) -> dict:
    return {
        "parameters": {
            "httpMethod": "POST",
            "path": f"gdrive-{action}",
            "responseMode": "responseNode",
            "options": {}
        },
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2.1,
        "position": [0, 0],
        "id": node_id,
        "name": "Webhook",
        "webhookId": webhook_id
    }


def make_authcheck_node(node_id: str) -> dict:
    return {
        "parameters": {
            "jsCode": AUTH_CHECK_CODE
        },
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [220, 0],
        "id": node_id,
        "name": "AuthCheck"
    }


def reposition(nodes: list, x_offset: int = 440, y_offset: int = 0) -> list:
    """アクションノード群のポジションをリセットして見やすく配置."""
    repositioned = []
    for i, node in enumerate(nodes):
        n = dict(node)
        n["position"] = [x_offset + i * 240, y_offset]
        repositioned.append(n)
    return repositioned


def make_workflow(name: str, action: str, action_nodes: list, connections: dict) -> dict:
    webhook_id = str(uuid.uuid4())
    webhook_node_id = str(uuid.uuid4())
    authcheck_node_id = str(uuid.uuid4())

    webhook = make_webhook_node(action, webhook_node_id, webhook_id)
    authcheck = make_authcheck_node(authcheck_node_id)

    all_nodes = [webhook, authcheck] + reposition(action_nodes)

    # 接続: Webhook → AuthCheck → 最初のアクションノード
    first_action_name = action_nodes[0]["name"]
    conns = {
        "Webhook": {"main": [[{"node": "AuthCheck", "type": "main", "index": 0}]]},
        "AuthCheck": {"main": [[{"node": first_action_name, "type": "main", "index": 0}]]},
    }
    # アクション固有の接続を追加
    conns.update(connections)

    return {
        "name": f"Google Drive - {name}",
        "active": True,
        "nodes": all_nodes,
        "connections": conns,
        "settings": {"executionOrder": "v1"}
    }


def main():
    with open(SOURCE, encoding='utf-8') as f:
        wf = json.load(f)

    # ノード名 → ノード定義 のマップ
    by_name = {n["name"]: n for n in wf["nodes"]}

    # ---- list ----
    list_nodes = [by_name["PrepList"], by_name["ListRequest"], by_name["FormatList"], by_name["RespondList"]]
    list_conns = {
        "PrepList": {"main": [[{"node": "ListRequest", "type": "main", "index": 0}]]},
        "ListRequest": {"main": [[{"node": "FormatList", "type": "main", "index": 0}]]},
        "FormatList": {"main": [[{"node": "RespondList", "type": "main", "index": 0}]]},
    }

    # ---- search ----
    search_nodes = [by_name["PrepSearch"], by_name["SearchRequest"], by_name["FormatSearch"], by_name["RespondSearch"]]
    search_conns = {
        "PrepSearch": {"main": [[{"node": "SearchRequest", "type": "main", "index": 0}]]},
        "SearchRequest": {"main": [[{"node": "FormatSearch", "type": "main", "index": 0}]]},
        "FormatSearch": {"main": [[{"node": "RespondSearch", "type": "main", "index": 0}]]},
    }

    # ---- upload (2-step: CreateEmpty → PrepContent → UpdateContent → FormatUpload → Respond) ----
    upload_nodes = [
        by_name["PrepUpload"], by_name["CreateEmpty"], by_name["PrepContent"],
        by_name["UpdateContent"], by_name["FormatUpload"], by_name["RespondUpload"]
    ]
    upload_conns = {
        "PrepUpload": {"main": [[{"node": "CreateEmpty", "type": "main", "index": 0}]]},
        "CreateEmpty": {"main": [[{"node": "PrepContent", "type": "main", "index": 0}]]},
        "PrepContent": {"main": [[{"node": "UpdateContent", "type": "main", "index": 0}]]},
        "UpdateContent": {"main": [[{"node": "FormatUpload", "type": "main", "index": 0}]]},
        "FormatUpload": {"main": [[{"node": "RespondUpload", "type": "main", "index": 0}]]},
    }

    # ---- download ----
    download_nodes = [by_name["PrepDownload"], by_name["DownloadRequest"], by_name["FormatDownload"], by_name["RespondDownload"]]
    download_conns = {
        "PrepDownload": {"main": [[{"node": "DownloadRequest", "type": "main", "index": 0}]]},
        "DownloadRequest": {"main": [[{"node": "FormatDownload", "type": "main", "index": 0}]]},
        "FormatDownload": {"main": [[{"node": "RespondDownload", "type": "main", "index": 0}]]},
    }

    # ---- mkdir ----
    mkdir_nodes = [by_name["PrepMkdir"], by_name["MkdirRequest"], by_name["FormatMkdir"], by_name["RespondMkdir"]]
    mkdir_conns = {
        "PrepMkdir": {"main": [[{"node": "MkdirRequest", "type": "main", "index": 0}]]},
        "MkdirRequest": {"main": [[{"node": "FormatMkdir", "type": "main", "index": 0}]]},
        "FormatMkdir": {"main": [[{"node": "RespondMkdir", "type": "main", "index": 0}]]},
    }

    # ---- delete ----
    delete_nodes = [by_name["PrepDelete"], by_name["DeleteRequest"], by_name["FormatDelete"], by_name["RespondDelete"]]
    delete_conns = {
        "PrepDelete": {"main": [[{"node": "DeleteRequest", "type": "main", "index": 0}]]},
        "DeleteRequest": {"main": [[{"node": "FormatDelete", "type": "main", "index": 0}]]},
        "FormatDelete": {"main": [[{"node": "RespondDelete", "type": "main", "index": 0}]]},
    }

    # ---- info ----
    info_nodes = [by_name["PrepInfo"], by_name["InfoRequest"], by_name["FormatInfo"], by_name["RespondInfo"]]
    info_conns = {
        "PrepInfo": {"main": [[{"node": "InfoRequest", "type": "main", "index": 0}]]},
        "InfoRequest": {"main": [[{"node": "FormatInfo", "type": "main", "index": 0}]]},
        "FormatInfo": {"main": [[{"node": "RespondInfo", "type": "main", "index": 0}]]},
    }

    # ---- move ----
    move_nodes = [by_name["PrepMove"], by_name["GetParents"], by_name["MoveRequest"], by_name["FormatMove"], by_name["RespondMove"]]
    move_conns = {
        "PrepMove": {"main": [[{"node": "GetParents", "type": "main", "index": 0}]]},
        "GetParents": {"main": [[{"node": "MoveRequest", "type": "main", "index": 0}]]},
        "MoveRequest": {"main": [[{"node": "FormatMove", "type": "main", "index": 0}]]},
        "FormatMove": {"main": [[{"node": "RespondMove", "type": "main", "index": 0}]]},
    }

    # ---- rename ----
    rename_nodes = [by_name["PrepRename"], by_name["RenameRequest"], by_name["FormatRename"], by_name["RespondRename"]]
    rename_conns = {
        "PrepRename": {"main": [[{"node": "RenameRequest", "type": "main", "index": 0}]]},
        "RenameRequest": {"main": [[{"node": "FormatRename", "type": "main", "index": 0}]]},
        "FormatRename": {"main": [[{"node": "RespondRename", "type": "main", "index": 0}]]},
    }

    # ---- share ----
    share_nodes = [by_name["PrepShare"], by_name["ShareRequest"], by_name["FormatShare"], by_name["RespondShare"]]
    share_conns = {
        "PrepShare": {"main": [[{"node": "ShareRequest", "type": "main", "index": 0}]]},
        "ShareRequest": {"main": [[{"node": "FormatShare", "type": "main", "index": 0}]]},
        "FormatShare": {"main": [[{"node": "RespondShare", "type": "main", "index": 0}]]},
    }

    # 出力定義
    outputs = [
        ("list",     "List",     list_nodes,     list_conns),
        ("search",   "Search",   search_nodes,   search_conns),
        ("upload",   "Upload",   upload_nodes,   upload_conns),
        ("download", "Download", download_nodes, download_conns),
        ("mkdir",    "Mkdir",    mkdir_nodes,    mkdir_conns),
        ("delete",   "Delete",   delete_nodes,   delete_conns),
        ("info",     "Info",     info_nodes,     info_conns),
        ("move",     "Move",     move_nodes,     move_conns),
        ("rename",   "Rename",   rename_nodes,   rename_conns),
        ("share",    "Share",    share_nodes,    share_conns),
    ]

    for action, label, nodes, conns in outputs:
        wf_data = make_workflow(label, action, nodes, conns)
        out_path = os.path.join(WORKFLOWS_DIR, f"gdrive-{action}.json")
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(wf_data, f, ensure_ascii=False, indent=2)
        print(f"Created: gdrive-{action}.json")

    print("\nDone. Run: python tests/validate_workflows.py")


if __name__ == '__main__':
    main()
