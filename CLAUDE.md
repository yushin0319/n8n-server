# n8n-server

Oracle Cloud 上の n8n ワークフロー管理リポジトリ。全ワークフローを Git 管理し、CI/CD でデプロイ。

## インフラ

- **サーバー**: Oracle Cloud Always Free（AMD Micro, 1 OCPU, 1GB RAM + 2GB Swap）
- **n8n**: v2.6.3（Docker, メモリ上限 512MB）
- **ドメイン**: https://yushin-n8n.duckdns.org（Let's Encrypt SSL）
- **リバースプロキシ**: Nginx（Webhook 認証付き）

## ディレクトリ構成

- `workflows/` - n8n ワークフロー JSON（11ファイル）
- `scripts/deploy.sh` - n8n API デプロイスクリプト
- `tests/validate_workflows.py` - ワークフロー静的解析
- `server-config/` - docker-compose.yml, nginx 設定

## コマンド

```bash
# テスト
python tests/validate_workflows.py

# 緊急全デプロイ
gh workflow run deploy.yml --repo yushin0319/n8n-server --field deploy_all=true
```

## ワークフロー管理ルール

- **手動デプロイ・API 直接更新は禁止**。必ず git push → CI 経由
- 新規作成・更新は `n8n-workflow` skill の手順に従う
- Windows curl 経由の API 更新は日本語文字化けで Notion プロパティ破損の危険あり

## n8n v2 注意点

| 問題 | 対策 |
|------|------|
| Code Node で `content` が予約語 | `taskContent` 等の別名を使う |
| jsCode 内の `split('\n')` | JSON では `split('\\n')` にする |
| HTTP Request → Respond to Webhook 直結 | 間に Code Node を挟む |
| Code Node で `fetch`, `require` 使用不可 | HTTP Request ノードを使う |

## CI/CD

- `deploy.yml`: workflows/ 変更時に自動デプロイ（変更ファイルのみ）
- `gemini-review.yml`: shared-workflows 経由の PR レビュー
- pre-commit hook: `validate_workflows.py` 実行（コミット時にゲート）

## テスト方針

- `validate_workflows.py` による静的解析（8チェック項目）
- TDD ポリシー適用範囲外（テストフレームワークなし）
