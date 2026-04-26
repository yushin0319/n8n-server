# n8n-server

[Oracle Cloud Always Free](https://www.oracle.com/cloud/free/) 上で動かす [n8n](https://n8n.io) v2.6.3 のワークフロー管理リポジトリ。全ワークフローを Git で管理し、GitHub Actions の CI/CD で n8n API 経由デプロイする。

- **本番**: https://yushin-n8n.duckdns.org/
- **監視**: https://yushin-kuma.duckdns.org/ (Uptime Kuma)

## 構成

- ワークフロー本体: `workflows/*.json`
- Code Node 外部化: `workflows/code-nodes/*.ts`（デプロイ時に `embed_code.py` で JSON へ埋め戻し）
- インフラ: `server-config/`（docker-compose / nginx / setup.sh）
- スクリプト: `scripts/deploy.sh`（差分デプロイ）/ `scripts/smoke_test.py`（疎通確認）
- テスト: `tests/validate_workflows.py`（孤立ノード検出等の静的解析）

監視・観測:
- Sentry（`N8N_SENTRY_DSN` / EventLoopBlocked 自動捕捉）
- Promtail → Grafana Cloud Loki（ログ集約）
- Uptime Kuma（push 5分間隔の heartbeat）
- Healthchecks.io（fail ping）

## 開発

```bash
bun install
bun test           # Code Node の vitest
bun run typecheck
python tests/validate_workflows.py
```

## デプロイ

`workflows/` 配下を変更して main にマージすると自動デプロイ。緊急時のフルデプロイ:

```bash
gh workflow run deploy.yml --repo yushin0319/n8n-server --field deploy_all=true
```

`server-config/` の OS 構成変更は手動。OCI に SSH してから:

```bash
bash server-config/setup.sh
```

## 運用ルール

- 手動デプロイ・n8n API 直接更新は禁止（必ず git push → CI 経由）
- OS 状態変更は `server-config/setup.sh` に集約（SSH 直接 `apt install` 等は hook で物理ブロック）
- n8n image 更新時は全 WF が deactivated 化される。`deploy_all=true` で復旧

詳細・既知 gotcha は [CLAUDE.md](CLAUDE.md) を参照。
