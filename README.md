# n8n-server

[Oracle Cloud Always Free](https://www.oracle.com/cloud/free/) 上で動かす [n8n](https://n8n.io) のワークフロー管理リポジトリ。26 個のワークフローを Git で管理し、GitHub Actions の CI/CD で n8n API 経由デプロイする。image は `server-config/docker-compose.yml` で **`n8nio/n8n:2.23.4` に pin**（`:latest` は #614 で廃止）。

- **本番**: https://yushin-n8n.duckdns.org/
- **監視**: https://yushin-kuma.duckdns.org/ (Uptime Kuma)

## 構成

- `workflows/*.json` — ワークフロー本体。命名は `<カテゴリ>-<ケバブケース>.json`
  - カテゴリ: `api-*`（HTTP webhook）/ `cron-*`（schedule trigger）/ `trigger-*`（外部 trigger 受け）/ `system-*`（heartbeat / error-handler 等）
- `workflows/code-nodes/*.ts` — Code Node の外部化（型補完用 `types/n8n-code-node.d.ts` あり）
- `scripts/`
  - `deploy.sh` — 差分デプロイ（`_shared/` 変更時は全 WF 再デプロイ）
  - `embed_code.py` — `.ts` → JSON へ埋め戻し（CI で実行）
  - `extract_code.py` — JSON → `.ts` 抽出（ローカル編集用）
  - `lint_execute_once.py` — executeOnce / retryOnFail のリスク検査
  - `smoke_test.py` — デプロイ後の疎通確認
  - `kuma_bootstrap_monitors.py` — Uptime Kuma の monitor 一括登録
- `tests/validate_workflows.py` — 孤立ノード検出・命名規則・credential 参照などの静的解析
- `server-config/`
  - `docker-compose.yml` / `nginx-n8n.conf` / `setup.sh`（後述）
  - `n8n-watchdog.{service,timer}` / `oci-mem-watch.{service,timer}` / `n8n-wal-checkpoint.{service,timer}` — systemd timer（監視 + 日次メンテ）
  - `check-host-mem.sh` / `check-n8n-health.sh` / `checkpoint-n8n-wal.sh` / `health_alarm_notify.conf` — health-check・メンテスクリプト
  - `promtail-config.yaml` / `netdata.conf` — 観測エージェント設定

監視・観測:
- Sentry（`N8N_SENTRY_DSN` / EventLoopBlocked 自動捕捉）
- Promtail → Grafana Cloud Loki（ログ集約）
- Uptime Kuma（push 5分間隔の heartbeat、別サブドメインで公開）
- Healthchecks.io（fail ping）
- Netdata Agent（host メトリクス）

定期メンテ・自己防衛（systemd timer）:
- `n8n-wal-checkpoint.timer` — 毎日 03:00 JST（自動 reboot の直前窓）に n8n SQLite の WAL を `TRUNCATE` して肥大を防ぐ
- `oci-mem-watch.timer` → `check-host-mem.sh` — 10 分間隔。severity 判定は container の `memory.current`（ライブ値）で行う。`memory.peak` は累計値で起動直後の migration スパイクに引っ張られるため summary の参考表示のみ。**閾値は warning 上限（`CURRENT_WARN=85`）で critical は撤廃**（停止系は別監視が捕捉するので、pressure 段階で夜中に起こさない）
- `n8n-watchdog.timer` — healthz を叩いてゾンビ検知したら再起動

## 開発

```bash
bun install
bun test           # Code Node の vitest
bun run typecheck
python tests/validate_workflows.py
python scripts/lint_execute_once.py
```

CI（`.github/workflows/`）では typecheck + vitest + Biome + Ruff + validate_workflows + lint_execute_once が走り、main マージで `deploy.yml` が差分デプロイ → smoke test を実行する。`codeql.yml` でセキュリティスキャン、`dependabot-automerge.yml` で patch/minor 自動マージ。

## デプロイ

`workflows/` 配下を変更して main にマージすると自動デプロイ。緊急時のフルデプロイ:

```bash
gh workflow run deploy.yml --repo yushin0319/n8n-server --field deploy_all=true
```

`server-config/setup.sh` は OCI 上の OS 構成（`rpcbind` 削除 / fail2ban / sshd ハードニング / unattended-upgrades + 04:00 JST 自動 reboot / TZ=JST / iptables / nginx 同期 / `docker compose up -d --pull always` / Netdata Agent）を冪等に適用するスクリプト。`docker compose up` の直前に obs-notify へ **deploy マーカー（severity=info）** を 1 本投げるので、image 更新後 10 分ほど cron/adapter が一過性失敗しても「誤報ではなく deploy 由来」と観測性 DB / Discord から判別できる。OS 変更を伴う PR をマージしたら OCI に SSH してから:

```bash
bash server-config/setup.sh
```

## 運用ルール

- 手動デプロイ・n8n API 直接更新は禁止（必ず git push → CI 経由）
- OS 状態変更は `server-config/setup.sh` に集約（SSH 直接 `apt install` 等は hook で物理ブロック）
- n8n image 更新時は全 WF が deactivated 化される。`deploy_all=true` で復旧
- 観測: `tail-errors.py --since 24h` / `sentry-issues.py list --org yushin --project n8n-server` で AI が pull 可能

詳細・既知 gotcha は [CLAUDE.md](CLAUDE.md) を参照。
