# n8n-server

Oracle Cloud Free Tier 上で動作する n8n (v2.6.3) のワークフロー管理リポジトリ。

## 構成

```
n8n-server/
  workflows/      ... ワークフロー定義 (JSON)
  scripts/        ... デプロイスクリプト
  server-config/  ... Nginx 設定
  tests/          ... ワークフロー検証テスト
  docs/           ... ドキュメント (Notion スキーマ等)
```

## インフラ

| 項目 | 内容 |
|------|------|
| サーバー | Oracle Cloud Always Free (AMD Micro, 1 OCPU, 1GB RAM + 2GB Swap) |
| OS | Ubuntu 22.04 |
| n8n | Docker Compose (n8nio/n8n) |
| ドメイン | DuckDNS (無料) |
| SSL | Let's Encrypt + Nginx リバースプロキシ (自動更新) |
| 認証 | Webhook: `X-Webhook-Secret` ヘッダー (Nginx で検証) |
| 費用 | 全て無料 |

## ワークフロー一覧

`workflows/` にWF定義JSONを格納。最新のID・active状態は n8n API で確認可能。

### Webhook 型

| ファイル | パス | 説明 |
|----------|------|------|
| `server-status.json` | `/webhook/status` | サーバーステータス確認 |
| `notion-tasks.json` | `/webhook/notion-tasks` | Notion タスク管理 (list/create/update/search/get/replace) |
| `notion-emails.json` | `/webhook/notion-emails` | 重要メール DB 管理 (search/update/briefing) |
| `discord-notify.json` | `/webhook/discord-notify` | Discord 通知送信 |
| `gdrive-*.json` (10種) | `/webhook/gdrive-*` | Google Drive 操作。action別に独立WF（gdrive-list, gdrive-upload 等） |

### スケジュール型

| ファイル | スケジュール | 説明 |
|----------|-------------|------|
| `health-check.json` | 10分毎 | HistLink ヘルスチェック → 失敗時 Discord 通知 |
| `gmail-to-notion.json` | 1時間毎 | Gmail 未読メール → Notion 重要メール DB |
| `github-summary.json` | 毎日 23:50 JST | GitHub Commits → Notion タスク DB 日次サマリー |
| `recurring-tasks.json` | 毎日 7:30 JST | 定期タスク定義 DB → Notion タスク自動生成 |
| `shirankedo-daily.json` | 毎日 0:00 JST | ShiranKedo 日次更新（記事・脆弱性・リリース） |
| `shirankedo-weekly.json` | 毎週月曜 3:00 JST | ShiranKedo 週次レポート・リポ追加・ページコメント |

### その他

| ファイル | 説明 |
|----------|------|
| `error-handler.json` | ワークフローエラーキャッチ → Discord 通知 |

## デプロイ

### 手動デプロイ

```bash
# 1. ワークフロー JSON をサーバーに転送
scp -i ~/.ssh/your-key.key workflows/TARGET.json ubuntu@<IP>:/tmp/

# 2. Docker コンテナにコピー → インポート → publish → 再起動
ssh -i ~/.ssh/your-key.key ubuntu@<IP> "
  docker cp /tmp/TARGET.json n8n-docker-n8n-1:/tmp/ && \
  docker exec n8n-docker-n8n-1 n8n import:workflow --input=/tmp/TARGET.json && \
  docker exec n8n-docker-n8n-1 n8n publish:workflow --id=WORKFLOW_ID && \
  docker restart n8n-docker-n8n-1
"
```

> 再起動後の n8n 起動完了まで約80秒かかります。

### REST API デプロイ (deploy.sh)

`scripts/deploy.sh` で n8n REST API 経由のデプロイも可能です。
git diff で変更されたワークフローのみ PUT/POST し、active フラグに応じて activate/deactivate します。

```bash
N8N_API_KEY=your-key DEPLOY_ALL=true bash scripts/deploy.sh
```

## テスト

`tests/validate_workflows.py` がワークフロー JSON の静的解析を行います。

```bash
python tests/validate_workflows.py
```

**検出する問題:**

| ルール | 内容 |
|--------|------|
| 予約語変数名 | Code Node 内で `content` 等の予約語を変数宣言に使用 (n8n v2 Task Runner 衝突) |
| 改行エンコーディング | jsCode 内の文字列リテラルに生の改行が混入 (JS 構文エラー) |
| HTTP→Respond 直結 | HTTP Request ノードが Respond to Webhook に直結 (`$json` 式が空になるバグ) |

**git pre-push hook** に組み込み済みのため、テスト失敗時は push が拒否されます。

## n8n v2 注意点

- `content` は Code Node 内で変数名として使用禁止 → `taskContent` 等を使う
- JSON 内の jsCode で `split('\n')` は `split('\\n')` にする (`\n` → `\\n` で JS エスケープ正常化)
- HTTP Request → Respond to Webhook で `$json` 式が空になる → 間に Code ノード (FormatXxx) を挟む
- `this.helpers.httpRequestWithAuthentication`、`fetch`、`require('https')`、`$http` は Code Node で使用不可

## セットアップ手順

Oracle Cloud Free Tier に n8n 環境を一から構築する手順です。

### 1. Oracle Cloud アカウント作成

[Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/) でアカウントを作成。Always Free 枠の AMD Micro インスタンス (1 OCPU, 1GB RAM) を使用します。

> ARM A1 (4 OCPU, 24GB) はリージョンによって容量不足で確保できないことがあります。

### 2. VM セットアップ

```bash
ssh -i ~/.ssh/your-key.key ubuntu@<パブリックIP>

# Swap 追加（1GB RAM ではメモリ不足になるため）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab

# Docker インストール
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

### 3. n8n 起動

```yaml
# docker-compose.yml
services:
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    environment:
      - N8N_SECURE_COOKIE=true
volumes:
  n8n_data:
```

```bash
docker compose up -d
```

### 4. ドメイン + SSL

1. [DuckDNS](https://www.duckdns.org/) でサブドメイン作成、パブリック IP を登録
2. Nginx + Let's Encrypt でリバースプロキシ + SSL 設定

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
# Nginx 設定は server-config/nginx-n8n.conf を参照
sudo certbot --nginx -d your-name.duckdns.org
```

### 5. ファイアウォール

Ubuntu iptables と OCI セキュリティリストの両方で TCP 80, 443 を開放。

## トラブルシューティング

| 問題 | 対処法 |
|------|--------|
| ARM A1 が確保できない | AMD Micro で代替 |
| n8n がメモリ不足で落ちる | 2GB Swap を追加 |
| Webhook が 404 | ワークフローを Publish したか確認 |
| Webhook が 403 | `X-Webhook-Secret` ヘッダーが正しいか確認 |
| OCI にアクセスできない | Ubuntu iptables と OCI セキュリティリスト両方を確認 |
| Code Node でエラー | `content` 変数名や `\n` エンコーディングを確認 (上記「n8n v2 注意点」参照) |
| deploy.sh が 401 | n8n v2 アップグレード後は REST API Key の再生成が必要 |
