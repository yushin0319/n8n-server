# Notion Database Schemas

n8n ワークフローが操作する Notion データベースの定義。

## Tasks DB

- **DB ID**: `2a02570f-e49f-802b-a67c-fe4c230a5699`
- **Webhook**: `notion-tasks`
- **WF ID**: `c8ZI0oriZgjePMud`

| プロパティ | 型 | 値 / 備考 |
|-----------|-----|----------|
| *(タイトル)* | title | タスク名（プロパティ名は空文字列 `""`) |
| ステータス | status | `未着手` / `完了` |
| ID | unique_id | 自動採番 |
| 親タスク | relation | 親タスクの Page ID |
| 子タスク | relation | 子タスクの Page ID |
| 最終更新日時 | last_edited_time | 自動管理 |

**補足**:
- `cover`: 任意。未指定時は n8n 側で Unsplash ランダム選択
- ページ本文: blocks API で段落追加可能（`content` フィールド、`\n` 区切り）
- アクション: list / create / update / search / get

---

## 重要メール DB

- **DB ID**: `2ff2570f-e49f-8119-aaaf-f688605e5aa3`
- **Webhook**: `notion-emails`
- **WF ID**: `eR0S42ouMZUeNKG6`
- **取込 WF**: `oGx9uiLsxLGfGDcJ`（Gmail → Gemini 分類 → Notion、1時間毎）

| プロパティ | 型 | 値 / 備考 |
|-----------|-----|----------|
| 件名 | title | メール件名 |
| 差出人 | rich_text | 送信者アドレス |
| 日時 | date | メール受信日時 |
| 重要度 | select | `重要` / `不要` / `確認` |
| スニペット | rich_text | メール本文プレビュー |
| ステータス | select | `未読` / `既読` |
| 理由 | rich_text | Gemini 分類理由 |

**重要度の分類基準**（Gemini が自動判定）:
- **重要**: 銀行・金融、インフラ通知（Oracle Cloud 等）、セキュリティ、個人宛重要連絡
- **不要**: 広告・宣伝、自動通知（GitHub 等）、飲食店プロモ、ポイント通知
- **確認**: 判断できないもの（デフォルト）

**アクション**: update / search / briefing

---

## ニュース DB

- **DB ID**: `2ff2570f-e49f-817d-8288-e7c8667641a9`
- **Webhook**: `notion-news`
- **WF ID**: `VamRqRKYszmI2Mdh`
- **取込 WF**: `zV7aOFYfN4AUWmOL`（Zenn + HN → Gemini 翻訳・スコアリング → Notion、日次 0:00）

| プロパティ | 型 | 値 / 備考 |
|-----------|-----|----------|
| タイトル | title | 記事タイトル |
| URL | url | 記事 URL |
| カテゴリ | select | `テック` |
| ソース | rich_text | `Zenn` / `Hacker News` |
| 日付 | date | 記事公開日（YYYY-MM-DD） |
| 要約 | rich_text | 記事要約（最大300文字） |
| 既読 | checkbox | 処理済みフラグ |
| 注目 | checkbox | 興味プロファイル上位5件 |

**アクション**: update / search / briefing

---

## 定期タスク定義 DB

- **DB ID**: `3142570f-e49f-80cf-8383-cc62030339c9`
- **WF ID**: `NKY960IvoIjpLH6m`（日次 7:30、定義 → Tasks 自動生成）

| プロパティ | 型 | 値 / 備考 |
|-----------|-----|----------|
| タスク名 | title | 生成するタスクの名前 |
| 頻度 | select | `毎日` / `毎週` / `毎月` |
| 次回予定日 | date | 次にタスク生成する日 |
| 最終実行日 | date | 最後にタスク生成した日 |
| テンプレ本文 | rich_text | タスク本文テンプレート |
| 有効 | checkbox | false で生成停止 |

**補足**: Webhook なし。スケジュール WF からのみ使用。
