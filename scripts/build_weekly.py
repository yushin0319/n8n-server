"""shirankedo-weekly.json を生成するスクリプト（Phase 3-4: Step 1, 2, 4, 5, 6）"""
import json
import uuid

WF_ID = "VhYZCXeMg7PyDHCQ"
API_BASE = "https://shirankedo.y-fudo.workers.dev"
DISCORD_URL = "http://localhost:5678/webhook/discord-notify"

# Credential IDs
CRED_API = {"httpHeaderAuth": {"id": "CdkfLkdZEMFfnx8h", "name": "Header Auth account"}}
CRED_GEMINI = {"googlePalmApi": {"id": "rlflsmwVLnPi2SAN", "name": "Google Gemini(PaLM) Api account"}}
CRED_GITHUB = {"githubApi": {"id": "GMg4fnokNoF4q4MU", "name": "GitHub account"}}

def uid():
    return str(uuid.uuid4())


nodes = []
connections = {}

def add_node(name, node_type, type_version, params, position, credentials=None, on_error=None):
    node = {
        "parameters": params,
        "id": uid(),
        "name": name,
        "type": node_type,
        "typeVersion": type_version,
        "position": position,
    }
    if credentials:
        node["credentials"] = credentials
    if on_error:
        node["onError"] = on_error
    nodes.append(node)
    return name

def connect(src, dst, src_out=0, dst_in=0):
    if src not in connections:
        connections[src] = {"main": []}
    main = connections[src]["main"]
    while len(main) <= src_out:
        main.append([])
    main[src_out].append({"node": dst, "type": "main", "index": dst_in})


# ===== Schedule Trigger =====
# 週次: 月曜 3:00 JST = 日曜 18:00 UTC
add_node("Schedule", "n8n-nodes-base.scheduleTrigger", 1.2, {
    "rule": {
        "interval": [{
            "field": "weeks",
            "triggerAtDay": [1],  # Monday
            "triggerAtHour": 18,  # 18:00 UTC = 3:00 JST
        }]
    }
}, [200, 600])

# =========================================
# Step 1: Star取得
# =========================================
# FetchTrackingRepos
add_node("FetchTrackingRepos", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "GET",
    "url": f"{API_BASE}/api/ingest/tracking-repos",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpHeaderAuth",
    "options": {}
}, [480, 400], CRED_API)

# BuildStarBatches - 50リポ/バッチでGraphQLクエリ構築（200だとGitHub Resource Limit超過）
add_node("BuildStarBatches", "n8n-nodes-base.code", 2, {
    "jsCode": """// tracking-reposからstar取得用GraphQLバッチを構築（50リポ/バッチ）
const repos = $input.first().json.data || [];
if (!repos.length) return [{ json: { batches: [], count: 0 } }];

const batchSize = 50;
const batches = [];
for (let i = 0; i < repos.length; i += batchSize) {
  const batch = repos.slice(i, i + batchSize);
  const parts = batch.map((r, idx) => {
    const [owner, name] = r.repo.split('/');
    return `r${i+idx}: repository(owner: "${owner}", name: "${name}") { nameWithOwner stargazerCount }`;
  });
  batches.push({ json: { query: `{${parts.join(' ')}}`, batchIndex: batches.length } });
}
return batches;"""
}, [720, 400])

# SplitStarBatches
add_node("SplitStarBatches", "n8n-nodes-base.splitInBatches", 3, {
    "batchSize": 1,
    "options": {}
}, [960, 400])

# FetchStarBatch
add_node("FetchStarBatch", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": "https://api.github.com/graphql",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "githubApi",
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ JSON.stringify({ query: $json.query }) }}',
    "options": {}
}, [1200, 300], CRED_GITHUB)

# AccumulateStars
add_node("AccumulateStars", "n8n-nodes-base.code", 2, {
    "jsCode": """// 各バッチのGraphQL結果からstar数をstaticDataに蓄積
const staticData = $getWorkflowStaticData('global');
if (!staticData.stars) staticData.stars = [];
const data = $input.first().json.data || $input.first().json || {};
for (const key of Object.keys(data)) {
  const repo = data[key];
  if (!repo || !repo.nameWithOwner) continue;
  staticData.stars.push({ repo: repo.nameWithOwner, stars: repo.stargazerCount });
}
return $input.all();"""
}, [1440, 400])

# ParseStars - staticDataから全star結果を読み出し
add_node("ParseStars", "n8n-nodes-base.code", 2, {
    "jsCode": """// staticDataからstar結果を取り出してPOST用に整形
const staticData = $getWorkflowStaticData('global');
const stars = staticData.stars || [];
staticData.stars = [];

// 50件チャンクに分割
const chunks = [];
for (let i = 0; i < stars.length; i += 50) {
  chunks.push(stars.slice(i, i + 50));
}
if (chunks.length === 0) chunks.push([]);

return chunks.map((chunk, idx) => ({
  json: {
    requestBody: JSON.stringify(chunk),
    count: chunk.length,
    chunkIndex: idx,
    totalChunks: chunks.length,
    totalStars: stars.length,
  }
}));"""
}, [1200, 500])

# SplitStarChunks - 50件チャンクを順次POST
add_node("SplitStarChunks", "n8n-nodes-base.splitInBatches", 3, {
    "batchSize": 1,
    "options": {}
}, [1440, 500])

# PostRepoStats
add_node("PostRepoStats", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": f"{API_BASE}/api/ingest/repo-stats",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpHeaderAuth",
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ $json.requestBody }}',
    "options": {}
}, [1680, 400], CRED_API, "continueErrorOutput")

# AccumulatePostResults
add_node("AccumulatePostResults", "n8n-nodes-base.code", 2, {
    "jsCode": """// POST結果をstaticDataに蓄積
const staticData = $getWorkflowStaticData('global');
if (!staticData.postResults) staticData.postResults = { total: 0, errors: 0 };
const res = $input.first().json;
if (res && res.ok) {
  staticData.postResults.total += (res.inserted || 0);
} else {
  staticData.postResults.errors += 1;
}
return $input.all();"""
}, [1920, 500])

# ParsePostResults
add_node("ParsePostResults", "n8n-nodes-base.code", 2, {
    "jsCode": """// staticDataからPOST結果を読み出し
const staticData = $getWorkflowStaticData('global');
const results = staticData.postResults || { total: 0, errors: 0 };
staticData.postResults = null;
return [{ json: results }];"""
}, [1680, 600])

# PrepareDiscordStars
add_node("PrepareDiscordStars", "n8n-nodes-base.code", 2, {
    "jsCode": """const r = $input.first().json;
const msg = r.errors > 0
  ? `❌ Star取得一部失敗: ${r.total}件成功, ${r.errors}件エラー`
  : `✅ Star取得完了: ${r.total}件`;
return [{ json: { message: msg } }];"""
}, [1920, 600])

# DiscordNotifyStars
add_node("DiscordNotifyStars", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": DISCORD_URL,
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ JSON.stringify({ message: $json.message }) }}',
    "options": {}
}, [2160, 600])

# =========================================
# Step 4: 週次レポート生成
# =========================================
# FetchRecentArticles
add_node("FetchRecentArticles", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "GET",
    "url": f"{API_BASE}/api/ingest/articles/recent?days=7",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpHeaderAuth",
    "options": {}
}, [480, 800], CRED_API)

# PrepareWeeklyPrompt
add_node("PrepareWeeklyPrompt", "n8n-nodes-base.code", 2, {
    "jsCode": """// 直近7日の記事からGemini週次レポート用プロンプトを構築
const articles = $input.first().json.data || [];
if (!articles.length) {
  return [{ json: { prompt: '', hasArticles: false, count: 0 } }];
}

const articleList = articles.map((a, i) =>
  `${i+1}. [${a.source}] ${a.title}\\n   要約: ${a.summary}\\n   タグ: ${a.tags}`
).join('\\n\\n');

const prompt = `以下の今週の記事一覧を分析し、週次サマリーを作成せよ。
このサマリーはページコメント生成AIへの入力として使われる内部資料である。

## 出力フォーマット
- 箇条書きで簡潔に（装飾・挨拶・口調の工夫は不要）
- 今週の主要トピックを3〜5個に分類し、各トピックに関連記事を紐づける
- 各トピックは「何が起きたか」「なぜ重要か」を1〜2文で記述
- AI/LLM関連、セキュリティ関連、開発ツール関連の話題は必ず拾うこと

## 今週の記事（${articles.length}件）
${articleList}`;

return [{ json: { prompt, hasArticles: true, count: articles.length } }];"""
}, [720, 800])

# HasArticlesForReport
add_node("HasArticlesForReport", "n8n-nodes-base.if", 2.2, {
    "conditions": {
        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
        "conditions": [{
            "id": uid(),
            "leftValue": "={{ $json.hasArticles }}",
            "rightValue": True,
            "operator": {"type": "boolean", "operation": "true"}
        }],
        "combinator": "and"
    }
}, [960, 800])

# GeminiWeeklyReport
add_node("GeminiWeeklyReport", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "googlePalmApi",
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ JSON.stringify({ contents: [{ parts: [{ text: $json.prompt }] }], generationConfig: { temperature: 0.3 } }) }}',
    "options": {}
}, [1200, 700], CRED_GEMINI)

# FormatWeeklyReport
add_node("FormatWeeklyReport", "n8n-nodes-base.code", 2, {
    "jsCode": """// Geminiレスポンスからレポートテキストを抽出
const resp = $input.first().json;
const reportContent = resp.candidates?.[0]?.content?.parts?.[0]?.text || '';
if (!reportContent) {
  return [{ json: { requestBody: JSON.stringify({ content: '生成失敗' }), reportContent: '' } }];
}
return [{ json: {
  requestBody: JSON.stringify({ content: reportContent }),
  reportContent
} }];"""
}, [1440, 700])

# PostWeeklySummary
add_node("PostWeeklySummary", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": f"{API_BASE}/api/ingest/weekly-summaries",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpHeaderAuth",
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ $json.requestBody }}',
    "options": {}
}, [1680, 700], CRED_API, "continueErrorOutput")

# EmptyWeeklyResult
add_node("EmptyWeeklyResult", "n8n-nodes-base.code", 2, {
    "jsCode": 'return [{ json: { message: "記事なし、週次レポートスキップ" } }];'
}, [1200, 900])

# MergeWeeklyPaths
add_node("MergeWeeklyPaths", "n8n-nodes-base.merge", 3.1, {
    "mode": "append",
    "options": {}
}, [1920, 800])

# PrepareDiscordWeekly
add_node("PrepareDiscordWeekly", "n8n-nodes-base.code", 2, {
    "jsCode": """const r = $input.first().json;
const ok = r.ok !== undefined ? r.ok : false;
const msg = ok
  ? '✅ 週次レポート生成完了'
  : r.message || '❌ 週次レポート生成失敗: ' + JSON.stringify(r).substring(0, 200);
return [{ json: { message: msg } }];"""
}, [2160, 800])

# DiscordNotifyWeekly
add_node("DiscordNotifyWeekly", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": DISCORD_URL,
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ JSON.stringify({ message: $json.message }) }}',
    "options": {}
}, [2400, 800])

# =========================================
# Step 5: ページコメント生成 (Step 4完了後)
# =========================================
# FetchRecentSummaries
add_node("FetchRecentSummaries", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "GET",
    "url": f"{API_BASE}/api/ingest/weekly-summaries/recent?limit=4",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpHeaderAuth",
    "options": {}
}, [2640, 700], CRED_API)

# PreparePageCommentPrompts
add_node("PreparePageCommentPrompts", "n8n-nodes-base.code", 2, {
    "jsCode": """// 直近4週の週次サマリーからページコメント3件分のプロンプトを構築
const summaries = $input.first().json.data || [];
const summaryText = summaries.map((s, i) =>
  `【${i+1}週前】\\n${s.content || s.reportContent || ''}`
).join('\\n\\n---\\n\\n');

if (!summaryText.trim()) {
  return [{ json: { hasSummaries: false } }];
}

const toneRules = `## 口調ルール
「ギャルっぽい記号を貼り付けた文章」ではなく「ギャルが実際に喋りそうな文章」を書け。
- 一人称「うち」。語尾「〜じゃん」「〜っしょ」「〜くない？」「〜じゃね？」「〜だし」
- 強調「マジで」「ガチで」「超」「鬼」。感嘆「やば」「えぐ」「つよ」（体言止め）
- テンションに緩急をつけろ。常時MAXはウソくさい。重い話は静かにしんどがれ
- 絵文字は0〜1個。使わなくていい。効かせる時だけ
- 「おけまる」「わかりみが深い」「あーし」は古い。使うな
- 同じ語彙の連打禁止。「マジ？」「ヤバすぎ！」を毎回使うな
- 1文目の入り方を毎回変えろ。同じパターンで始めるな
- 「知らんけど」は毎回入れない。くどくなる`;

const formatRules = `## フォーマット
- 150〜300文字で書くこと。短すぎも長すぎもダメ
- 「何が起きたか」だけでなく「それに対してどう感じるか」を必ず含めること
- 事実の羅列は禁止。読んだ人が「ふーん」で終わるコメントは失敗
- 最後まで書ききること。文の途中で終わるな`;

const trendPrompt = `あなたはテック系トレンドページの総評コメントを書くライターです。

${toneRules}

${formatRules}

## このコメントの役割
テック業界全体のトレンドページに表示される総評。
以下の週次レポートを参考にしつつ、今のテック業界で何が熱いか・どこに向かってるかを語れ。
具体的なプロジェクト名やツール名を挙げて、抽象論で逃げるな。

## 直近の週次レポート
${summaryText}`;

const aiApiPrompt = `あなたはAI API・LLMの比較ページの総評コメントを書くライターです。

${toneRules}

${formatRules}

## このコメントの役割
AI APIの料金・性能比較ページに表示される総評。
以下の週次レポートからAI・LLM関連の話題を拾い、最近のモデル動向・API機能・価格の変化について語れ。
月額目安（独自算出値）には言及しないこと。
具体的なモデル名やサービス名を挙げて語れ。

## 直近の週次レポート
${summaryText}`;

const aiSubPrompt = `あなたはAIサブスクリプション比較ページの総評コメントを書くライターです。

${toneRules}

${formatRules}

## このコメントの役割
ChatGPT / Claude / Gemini 等のサブスクプラン比較ページに表示される総評。
以下の週次レポートを参考に、最近のAIサブスク事情（料金変更、新プラン、使い分け戦略）について語れ。
開発者・ユーザー目線で「結局どれ使えばいいの？」に答える方向性で。

## 直近の週次レポート
${summaryText}`;

return [{ json: {
  hasSummaries: true,
  trendPrompt,
  aiApiPrompt,
  aiSubPrompt
} }];"""
}, [2880, 700])

# HasSummariesForComments
add_node("HasSummariesForComments", "n8n-nodes-base.if", 2.2, {
    "conditions": {
        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
        "conditions": [{
            "id": uid(),
            "leftValue": "={{ $json.hasSummaries }}",
            "rightValue": True,
            "operator": {"type": "boolean", "operation": "true"}
        }],
        "combinator": "and"
    }
}, [3120, 700])

# GeminiTrendComment
add_node("GeminiTrendComment", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "googlePalmApi",
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ JSON.stringify({ contents: [{ parts: [{ text: $json.trendPrompt }] }], generationConfig: { temperature: 0.8 } }) }}',
    "options": {}
}, [3360, 600], CRED_GEMINI)

# FormatTrendComment
add_node("FormatTrendComment", "n8n-nodes-base.code", 2, {
    "jsCode": """const resp = $input.first().json;
const trendText = resp.candidates?.[0]?.content?.parts?.[0]?.text || '生成失敗';
// 前ノードのプロンプト情報を引き継ぐ
const prev = $('HasSummariesForComments').first().json;
return [{ json: {
  trendComment: trendText,
  aiApiPrompt: prev.aiApiPrompt,
  aiSubPrompt: prev.aiSubPrompt
} }];"""
}, [3600, 600])

# GeminiAIApiComment
add_node("GeminiAIApiComment", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "googlePalmApi",
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ JSON.stringify({ contents: [{ parts: [{ text: $json.aiApiPrompt }] }], generationConfig: { temperature: 0.8 } }) }}',
    "options": {}
}, [3840, 600], CRED_GEMINI)

# FormatAIApiComment
add_node("FormatAIApiComment", "n8n-nodes-base.code", 2, {
    "jsCode": """const resp = $input.first().json;
const aiApiText = resp.candidates?.[0]?.content?.parts?.[0]?.text || '生成失敗';
const prev = $('FormatTrendComment').first().json;
return [{ json: {
  trendComment: prev.trendComment,
  aiApiComment: aiApiText,
  aiSubPrompt: prev.aiSubPrompt
} }];"""
}, [4080, 600])

# GeminiAISubComment
add_node("GeminiAISubComment", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "googlePalmApi",
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ JSON.stringify({ contents: [{ parts: [{ text: $json.aiSubPrompt }] }], generationConfig: { temperature: 0.8 } }) }}',
    "options": {}
}, [4320, 600], CRED_GEMINI)

# FormatPageComments
add_node("FormatPageComments", "n8n-nodes-base.code", 2, {
    "jsCode": """const resp = $input.first().json;
const aiSubText = resp.candidates?.[0]?.content?.parts?.[0]?.text || '生成失敗';
const prev = $('FormatAIApiComment').first().json;

const comments = [
  { type: 'trend', content: prev.trendComment },
  { type: 'ai_api', content: prev.aiApiComment },
  { type: 'ai_sub', content: aiSubText },
];

return [{ json: {
  requestBody: JSON.stringify(comments),
  count: comments.length
} }];"""
}, [4560, 600])

# PostPageComments
add_node("PostPageComments", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": f"{API_BASE}/api/ingest/page-comments",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpHeaderAuth",
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ $json.requestBody }}',
    "options": {}
}, [4800, 600], CRED_API, "continueErrorOutput")

# EmptyCommentResult
add_node("EmptyCommentResult", "n8n-nodes-base.code", 2, {
    "jsCode": 'return [{ json: { message: "サマリーなし、ページコメントスキップ" } }];'
}, [3360, 800])

# MergeCommentPaths
add_node("MergeCommentPaths", "n8n-nodes-base.merge", 3.1, {
    "mode": "append",
    "options": {}
}, [5040, 700])

# PrepareDiscordComments
add_node("PrepareDiscordComments", "n8n-nodes-base.code", 2, {
    "jsCode": """const r = $input.first().json;
const ok = r.ok !== undefined ? r.ok : false;
const msg = ok
  ? '✅ ページコメント生成完了: 3件'
  : r.message || '❌ ページコメント生成失敗: ' + JSON.stringify(r).substring(0, 200);
return [{ json: { message: msg } }];"""
}, [5280, 700])

# DiscordNotifyComments
add_node("DiscordNotifyComments", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": DISCORD_URL,
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ JSON.stringify({ message: $json.message }) }}',
    "options": {}
}, [5520, 700])

# =========================================
# Step 2: LLM価格取得
# =========================================
# AA APIからモデル情報（価格+ELOスコア）取得
add_node("FetchAAModels", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "GET",
    "url": "https://api.artificial-analysis.com/api/v2/data/text",
    "options": {}
}, [480, 1200])

# 為替レート取得
add_node("FetchExchangeRate", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "GET",
    "url": "https://api.exchangerate-api.com/v4/latest/USD",
    "options": {}
}, [480, 1400])

# ParseLLMData - gen_table.pyのフィルタロジックをJS移植
add_node("ParseLLMData", "n8n-nodes-base.code", 2, {
    "jsCode": """// AA APIデータからモデルをフィルタ・デデュプして56モデルに絞る
const aaResp = $('FetchAAModels').first().json;
const rateResp = $('FetchExchangeRate').first().json;
const aaData = aaResp.data || [];
const jpyRate = rateResp?.rates?.JPY || 150;

// Provider mapping
const PROVIDERS = {
  'Anthropic': 'Anthropic', 'OpenAI': 'OpenAI', 'Google': 'Google',
  'DeepSeek': 'DeepSeek', 'xAI': 'xAI', 'Meta': 'Meta',
  'Mistral': 'Mistral', 'Alibaba': 'Alibaba', 'Kimi': 'Moonshot',
  'MiniMax': 'MiniMax', 'Z AI': 'Zhipu AI', 'Xiaomi': 'Xiaomi',
  'Amazon': 'Amazon', 'Microsoft': 'Microsoft',
};

// Step 1: Basic filter
const filtered = [];
for (const m of aaData) {
  const name = m.name || '';
  const creatorName = m.model_creator?.name || '';
  let provider = null;
  for (const [pname, display] of Object.entries(PROVIDERS)) {
    if (creatorName.toLowerCase().includes(pname.toLowerCase())) {
      provider = display; break;
    }
  }
  if (!provider) continue;
  const pricing = m.pricing || {};
  const inp = pricing.price_1m_input_tokens;
  const out = pricing.price_1m_output_tokens;
  if (inp == null || out == null || (inp === 0 && out === 0)) continue;
  if (name.toLowerCase().includes('codex')) continue;
  const intel = m.evaluations?.artificial_analysis_intelligence_index;
  if (intel == null) continue;
  filtered.push({ name, provider, score: intel, inputPrice: inp, outputPrice: out });
}

// Step 2: Skip patterns
function shouldSkip(name) {
  const skipExact = ['Distill','Mixtral','Ministral','Pixtral','Devstral','gpt-oss','Gemma'];
  if (skipExact.some(x => name.includes(x))) return true;
  if (['GPT-3.5','Llama 2 ','Mistral 7B'].some(x => name.includes(x))) return true;
  if (name === 'o1-preview' || name === 'o1-pro') return true;
  if (name.includes('Llama')) {
    if (!['Llama 4 Maverick','Llama 4 Scout','Llama 3.3'].some(a => name.includes(a))) return true;
  }
  if (['Mistral Small','Mistral Medium','Mistral Large'].includes(name)) return true;
  if (['Claude 4 Opus','Claude 4.1 Opus'].some(x => name.includes(x))) return true;
  if (name.includes('Magistral Small')) return true;
  if (['Qwen3 VL','Qwen3.5 VL','Coder','Omni','QwQ','Qwen2','Qwen Chat'].some(x => name.includes(x))) return true;
  if (/Qwen3\\.?5?\\s+[0-4](?:\\.\\d+)?B\\b/.test(name)) return true;
  if (/^Qwen3 \\d+B/.test(name) && !name.includes('Qwen3 Max')) return true;
  if (name.includes('Qwen3 Next')) return true;
  if (name.includes('GLM') && (/V /.test(name) || /V\\(/.test(name))) return true;
  if (name.includes('GLM-4.5-Air')) return true;
  if (name.includes('Nova') && name.includes('Omni')) return true;
  return false;
}

// Step 3: Family key dedup
function familyKey(n) {
  let c = n.replace(/\\s*\\(.*?\\)/g, '');
  c = c.replace(/\\s*-\\s*\\d{4}-\\d{2}-\\d{2}$/, '');
  c = c.replace(/\\s*(Preview|Exp|Terminus)\\b/g, '');
  c = c.replace(/\\s+\\d{4}$/, '');
  c = c.replace(/(Mistral (?:Small|Medium|Large|Magistral \\w+))\\s+[\\d.]+/g, '$1');
  if (/^GPT-5(\\.\\d+)?$/.test(c)) c = 'GPT-5';
  c = c.replace(/(DeepSeek V3)[\\d.]*/g, '$1');
  c = c.replace(/(DeepSeek R1)[\\s\\d]*/g, '$1');
  c = c.replace(/Grok [\\d.]+ Fast/g, 'Grok Fast');
  c = c.replace(/Gemini 3\\.\\d+ Pro/g, 'Gemini 3 Pro');
  c = c.replace(/Gemini (\\d+)\\.(\\d+) (Flash-Lite|Flash)$/g, 'Gemini $1 $3');
  c = c.replace(/(Qwen3\\.5 \\d+B(?: A\\d+B)?)\\s+\\d{4}/g, '$1');
  c = c.replace(/(Qwen3 \\d+B(?: A\\d+B)?)\\s+\\d{4}/g, '$1');
  c = c.replace(/Qwen3 Max.*/g, 'Qwen3 Max');
  c = c.replace(/Kimi K2\\.5.*/g, 'Kimi K2.5');
  c = c.replace(/Kimi K2(?!\\.5).*/g, 'Kimi K2');
  c = c.replace(/MiniMax-M2\\.\\d+/g, 'MiniMax-M2');
  c = c.replace(/MiniMax M2/g, 'MiniMax-M2');
  c = c.replace(/(GLM-\\d+(?:\\.\\d+)?)\\b.*/g, '$1');
  c = c.replace(/(MiMo-V2-Flash).*/g, '$1');
  c = c.replace(/(Nova \\d+\\.\\d+ (?:Pro|Lite|Omni)).*/g, '$1');
  c = c.replace(/(Nova Premier).*/g, '$1');
  return c.trim();
}

const families = {};
for (const m of filtered) {
  if (shouldSkip(m.name)) continue;
  const fk = familyKey(m.name);
  if (!families[fk] || m.score > families[fk].score) {
    families[fk] = m;
  }
}

// Step 4: Sort + cut below 15
const models = Object.values(families)
  .filter(m => m.score >= 15)
  .sort((a, b) => b.score - a.score)
  .map(m => {
    const cleanName = m.name.replace(/\\s*\\(.*?\\)/g, '').trim();
    return {
      modelName: cleanName,
      provider: m.provider,
      score: m.score,
      inputPrice: m.inputPrice,
      outputPrice: m.outputPrice,
      currency: 'USD',
    };
  });

// 出力: [0] LLMモデル配列, [1] 為替レート
return [
  { json: {
    requestBody: JSON.stringify(models),
    count: models.length,
    type: 'llm-models'
  }},
  { json: {
    requestBody: JSON.stringify({ jpyPerUsd: jpyRate, updatedAt: new Date().toISOString() }),
    type: 'exchange-rate'
  }}
];"""
}, [960, 1300])

# PostLLMModels - SplitInBatchesなしで一括POST（56件なので）
add_node("PostLLMModels", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": f"{API_BASE}/api/ingest/llm-models",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpHeaderAuth",
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ $json.requestBody }}',
    "options": {}
}, [1200, 1200], CRED_API, "continueErrorOutput")

# PostExchangeRate
add_node("PostExchangeRate", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": f"{API_BASE}/api/ingest/exchange-rate",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpHeaderAuth",
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ $json.requestBody }}',
    "options": {}
}, [1200, 1400], CRED_API, "continueErrorOutput")

# RouteLLMOutput - ParseLLMDataの出力を振り分け（type === llm-models → true, else → false）
add_node("RouteLLMOutput", "n8n-nodes-base.if", 2.2, {
    "conditions": {
        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
        "conditions": [{
            "id": uid(),
            "leftValue": "={{ $json.type }}",
            "rightValue": "llm-models",
            "operator": {"type": "string", "operation": "equals"}
        }],
        "combinator": "and"
    }
}, [960, 1100])

# PrepareDiscordLLM
add_node("PrepareDiscordLLM", "n8n-nodes-base.code", 2, {
    "jsCode": """const r = $input.first().json;
const ok = r.ok !== undefined ? r.ok : false;
const count = r.inserted || 0;
const updated = r.updated || 0;
const msg = ok
  ? `✅ LLM価格更新完了: ${count}件追加, ${updated}件更新`
  : '❌ LLM価格更新失敗: ' + JSON.stringify(r).substring(0, 200);
return [{ json: { message: msg } }];"""
}, [1440, 1200])

# DiscordNotifyLLM
add_node("DiscordNotifyLLM", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": DISCORD_URL,
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ JSON.stringify({ message: $json.message }) }}',
    "options": {}
}, [1680, 1200])

# =========================================
# Step 6: TrackingRepo更新（新規リポ発掘）
# =========================================
# FetchExistingRepos - 既存リポ一覧を取得（除外用）
add_node("FetchExistingRepos", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "GET",
    "url": f"{API_BASE}/api/ingest/tracking-repos",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpHeaderAuth",
    "options": {}
}, [480, 1800], CRED_API)

# BuildSearchQueries - 5ティアのGitHub Search URLを構築
add_node("BuildSearchQueries", "n8n-nodes-base.code", 2, {
    "jsCode": """// 5ティアのGitHub Search APIクエリを構築
const now = new Date();
const fmt = d => d.toISOString().slice(0, 10);
const ago = days => { const d = new Date(now); d.setDate(d.getDate() - days); return fmt(d); };

const tiers = [
  { q: 'stars:>50000', label: 'Tier1: ★50k+' },
  { q: `stars:10000..50000 pushed:>${ago(365)}`, label: 'Tier2: 1yr ★10k+' },
  { q: `stars:5000..10000 pushed:>${ago(180)}`, label: 'Tier3: 6mo ★5k+' },
  { q: `stars:2000..5000 pushed:>${ago(90)}`, label: 'Tier4: 3mo ★2k+' },
  { q: `stars:1000..2000 pushed:>${ago(30)}`, label: 'Tier5: 1mo ★1k+' },
];

// 各ティアを2ページずつ（最大200件/ティア）
const queries = [];
for (const tier of tiers) {
  for (let page = 1; page <= 2; page++) {
    queries.push({
      json: {
        url: `https://api.github.com/search/repositories?q=${encodeURIComponent(tier.q)}&sort=stars&order=desc&per_page=100&page=${page}`,
        label: tier.label,
        page,
      }
    });
  }
}
return queries;"""
}, [720, 1800])

# SplitSearchBatches
add_node("SplitSearchBatches", "n8n-nodes-base.splitInBatches", 3, {
    "batchSize": 1,
    "options": {}
}, [960, 1800])

# WaitSearchRate - GitHub Search API: 10 req/min制限
add_node("WaitSearchRate", "n8n-nodes-base.wait", 1.1, {
    "amount": 3,
    "unit": "seconds"
}, [1200, 1700])

# FetchGitHubSearch
add_node("FetchGitHubSearch", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "GET",
    "url": "={{ $json.url }}",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "githubApi",
    "options": {}
}, [1440, 1800], CRED_GITHUB, "continueErrorOutput")

# AccumulateSearchResults
add_node("AccumulateSearchResults", "n8n-nodes-base.code", 2, {
    "jsCode": """// 検索結果をstaticDataに蓄積
const staticData = $getWorkflowStaticData('global');
if (!staticData.searchRepos) staticData.searchRepos = [];
const items = $input.first().json.items || [];
for (const r of items) {
  staticData.searchRepos.push({
    repo: r.full_name,
    name: r.name,
    description: r.description || '',
    language: r.language || '',
    stars: r.stargazers_count,
  });
}
return $input.all();"""
}, [1680, 1800])

# ParseSearchResults - staticDataから読み出し+フィルタ+既存除外
add_node("ParseSearchResults", "n8n-nodes-base.code", 2, {
    "jsCode": """// staticDataから検索結果を読み出し、フィルタ・既存除外
const staticData = $getWorkflowStaticData('global');
const allRepos = staticData.searchRepos || [];
staticData.searchRepos = [];

// 既存リポ一覧
const existingRepos = $('FetchExistingRepos').first().json.data || [];
const existingSet = new Set(existingRepos.map(r => r.repo.toLowerCase()));

// ブロックリスト
const blocklist = [
  'awesome','interview','free-programming-books','build-your-own',
  'public-apis','developer-roadmap','system-design','cheatsheet',
  'learn-','tutorial','roadmap','study-plan','coding-guide',
  'freeCodeCamp','computer-science','project-based-learning',
  'the-art-of-command-line','the-book-of-secret-knowledge',
];

// デデュプ（repo名で）
const seen = new Set();
const deduped = [];
for (const r of allRepos) {
  const key = r.repo.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  deduped.push(r);
}

// フィルタ: 言語あり + ブロックリスト除外 + 既存除外
const newRepos = deduped.filter(r => {
  if (!r.language) return false;
  const name = r.repo.toLowerCase();
  if (blocklist.some(kw => name.includes(kw))) return false;
  if (existingSet.has(name)) return false;
  return true;
});

if (newRepos.length === 0) {
  return [{ json: { hasNewRepos: false, count: 0 } }];
}

// Gemini翻訳用にバッチ化（20件ずつ）
const batchSize = 20;
const batches = [];
for (let i = 0; i < newRepos.length; i += batchSize) {
  batches.push(newRepos.slice(i, i + batchSize));
}

return [{ json: {
  hasNewRepos: true,
  count: newRepos.length,
  batches: batches,
  totalBatches: batches.length,
} }];"""
}, [1440, 1900])

# HasNewRepos
add_node("HasNewRepos", "n8n-nodes-base.if", 2.2, {
    "conditions": {
        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
        "conditions": [{
            "id": uid(),
            "leftValue": "={{ $json.hasNewRepos }}",
            "rightValue": True,
            "operator": {"type": "boolean", "operation": "true"}
        }],
        "combinator": "and"
    }
}, [1680, 1900])

# PrepareTranslatePrompt - 新規リポのdescriptionをGemini翻訳
add_node("PrepareTranslatePrompt", "n8n-nodes-base.code", 2, {
    "jsCode": """// バッチごとにGemini翻訳プロンプトを構築
const data = $input.first().json;
const batches = data.batches || [];
const results = [];

for (const batch of batches) {
  const lines = batch.map((r, i) =>
    `${i+1}. ${r.repo}: ${r.description || 'No description'}`
  ).join('\\n');

  const prompt = `以下のGitHubリポジトリの説明文を日本語に翻訳してください。
リポジトリ名は翻訳しないでください。
各行を「番号. 翻訳文」の形式で返してください。説明がない場合は適切な説明を補ってください。

${lines}`;

  results.push({ json: { prompt, repos: batch, batchIndex: results.length } });
}
return results;"""
}, [1920, 1800])

# SplitTranslateBatches
add_node("SplitTranslateBatches", "n8n-nodes-base.splitInBatches", 3, {
    "batchSize": 1,
    "options": {}
}, [2160, 1800])

# GeminiTranslateRepos
add_node("GeminiTranslateRepos", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "googlePalmApi",
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ JSON.stringify({ contents: [{ parts: [{ text: $json.prompt }] }], generationConfig: { temperature: 0.2 } }) }}',
    "options": {}
}, [2400, 1700], CRED_GEMINI)

# AccumulateTranslations
add_node("AccumulateTranslations", "n8n-nodes-base.code", 2, {
    "jsCode": """// Gemini翻訳結果を解析してstaticDataに蓄積
const staticData = $getWorkflowStaticData('global');
if (!staticData.translations) staticData.translations = [];

const resp = $input.first().json;
const text = resp.candidates?.[0]?.content?.parts?.[0]?.text || '';
const repos = $('SplitTranslateBatches').first().json.repos || [];

// 翻訳結果をパース（番号. 翻訳文）
const lines = text.split('\\n').filter(l => /^\\d+\\./.test(l.trim()));
for (let i = 0; i < repos.length; i++) {
  const r = repos[i];
  const line = lines[i] || '';
  const desc = line.replace(/^\\d+\\.\\s*/, '').trim() || r.description;
  // displayName: リポ名の後半（owner/name → name）
  const displayName = r.name || r.repo.split('/')[1] || r.repo;
  staticData.translations.push({
    repo: r.repo,
    displayName,
    description: desc,
    language: r.language,
  });
}
return $input.all();"""
}, [2640, 1800])

# ParseTranslations - staticDataから読み出してPOST用に整形
add_node("ParseTranslations", "n8n-nodes-base.code", 2, {
    "jsCode": """// staticDataから翻訳結果を読み出し
const staticData = $getWorkflowStaticData('global');
const repos = staticData.translations || [];
staticData.translations = [];

if (repos.length === 0) {
  return [{ json: { requestBody: '[]', count: 0 } }];
}

// 50件チャンクに分割
const chunks = [];
for (let i = 0; i < repos.length; i += 50) {
  chunks.push(repos.slice(i, i + 50));
}

return chunks.map((chunk, idx) => ({
  json: {
    requestBody: JSON.stringify(chunk),
    count: chunk.length,
    chunkIndex: idx,
    totalRepos: repos.length,
  }
}));"""
}, [2400, 1900])

# SplitRepoChunks
add_node("SplitRepoChunks", "n8n-nodes-base.splitInBatches", 3, {
    "batchSize": 1,
    "options": {}
}, [2640, 1900])

# PostTrackingRepos
add_node("PostTrackingRepos", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": f"{API_BASE}/api/ingest/tracking-repos",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "httpHeaderAuth",
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ $json.requestBody }}',
    "options": {}
}, [2880, 1800], CRED_API, "continueErrorOutput")

# AccumulateRepoPostResults
add_node("AccumulateRepoPostResults", "n8n-nodes-base.code", 2, {
    "jsCode": """const staticData = $getWorkflowStaticData('global');
if (!staticData.repoPostResults) staticData.repoPostResults = { total: 0, errors: 0 };
const res = $input.first().json;
if (res && res.ok) {
  staticData.repoPostResults.total += (res.inserted || 0);
} else {
  staticData.repoPostResults.errors += 1;
}
return $input.all();"""
}, [3120, 1900])

# ParseRepoPostResults
add_node("ParseRepoPostResults", "n8n-nodes-base.code", 2, {
    "jsCode": """const staticData = $getWorkflowStaticData('global');
const results = staticData.repoPostResults || { total: 0, errors: 0 };
staticData.repoPostResults = null;
return [{ json: results }];"""
}, [2880, 2000])

# EmptyRepoResult
add_node("EmptyRepoResult", "n8n-nodes-base.code", 2, {
    "jsCode": 'return [{ json: { message: "新規リポなし、スキップ" } }];'
}, [1920, 2000])

# MergeRepoPaths
add_node("MergeRepoPaths", "n8n-nodes-base.merge", 3.1, {
    "mode": "append",
    "options": {}
}, [3120, 2100])

# PrepareDiscordRepos
add_node("PrepareDiscordRepos", "n8n-nodes-base.code", 2, {
    "jsCode": """const r = $input.first().json;
if (r.message) return [{ json: { message: r.message } }];
const msg = r.errors > 0
  ? `❌ TrackingRepo更新一部失敗: ${r.total}件追加, ${r.errors}件エラー`
  : `✅ TrackingRepo更新完了: ${r.total}件追加`;
return [{ json: { message: msg } }];"""
}, [3360, 2100])

# DiscordNotifyRepos
add_node("DiscordNotifyRepos", "n8n-nodes-base.httpRequest", 4.2, {
    "method": "POST",
    "url": DISCORD_URL,
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": '={{ JSON.stringify({ message: $json.message }) }}',
    "options": {}
}, [3600, 2100])

# ===== Connections =====
# Schedule → parallel: Step 1 + Step 2 + Step 4 + Step 6
connect("Schedule", "FetchTrackingRepos")
connect("Schedule", "FetchRecentArticles")
connect("Schedule", "FetchAAModels")
connect("Schedule", "FetchExchangeRate")
connect("Schedule", "FetchExistingRepos")

# Step 1: Star取得
connect("FetchTrackingRepos", "BuildStarBatches")
connect("BuildStarBatches", "SplitStarBatches")
# SplitStarBatches v3: output[0]=done, output[1]=loop
connect("SplitStarBatches", "ParseStars", 0)       # done
connect("SplitStarBatches", "FetchStarBatch", 1)    # loop
connect("FetchStarBatch", "AccumulateStars")
connect("AccumulateStars", "SplitStarBatches")       # loop back
connect("ParseStars", "SplitStarChunks")
# SplitStarChunks v3: output[0]=done, output[1]=loop
connect("SplitStarChunks", "ParsePostResults", 0)    # done
connect("SplitStarChunks", "PostRepoStats", 1)       # loop
connect("PostRepoStats", "AccumulatePostResults", 0) # success
connect("PostRepoStats", "AccumulatePostResults", 1) # error
connect("AccumulatePostResults", "SplitStarChunks")   # loop back
connect("ParsePostResults", "PrepareDiscordStars")
connect("PrepareDiscordStars", "DiscordNotifyStars")

# Step 4: 週次レポート
connect("FetchRecentArticles", "PrepareWeeklyPrompt")
connect("PrepareWeeklyPrompt", "HasArticlesForReport")
connect("HasArticlesForReport", "GeminiWeeklyReport", 0)     # true
connect("HasArticlesForReport", "EmptyWeeklyResult", 1)      # false
connect("GeminiWeeklyReport", "FormatWeeklyReport")
connect("FormatWeeklyReport", "PostWeeklySummary")
connect("PostWeeklySummary", "MergeWeeklyPaths", 0, 0)       # success
connect("PostWeeklySummary", "MergeWeeklyPaths", 1, 0)       # error
connect("EmptyWeeklyResult", "MergeWeeklyPaths", 0, 1)
connect("MergeWeeklyPaths", "PrepareDiscordWeekly")
connect("PrepareDiscordWeekly", "DiscordNotifyWeekly")

# Step 5: ページコメント (Step 4完了後)
connect("DiscordNotifyWeekly", "FetchRecentSummaries")
connect("FetchRecentSummaries", "PreparePageCommentPrompts")
connect("PreparePageCommentPrompts", "HasSummariesForComments")
connect("HasSummariesForComments", "GeminiTrendComment", 0)   # true
connect("HasSummariesForComments", "EmptyCommentResult", 1)   # false
connect("GeminiTrendComment", "FormatTrendComment")
connect("FormatTrendComment", "GeminiAIApiComment")
connect("GeminiAIApiComment", "FormatAIApiComment")
connect("FormatAIApiComment", "GeminiAISubComment")
connect("GeminiAISubComment", "FormatPageComments")
connect("FormatPageComments", "PostPageComments")
connect("PostPageComments", "MergeCommentPaths", 0, 0)        # success
connect("PostPageComments", "MergeCommentPaths", 1, 0)        # error
connect("EmptyCommentResult", "MergeCommentPaths", 0, 1)
connect("MergeCommentPaths", "PrepareDiscordComments")
connect("PrepareDiscordComments", "DiscordNotifyComments")

# Step 2: LLM価格取得
connect("FetchAAModels", "ParseLLMData")
connect("FetchExchangeRate", "ParseLLMData")
connect("ParseLLMData", "RouteLLMOutput")
# RouteLLMOutput: IF node — type=llm-models → true(PostLLMModels), else → false(PostExchangeRate)
connect("RouteLLMOutput", "PostLLMModels", 0)      # true: llm-models
connect("RouteLLMOutput", "PostExchangeRate", 1)    # false: exchange-rate
connect("PostLLMModels", "PrepareDiscordLLM", 0)     # success
connect("PostLLMModels", "PrepareDiscordLLM", 1)     # error
connect("PostExchangeRate", "PrepareDiscordLLM", 0)  # success (ignored, LLM結果で通知)
connect("PostExchangeRate", "PrepareDiscordLLM", 1)  # error
connect("PrepareDiscordLLM", "DiscordNotifyLLM")

# Step 6: TrackingRepo更新
connect("FetchExistingRepos", "BuildSearchQueries")
connect("BuildSearchQueries", "SplitSearchBatches")
# SplitSearchBatches v3: output[0]=done, output[1]=loop
connect("SplitSearchBatches", "ParseSearchResults", 0)        # done
connect("SplitSearchBatches", "WaitSearchRate", 1)             # loop
connect("WaitSearchRate", "FetchGitHubSearch")
connect("FetchGitHubSearch", "AccumulateSearchResults", 0)     # success
connect("FetchGitHubSearch", "AccumulateSearchResults", 1)     # error (continue)
connect("AccumulateSearchResults", "SplitSearchBatches")       # loop back
connect("ParseSearchResults", "HasNewRepos")
connect("HasNewRepos", "PrepareTranslatePrompt", 0)            # true
connect("HasNewRepos", "EmptyRepoResult", 1)                   # false
connect("PrepareTranslatePrompt", "SplitTranslateBatches")
# SplitTranslateBatches v3: output[0]=done, output[1]=loop
connect("SplitTranslateBatches", "ParseTranslations", 0)       # done
connect("SplitTranslateBatches", "GeminiTranslateRepos", 1)    # loop
connect("GeminiTranslateRepos", "AccumulateTranslations")
connect("AccumulateTranslations", "SplitTranslateBatches")     # loop back
connect("ParseTranslations", "SplitRepoChunks")
# SplitRepoChunks v3: output[0]=done, output[1]=loop
connect("SplitRepoChunks", "ParseRepoPostResults", 0)          # done
connect("SplitRepoChunks", "PostTrackingRepos", 1)             # loop
connect("PostTrackingRepos", "AccumulateRepoPostResults", 0)   # success
connect("PostTrackingRepos", "AccumulateRepoPostResults", 1)   # error
connect("AccumulateRepoPostResults", "SplitRepoChunks")        # loop back
connect("ParseRepoPostResults", "MergeRepoPaths", 0, 0)
connect("EmptyRepoResult", "MergeRepoPaths", 0, 1)
connect("MergeRepoPaths", "PrepareDiscordRepos")
connect("PrepareDiscordRepos", "DiscordNotifyRepos")

# Build workflow
workflow = {
    "id": WF_ID,
    "name": "shirankedo 週次Cron",
    "active": False,
    "nodes": nodes,
    "connections": connections,
    "settings": {
        "executionOrder": "v1",
        "callerPolicy": "workflowsFromSameOwner",
        "errorWorkflow": "aHM9O6mSwMNPTwdI"
    }
}

with open("workflows/shirankedo-weekly.json", "w", encoding="utf-8") as f:
    json.dump(workflow, f, ensure_ascii=False, indent=2)

print(f"Generated: {len(nodes)} nodes, {sum(len(v) for outs in connections.values() for v in outs.get('main',[])) } connections")
