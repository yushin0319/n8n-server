"""shirankedo-weekly.json を生成するスクリプト（Phase 3: Step 1, 4, 5）"""
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

# BuildStarBatches - 200リポ/バッチでGraphQLクエリ構築
add_node("BuildStarBatches", "n8n-nodes-base.code", 2, {
    "jsCode": """// tracking-reposからstar取得用GraphQLバッチを構築（200リポ/バッチ）
const repos = $input.first().json.data || [];
if (!repos.length) return [{ json: { batches: [], count: 0 } }];

const batchSize = 200;
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

const prompt = `あなたはテック系ニュースの週次レポートライターです。ギャル口調（～じゃん、～っしょ、マジで、ガチで等）で書いてください。

以下の今週の記事一覧から、週次レポートを作成してください。

## フォーマット
- 500〜800文字程度
- 今週の大きなトレンドや注目ポイントを3〜5個にまとめる
- 各トレンドに関連する記事を引用
- 最後に一言まとめ

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
    "jsonBody": '={{ JSON.stringify({ contents: [{ parts: [{ text: $json.prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }) }}',
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

const baseInstruction = 'ギャル口調（～じゃん、～っしょ、マジで、ガチで等）で150〜300文字で書いてください。';

const trendPrompt = `あなたはテック系トレンド評論家です。${baseInstruction}

以下の直近の週次レポートを参考に、今のテック業界全体のトレンドについて総評コメントを書いてください。
注目すべき技術動向、業界の変化、開発者への影響などをまとめてください。

${summaryText}`;

const aiApiPrompt = `あなたはAI API・LLM分野の専門家です。${baseInstruction}

以下の直近の週次レポートを参考に、AI API・LLM関連の最新動向について総評コメントを書いてください。
新モデル、価格変動、API機能の変化、開発者ツールの進化などをまとめてください。

${summaryText}`;

const aiSubPrompt = `あなたはAIサブスクリプション・料金プランの専門家です。${baseInstruction}

以下の直近の週次レポートを参考に、AIサービスのサブスクリプション・料金プランについて総評コメントを書いてください。
ChatGPT、Claude、Gemini等の料金変更、新プラン、コスパの変化などをまとめてください。

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
    "jsonBody": '={{ JSON.stringify({ contents: [{ parts: [{ text: $json.trendPrompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 1024 } }) }}',
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
    "jsonBody": '={{ JSON.stringify({ contents: [{ parts: [{ text: $json.aiApiPrompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 1024 } }) }}',
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
    "jsonBody": '={{ JSON.stringify({ contents: [{ parts: [{ text: $json.aiSubPrompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 1024 } }) }}',
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

# ===== Connections =====
# Schedule → parallel: Step 1 + Step 4
connect("Schedule", "FetchTrackingRepos")
connect("Schedule", "FetchRecentArticles")

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
