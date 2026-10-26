# n8n-server

[Oracle Cloud Always Free](https://www.oracle.com/cloud/free/) 上で動かす [n8n](https://n8n.io) のワークフロー管理リポジトリ。26 個のワークフローを Git で管理し、GitHub Actions の CI/CD で n8n API 経由デプロイする。image は `server-config/docker-compose.yml` で **`n8nio/n8n:2.44.4` に pin**（`:latest` は #614 で廃止。同じ compose で Promtail `grafana/promtail:3.6.8` も動かす）。

- **本番**: https://yushin-n8n.duckdns.org/

## 構成

- `workflows/*.json` — ワークフロー本体。命名は `<カテゴリ>-<ケバブケース>.json`
  - カテゴリ: `api-*`（HTTP webhook）/ `cron-*`（schedule trigger）/ `trigger-*`（外部 trigger 受け）/ `system-*`（error-handler。heartbeat は `cron-system-heartbeat.json`）
- `workflows/code-nodes/<WF名>/*.ts` — Code Node の外部化（隣に vitest の `*.test.ts`）。複数 WF で使う部品は `workflows/code-nodes/_shared/`
- `types/` — Code Node の型定義（`n8n-code-node.d.ts`）と、テストのフィクスチャを `?raw` で読むための `raw-import.d.ts`
- `docs/notion-schemas.md` — WF が操作する Notion DB のスキーマ
- `scripts/`
  - `deploy.sh` — 差分デプロイ（`_shared/` 変更時は `@external` を含む全 WF = 現在 26 本中 25 本を再デプロイ）。手動実行では全件 (`deploy_all`) / 指定ファイルのみ (`deploy_files`) も選べる
  - `embed_code.py` — `.ts` → JSON へ埋め戻し（CI で実行）
  - `extract_code.py` — JSON → `.ts` 抽出（ローカル編集用）
  - `lint_execute_once.py` — executeOnce / retryOnFail のリスク検査
  - `smoke_test.py` — デプロイ後の疎通確認
  - `inject_healthchecks_ping.py` — cron WF の Schedule 直後に Healthchecks.io ping ノードを冪等に挿入
- `tests/validate_workflows.py` — 孤立ノード検出・命名規則・credential 参照などの静的解析
- `tests/test_*.py` — `embed_code.py` のバンドル・抽出/埋め戻し・TS ビルド、cron-health-check WF の構造（retry 設定・確認先の渡し方）、`lint_execute_once.py`、`smoke_test.py` の Discord 送信条件、試験モードの判定方法の pytest（CI では実行していない）
- `server-config/`
  - `docker-compose.yml` / `nginx-n8n.conf` / `setup.sh`（後述）
  - `n8n-watchdog.{service,timer}` / `oci-mem-watch.{service,timer}` / `n8n-wal-checkpoint.{service,timer}` — systemd timer（監視 + 日次メンテ）
  - `check-host-mem.sh` / `check-n8n-health.sh` / `checkpoint-n8n-wal.sh` — health-check・メンテスクリプト
  - `promtail-config.yaml` / `netdata.conf` / `health_alarm_notify.conf` — 観測エージェント設定（`health_alarm_notify.conf` は Netdata のアラートを `api/obs-from-netdata` WF へ送る上書き設定）

監視・観測:
- Sentry（`N8N_SENTRY_DSN` / EventLoopBlocked 自動捕捉）
- Promtail → Grafana Cloud Loki（ログ集約）
- HTTP 監視: `cron/health-check`（10 分ごと、HistLink / shirankedo / worldpulse / n8n 公開 URL）。heartbeat は Healthchecks.io（n8n の `cron/system-heartbeat`、crypto-ai-trader の `crypto-ai-trader-heartbeat`）。Uptime Kuma は 2026-10-24 にメモリ不足対策で撤去
- Healthchecks.io（cron WF 9 本が Schedule 直後に WF ごとの slug へ ping して実行欠落を検知。`System/error-handler` は `n8n-error-handler/fail` へ fail ping）
- Netdata Agent（host メトリクス）

通知経路（`api/obs-notify`）: 全件を Notion 観測性 DB に記録する。Discord へは **critical のみ即時**（#obs-critical、@here）。warning と crypto-ai-trader の約定は `cron/obs-daily-digest` が毎日 23:00 JST に #obs-warning へ 1 通にまとめる（対象 0 件の日は送らない）。info は Discord に送らない。`smoke_test.py` の Discord 通知も失敗時のみ。

定期メンテ・自己防衛（systemd timer）:
- `n8n-wal-checkpoint.timer` — 毎日 03:00 JST（自動 reboot の直前窓）に n8n SQLite の WAL を `TRUNCATE` して肥大を防ぐ
- `oci-mem-watch.timer` → `check-host-mem.sh` — 10 分間隔。severity 判定は container の `memory.current`（ライブ値）で行う。`memory.peak` は累計値で起動直後の migration スパイクに引っ張られるため summary の参考表示のみ。**閾値は warning 上限（`CURRENT_WARN=85`）で critical は撤廃**（停止系は別監視が捕捉するので、pressure 段階で夜中に起こさない）
- `n8n-watchdog.timer` → `check-n8n-health.sh` — 5 分間隔。healthz を叩いてゾンビ検知したら再起動

## 開発

```bash
bun install
bun run test       # Code Node の vitest。`bun test` は Bun 内蔵ランナーになるので使わない
bun run typecheck
python tests/validate_workflows.py
python scripts/lint_execute_once.py
python -m pytest tests/   # scripts の pytest（CI 対象外）
```

CI（`.github/workflows/ci.yml`、PR 時）では typecheck + vitest + Biome + Ruff + validate_workflows + lint_execute_once が走り、main マージで `deploy.yml` が validate_workflows + lint_execute_once → 差分デプロイ → smoke test を実行する。`codeql.yml` でセキュリティスキャン、`gemini-review.yml` で Gemini の PR レビュー、`dependabot-automerge.yml` で patch/minor 自動マージ（後 2 つは shared-workflows の reusable workflow を呼ぶ）。コミット時は husky + lint-staged が Biome（js/ts/json）と Ruff（py）を自動修正する。

## デプロイ

`workflows/` / `scripts/` / `types/` 配下を変更して main にマージすると自動デプロイ。緊急時のフルデプロイと、指定した WF だけの入れ替え:

```bash
gh workflow run deploy.yml --repo yushin0319/n8n-server --field deploy_all=true
gh workflow run deploy.yml --repo yushin0319/n8n-server --field deploy_files="workflows/trigger-gmail-import.json"
```

`_shared/` を変えると 25 本が一斉に入れ直されて n8n がメモリ不足で落ちることがある。手順は [CLAUDE.md](CLAUDE.md) のワークフロー管理ルールを参照。

`server-config/setup.sh` は OCI 上の OS 構成（`rpcbind` 削除 / fail2ban / sshd ハードニング / unattended-upgrades + 04:00 JST 自動 reboot / TZ=JST / uv のユーザーローカル導入 / nginx 同期 / `docker compose up -d --pull always` / Netdata Agent / systemd timer 3 種の配置 / pipx の oci-cli 撤去 / 撤去済みコンテナ・volume・古い image の削除）を冪等に適用するスクリプト。iptables は初期構築時の設定をそのまま使い、setup.sh では変更しない。`docker compose up` の直前に obs-notify へ **deploy マーカー（severity=info）** を 1 本投げるので、image 更新後 10 分ほど cron/adapter が一過性失敗しても「誤報ではなく deploy 由来」と観測性 DB から判別できる（info は Discord には送らない）。OS 変更を伴う PR をマージしたら OCI に SSH してから:

```bash
bash server-config/setup.sh
```

## 運用ルール

- 手動デプロイ・n8n API 直接更新は禁止（必ず git push → CI 経由）
- OS 状態変更は `server-config/setup.sh` に集約（SSH 直接 `apt install` 等は hook で物理ブロック）
- n8n image 更新時は全 WF が deactivated 化される。`deploy_all=true` で復旧
- 観測: `tail-errors.py --since 24h` / `sentry-issues.py list --org yushin --project n8n-server` で AI が pull 可能

詳細・既知 gotcha は [CLAUDE.md](CLAUDE.md) を参照。
