#!/usr/bin/env python3
"""shirankedo-daily.json を4つのWFに分割するスクリプト."""

import json
import sys
from pathlib import Path

SRC = Path("workflows/shirankedo-daily.json")
OUT_DIR = Path("workflows")

# 各WFに含めるノード名のリスト
# 共通ノード（各WFにコピー）
COMMON_NODES = {"WebhookTest", "CheckTestMode", "TestResponse", "RespondTest"}

ARTICLES_NODES = COMMON_NODES | {
    "Schedule",
    "FetchExistingURLs",
    "FetchHN",
    "FetchHatena",
    "FetchZenn",
    "FetchLobsters",
    "FetchArXiv",
    "ParseArXiv",
    "ArXivFallback",
    "DiscordArXivWarn",
    "WaitAllFeeds",
    "DeduplicateArticles",
    "PrepareSelectionPrompt",
    "IfSkipGeminiSelect",
    "GeminiSelect",
    "MockGeminiSelect",
    "ParseSelection",
    "FetchFullTexts",
    "ExtractTexts",
    "PrepareSummaryPrompt",
    "IfSkipGeminiSummarize",
    "GeminiSummarize",
    "MockGeminiSummarize",
    "FormatArticles",
    "IfSkipPostArticles",
    "PostArticles",
    "PrepareDiscordArticles",
    "IfSkipDiscordNotifyArticles",
    "DiscordNotifyArticles",
    "IfSkipDiscordArXivWarn",
}

VULNS_NODES = COMMON_NODES | {
    "Schedule",
    "FetchNVD",
    "FetchExistingCVEs",
    "WaitNVDData",
    "ParseNVD",
    "PrepareNVDTranslation",
    "HasVulnerabilities",
    "IfSkipGeminiTranslateVulns",
    "GeminiTranslateVulns",
    "MockGeminiTranslateVulns",
    "FormatVulnerabilities",
    "EmptyVulnResult",
    "MergeVulnPaths",
    "IfSkipPostVulnerabilities",
    "PostVulnerabilities",
    "PrepareDiscordVulns",
    "IfSkipDiscordNotifyVulns",
    "DiscordNotifyVulns",
}

RELEASES_NODES = COMMON_NODES | {
    "Schedule",
    "FetchTrackingRepos",
    "BuildGraphQLBatches",
    "HasTrackingRepos",
    "SplitReleaseBatches",
    "FetchReleaseBatch",
    "AccumulateReleases",
    "ParseReleases",
    "EmptyReleaseResult",
    "MergeReleasePaths",
    "IfSkipPostReleases",
    "PostReleases",
    "PrepareDiscordReleases",
    "IfSkipDiscordNotifyReleases",
    "DiscordNotifyReleases",
}


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

    # 1. Articles
    articles = extract_wf(src, ARTICLES_NODES, "qBVsxJnVYbOVNgJm", "shirankedo 日次Articles", True)
    adjust_schedule(articles, 15, 0)  # UTC 15:00 = JST 0:00
    adjust_webhook_path(articles, "test-shirankedo-daily-articles")
    normalize_positions(articles)
    with open(OUT_DIR / "shirankedo-daily-articles.json", "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    print(f"Articles: {len(articles['nodes'])} nodes, {len(articles['connections'])} connections")

    # 2. Vulns
    vulns = extract_wf(src, VULNS_NODES, "yVKfIE6Kt7xKQ7WL", "shirankedo 日次Vulns", True)
    adjust_schedule(vulns, 15, 5)  # UTC 15:05 = JST 0:05
    adjust_webhook_path(vulns, "test-shirankedo-daily-vulns")
    normalize_positions(vulns)
    with open(OUT_DIR / "shirankedo-daily-vulns.json", "w", encoding="utf-8") as f:
        json.dump(vulns, f, ensure_ascii=False, indent=2)
    print(f"Vulns: {len(vulns['nodes'])} nodes, {len(vulns['connections'])} connections")

    # 3. Releases
    releases = extract_wf(src, RELEASES_NODES, "Txnzz6v7lM6RMTmf", "shirankedo 日次Releases", True)
    adjust_schedule(releases, 15, 10)  # UTC 15:10 = JST 0:10
    adjust_webhook_path(releases, "test-shirankedo-daily-releases")
    normalize_positions(releases)
    with open(OUT_DIR / "shirankedo-daily-releases.json", "w", encoding="utf-8") as f:
        json.dump(releases, f, ensure_ascii=False, indent=2)
    print(f"Releases: {len(releases['nodes'])} nodes, {len(releases['connections'])} connections")

    # 検証: 全ノードがどこかに含まれているか
    all_extracted = ARTICLES_NODES | VULNS_NODES | RELEASES_NODES
    # Security系ノードは新WFで別途作成するので除外
    security_old = {
        "WaitBCD",
        "PrepareSecurityComment",
        "GeminiSecurityComment",
        "FormatSecurityDaily",
        "PostSecurityDaily",
        "PrepareDiscordSecurity",
        "DiscordNotifySecurity",
        "IfSkipGeminiSecurityComment",
        "MockGeminiSecurityComment",
        "IfSkipPostSecurityDaily",
        "IfSkipDiscordNotifySecurity",
    }
    src_node_names = {n["name"] for n in src["nodes"]}
    missing = src_node_names - all_extracted - security_old
    if missing:
        print(f"WARNING: ノード未割当: {missing}", file=sys.stderr)

    print("Done.")


if __name__ == "__main__":
    main()
