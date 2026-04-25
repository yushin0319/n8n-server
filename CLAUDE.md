# n8n-server

Oracle Cloud 上の n8n ワークフロー管理リポジトリ。全ワークフローを Git 管理し、CI/CD でデプロイ。

## インフラ

- **サーバー**: Oracle Cloud Always Free（AMD Micro, 1 OCPU, 1GB RAM + 2GB Swap）
- **n8n**: v2.6.3（Docker, メモリ上限 512MB）
- **ドメイン**: https://yushin-n8n.duckdns.org（Let's Encrypt SSL）
- **リバースプロキシ**: Nginx（Webhook 認証付き）

## ディレクトリ構成

- `workflows/*.json` - n8n ワークフロー JSON
- `workflows/code-nodes/` - 外部化した Code Node（TypeScript）
- `workflows/code-nodes/_shared/` - 複数WFで共有するユーティリティ
- `scripts/deploy.sh` - n8n API デプロイスクリプト
- `scripts/embed_code.py` - .ts → JSON 埋め戻し（デプロイ時に実行）
- `scripts/extract_code.py` - JSON → .ts 抽出
- `scripts/smoke_test.py` - デプロイ後の疎通確認
- `tests/` - バリデーション・ビルドパイプラインのテスト
- `types/n8n-code-node.d.ts` - n8n グローバル変数の型定義
- `server-config/` - docker-compose.yml, nginx-n8n.conf, setup.sh（OCI 反映は `bash setup.sh` のみ）
  - Compose プロジェクト名は `n8n-docker`（ボリューム継承のため固定）
  - Uptime Kuma (監視) も同 compose に同居（`/kuma/` で公開）

## コマンド

```bash
# Code Node ユニットテスト（vitest）
npm test

# TypeScript 型チェック
npm run typecheck

# WF 静的解析（孤立ノード検出等）
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
| SplitInBatches v3 output 逆転 | [0]=done, [1]=loop |

## CI/CD

- `ci.yml`: PR 時に typecheck + vitest + Biome + Ruff + validate_workflows
- `deploy.yml`: workflows/ 変更時に自動デプロイ（embed_code.py → n8n API → smoke_test.py）
- `gemini-review.yml`: shared-workflows 経由の PR レビュー
