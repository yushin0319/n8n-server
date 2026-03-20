#!/usr/bin/env python3
"""shirankedo-weekly.json を5つのWFに分割するスクリプト."""

import json
import sys
from pathlib import Path

SRC = Path("workflows/shirankedo-weekly.json")
OUT_DIR = Path("workflows")

# 各WFに含めるノード名のリスト
# 共通ノード（各WFにコピー）
COMMON_NODES = {"WebhookTest", "CheckTestMode", "TestResponse", "RespondTest"}

STARS_NODES = COMMON_NODES | {
    "Schedule",
    "FetchTrackingRepos",
    "BuildStarBatches",
    "SplitStarBatches",
    "FetchStarBatch",
    "AccumulateStars",
    "ParseStars",
    "SplitStarChunks",
    "PostRepoStats",
    "AccumulatePostResults",
    "ParsePostResults",
    "PrepareDiscordStars",
    "DiscordNotifyStars",
    "IfSkipPostRepoStats",
    "IfSkipDiscordNotifyStars",
}

REPORT_NODES = COMMON_NODES | {
    "Schedule",
    "FetchRecentArticles",
    "PrepareWeeklyPrompt",
    "HasArticlesForReport",
    "GeminiWeeklyReport",
    "FormatWeeklyReport",
    "PostWeeklySummary",
    "EmptyWeeklyResult",
    "MergeWeeklyPaths",
    "PrepareDiscordWeekly",
    "DiscordNotifyWeekly",
    "IfSkipGeminiWeeklyReport",
    "MockGeminiWeeklyReport",
    "IfSkipPostWeeklySummary",
    "IfSkipDiscordNotifyWeekly",
}

COMMENTS_NODES = COMMON_NODES | {
    "Schedule",
    "FetchRecentSummaries",
    "PreparePageCommentPrompts",
    "HasSummariesForComments",
    "GeminiTrendComment",
    "FormatTrendComment",
    "GeminiAIApiComment",
    "FormatAIApiComment",
    "GeminiAISubComment",
    "FormatPageComments",
    "PostPageComments",
    "EmptyCommentResult",
    "MergeCommentPaths",
    "PrepareDiscordComments",
    "DiscordNotifyComments",
    "IfSkipGeminiTrendComment",
    "MockGeminiTrendComment",
    "IfSkipGeminiAIApiComment",
    "MockGeminiAIApiComment",
    "IfSkipGeminiAISubComment",
    "MockGeminiAISubComment",
    "IfSkipPostPageComments",
    "IfSkipDiscordNotifyComments",
}

LLM_NODES = COMMON_NODES | {
    "Schedule",
    "FetchAAModels",
    "FetchExchangeRate",
    "MergeLLMInputs",
    "ParseLLMData",
    "RouteLLMOutput",
    "PostLLMModels",
    "PostExchangeRate",
    "PrepareDiscordLLM",
    "DiscordNotifyLLM",
    "IfSkipPostLLMModels",
    "IfSkipPostExchangeRate",
    "IfSkipDiscordNotifyLLM",
}

REPOS_NODES = COMMON_NODES | {
    "Schedule",
    "FetchExistingRepos",
    "BuildSearchQueries",
    "SplitSearchBatches",
    "WaitSearchRate",
    "FetchGitHubSearch",
    "AccumulateSearchResults",
    "ParseSearchResults",
    "HasNewRepos",
    "PrepareTranslatePrompt",
    "SplitTranslateBatches",
    "GeminiTranslateRepos",
    "AccumulateTranslations",
    "ParseTranslations",
    "SplitRepoChunks",
    "PostTrackingRepos",
    "AccumulateRepoPostResults",
    "ParseRepoPostResults",
    "EmptyRepoResult",
    "MergeRepoPaths",
    "PrepareDiscordRepos",
    "DiscordNotifyRepos",
    "PostNewRepoStats",
    "IfSkipGeminiTranslateRepos",
    "MockGeminiTranslateRepos",
    "IfSkipPostTrackingRepos",
    "IfSkipDiscordNotifyRepos",
    "IfSkipPostNewRepoStats",
}

# 除外ノード（SubReminder関連）
EXCLUDED_NODES = {"IfSkipDiscordSubReminder", "DiscordSubReminder"}


def extract_wf(src_wf: dict, node_names: set, wf_id: str, wf_name: str, active: bool) -> dict:
    """元WFから指定ノードとそのコネクションを抽出."""
    nodes = [n for n in src_wf["nodes"] if n["name"] in node_names]

    # コネクション: src と dst の両方が含まれるもののみ
    connections = {}
    for src_name, ports in src_wf["connections"].items():
        if src_name not in node_names:
            continue
        filtered_ports = {}
        for port_name, port_conns in ports.items():
            filtered_lists = []
            for conn_list in port_conns:
                filtered = [c for c in conn_list if c["node"] in node_names]
                filtered_lists.append(filtered)
            if any(filtered_lists):
                filtered_ports[port_name] = filtered_lists
        if filtered_ports:
            connections[src_name] = filtered_ports

    # settings を元WFからコピー
    settings = src_wf.get("settings", {})

    return {
        "id": wf_id,
        "name": wf_name,
        "active": active,
        "nodes": nodes,
        "connections": connections,
        "settings": settings,
    }


def adjust_schedule(wf: dict, hour: int, minute: int) -> None:
    """Schedule ノードの時刻を変更."""
    for node in wf["nodes"]:
        if node["name"] == "Schedule":
            intervals = node["parameters"]["rule"]["interval"]
            for interval in intervals:
                interval["triggerAtHour"] = hour
                if minute > 0:
                    interval["triggerAtMinute"] = minute
                elif "triggerAtMinute" in interval:
                    del interval["triggerAtMinute"]
            break


def adjust_webhook_path(wf: dict, path: str) -> None:
    """WebhookTest ノードのパスを変更."""
    for node in wf["nodes"]:
        if node["name"] == "WebhookTest":
            node["parameters"]["path"] = path
            break


def limit_check_test_mode_connections(wf: dict, entry_nodes: list[str]) -> None:
    """CheckTestMode の出力接続を指定した起点ノードのみに限定する.

    元WFで直接接続がない場合も、entry_nodes への接続を新規作成する。
    """
    if "CheckTestMode" not in wf["connections"]:
        # 元WFに直接接続がないケース（例: Comments は Report 経由だった）
        # entry_nodes への接続を新規作成
        wf["connections"]["CheckTestMode"] = {
            "main": [[{"node": n, "type": "main", "index": 0} for n in entry_nodes]]
        }
        return
    ports = wf["connections"]["CheckTestMode"]
    for port_name in ports:
        new_lists = []
        for conn_list in ports[port_name]:
            filtered = [c for c in conn_list if c["node"] in entry_nodes]
            new_lists.append(filtered)
        ports[port_name] = new_lists


def add_test_response_connection(wf: dict, from_node: str, output_index: int) -> None:
    """指定ノードの指定出力からTestResponseへの接続を追加（なければ）."""
    if from_node not in wf["connections"]:
        wf["connections"][from_node] = {}
    ports = wf["connections"][from_node]
    if "main" not in ports:
        ports["main"] = []
    # output_indexまでリストを拡張
    while len(ports["main"]) <= output_index:
        ports["main"].append([])
    # TestResponseへの接続がなければ追加
    existing = [c for c in ports["main"][output_index] if c["node"] == "TestResponse"]
    if not existing:
        ports["main"][output_index].append({"node": "TestResponse", "type": "main", "index": 0})


def remove_connection(wf: dict, from_node: str, to_node: str) -> None:
    """指定ノード間の接続を全て削除."""
    if from_node not in wf["connections"]:
        return
    ports = wf["connections"][from_node]
    for port_name in ports:
        for i, conn_list in enumerate(ports[port_name]):
            ports[port_name][i] = [c for c in conn_list if c["node"] != to_node]


def normalize_positions(wf: dict) -> None:
    """ノード位置を正規化（最小y=0基準）."""
    if not wf["nodes"]:
        return
    min_y = min(n["position"][1] for n in wf["nodes"])
    for node in wf["nodes"]:
        node["position"][1] -= min_y


def main():
    with open(SRC, encoding="utf-8") as f:
        src = json.load(f)

    # 1. Stars (3:00 JST = 18:00 UTC)
    stars = extract_wf(src, STARS_NODES, "", "shirankedo 週次Stars", True)
    adjust_schedule(stars, 18, 0)
    adjust_webhook_path(stars, "test-shirankedo-weekly-stars")
    limit_check_test_mode_connections(stars, ["FetchTrackingRepos"])
    normalize_positions(stars)
    with open(OUT_DIR / "shirankedo-weekly-stars.json", "w", encoding="utf-8") as f:
        json.dump(stars, f, ensure_ascii=False, indent=2)
    print(f"Stars: {len(stars['nodes'])} nodes, {len(stars['connections'])} connections")

    # 2. Report (3:00 JST = 18:00 UTC)
    report = extract_wf(src, REPORT_NODES, "", "shirankedo 週次Report", True)
    adjust_schedule(report, 18, 0)
    adjust_webhook_path(report, "test-shirankedo-weekly-report")
    limit_check_test_mode_connections(report, ["FetchRecentArticles"])
    # Report WF: IfSkipDiscordNotifyWeekly[0] は元々 FetchRecentSummaries（Comments WF）に行くが
    # 分割後はTestResponseへ接続する（テスト時スキップ終了）
    # extract_wf で FetchRecentSummaries がないため自動的に除外されるが、TestResponseへの接続を追加
    add_test_response_connection(report, "IfSkipDiscordNotifyWeekly", 0)
    # DiscordNotifyWeekly → FetchRecentSummaries の接続も除外済み（FetchRecentSummariesがないため）
    normalize_positions(report)
    with open(OUT_DIR / "shirankedo-weekly-report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"Report: {len(report['nodes'])} nodes, {len(report['connections'])} connections")

    # 3. Comments (3:15 JST = 18:15 UTC)
    comments = extract_wf(src, COMMENTS_NODES, "", "shirankedo 週次Comments", True)
    adjust_schedule(comments, 18, 15)
    adjust_webhook_path(comments, "test-shirankedo-weekly-comments")
    limit_check_test_mode_connections(comments, ["FetchRecentSummaries"])
    normalize_positions(comments)
    with open(OUT_DIR / "shirankedo-weekly-comments.json", "w", encoding="utf-8") as f:
        json.dump(comments, f, ensure_ascii=False, indent=2)
    print(f"Comments: {len(comments['nodes'])} nodes, {len(comments['connections'])} connections")

    # 4. LLM (3:00 JST = 18:00 UTC)
    llm = extract_wf(src, LLM_NODES, "", "shirankedo 週次LLM", True)
    adjust_schedule(llm, 18, 0)
    adjust_webhook_path(llm, "test-shirankedo-weekly-llm")
    limit_check_test_mode_connections(llm, ["FetchAAModels", "FetchExchangeRate"])
    normalize_positions(llm)
    with open(OUT_DIR / "shirankedo-weekly-llm.json", "w", encoding="utf-8") as f:
        json.dump(llm, f, ensure_ascii=False, indent=2)
    print(f"LLM: {len(llm['nodes'])} nodes, {len(llm['connections'])} connections")

    # 5. Repos (3:00 JST = 18:00 UTC)
    repos = extract_wf(src, REPOS_NODES, "", "shirankedo 週次Repos", True)
    adjust_schedule(repos, 18, 0)
    adjust_webhook_path(repos, "test-shirankedo-weekly-repos")
    limit_check_test_mode_connections(repos, ["FetchExistingRepos"])
    normalize_positions(repos)
    with open(OUT_DIR / "shirankedo-weekly-repos.json", "w", encoding="utf-8") as f:
        json.dump(repos, f, ensure_ascii=False, indent=2)
    print(f"Repos: {len(repos['nodes'])} nodes, {len(repos['connections'])} connections")

    # 検証: 全ノードがどこかに含まれているか
    all_extracted = STARS_NODES | REPORT_NODES | COMMENTS_NODES | LLM_NODES | REPOS_NODES
    src_node_names = {n["name"] for n in src["nodes"]}
    missing = src_node_names - all_extracted - EXCLUDED_NODES
    if missing:
        print(f"WARNING: ノード未割当: {missing}", file=sys.stderr)

    print("Done.")


if __name__ == "__main__":
    main()
