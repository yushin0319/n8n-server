# n8n × Oracle Cloud 無料セットアップガイド

n8n（ノードベースの自動化ツール）を Oracle Cloud Free Tier に無料でデプロイし、外部から HTTPS で Webhook を呼べる状態にするまでの手順です。

## 全体の流れ

```
Phase 0: ローカルで試す → Phase 1: Docker化 → Phase 2: Oracle Cloud準備
→ Phase 3: サーバーデプロイ → Phase 4: ドメイン+SSL → Phase 5: 外部連携
```

## Phase 0: ローカルで n8n を試す

まずはローカルで動かして n8n の感触を掴みます。

```bash
npx n8n
```

ブラウザで `http://localhost:5678` を開き、ユーザー登録後にワークフローを触ってみてください。Webhook ノード → Code ノード → Respond to Webhook の3ノード構成で「POST を受けて JSON を返す」基本形を作るのがおすすめです。

## Phase 1: ローカル Docker 化

本番と同じ構成で動かすため、Docker Compose に移行します。

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
      - N8N_SECURE_COOKIE=false
volumes:
  n8n_data:
```

```bash
docker compose up -d
```

`http://localhost:5678` で動作確認。Phase 0 で作ったワークフローをエクスポート → インポートしておくと楽です。

## Phase 2: Oracle Cloud アカウント作成

[Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/) でアカウントを作成します。クレジットカード登録が必要ですが、Always Free 枠なら課金されません。

- リージョン: 東京 or 大阪（近い方を選択）
- Always Free で使えるインスタンス: AMD Micro（1 OCPU, 1GB RAM）

> 注意: ARM A1（4 OCPU, 24GB）は人気が高く、リージョンによっては容量不足で確保できません。その場合は AMD Micro を使います。

## Phase 3: Oracle VM に n8n をデプロイ

### 3-1. インスタンス作成

OCI コンソールで「コンピュート > インスタンスの作成」から Ubuntu 22.04 の VM を作成します。SSH 鍵を生成・ダウンロードしておきます。

### 3-2. SSH 接続とセットアップ

```bash
ssh -i ~/.ssh/your-key.key ubuntu@<パブリックIP>

# Swap 追加（1GB RAM では n8n がメモリ不足になるため）
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab

# Docker インストール
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

再ログイン後、Phase 1 と同じ `docker-compose.yml` を配置して `docker compose up -d` で起動。

### 3-3. ファイアウォール設定

2か所で開放が必要です:

1. **Ubuntu 側**: `sudo iptables -I INPUT -p tcp --dport 5678 -j ACCEPT`（80, 443 も）
2. **OCI 側**: VCN > セキュリティリスト > イングレスルールに TCP 5678, 80, 443 を追加

`http://<パブリックIP>:5678` でアクセスできれば成功。

## Phase 4: ドメイン + SSL 設定

### 4-1. DuckDNS で無料ドメイン取得

[DuckDNS](https://www.duckdns.org/) にログインし、サブドメインを作成。パブリック IP を登録します（例: `your-name.duckdns.org`）。

### 4-2. Nginx リバースプロキシ + Let's Encrypt

```bash
sudo apt install nginx certbot python3-certbot-nginx -y

# Nginx 設定
sudo tee /etc/nginx/sites-available/n8n << 'EOF'
server {
    server_name your-name.duckdns.org;
    location / {
        proxy_pass http://localhost:5678;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/n8n /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL証明書取得（自動更新込み）
sudo certbot --nginx -d your-name.duckdns.org
```

`docker-compose.yml` の `N8N_SECURE_COOKIE` を `true` に変更して再起動。
`https://your-name.duckdns.org` でアクセスできれば完了です。

## Phase 5: 外部連携（Webhook 活用）

ここまでで、外部から HTTPS で Webhook を叩ける n8n 環境が完成しています。

### Webhook ワークフローの基本形

1. **Webhook ノード**: Path を設定（例: `my-webhook`）、HTTP Method = POST
2. **処理ノード**: Code ノード、HTTP Request ノードなど
3. **Respond to Webhook ノード**: JSON で結果を返す

```bash
# 呼び出し例
curl -s -X POST https://your-name.duckdns.org/webhook/my-webhook \
  -H "Content-Type: application/json" \
  -d '{"message": "hello"}'
```

### n8n REST API

n8n の Settings > API で API Key を発行すると、ワークフローの CRUD 操作が外部から可能になります。

```bash
curl -s https://your-name.duckdns.org/api/v1/workflows \
  -H "X-N8N-API-KEY: your-api-key"
```

## ハマりポイント

| 問題 | 対処法 |
|------|--------|
| ARM A1 が確保できない | AMD Micro で代替。性能は十分 |
| n8n がメモリ不足で落ちる | 2GB Swap を追加する |
| Webhook が 404 になる | ワークフローを **Publish** したか確認 |
| Secure Cookie エラー | SSL 設定前は `N8N_SECURE_COOKIE=false` |
| OCI からアクセスできない | Ubuntu iptables と OCI セキュリティリスト両方を確認 |

## 費用

全て無料です。

- Oracle Cloud: Always Free 枠（AMD Micro VM、10GB ストレージ）
- DuckDNS: 無料ドメイン
- Let's Encrypt: 無料 SSL 証明書（自動更新）
- n8n: Community Edition（セルフホスト無料）
