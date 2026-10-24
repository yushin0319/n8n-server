"""cron-health-check WF の構造テスト.

CheckTargets ノードは外部 HTTP (Render 無料プラン / Cloudflare Workers / n8n 公開 URL)
を叩くため、transient ECONNABORTED を吸収するリトライ設定が必須。
確認先は BuildTargets が 1 件 1 item で渡し、失敗した item も同じ順で
FormatDiscord に届く必要がある。
"""

import json
import os

import pytest

WF_PATH = os.path.join(os.path.dirname(__file__), "..", "workflows", "cron-health-check.json")


@pytest.fixture(scope="module")
def wf():
    with open(WF_PATH, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def check_targets_node(wf):
    for node in wf["nodes"]:
        if node["name"] == "CheckTargets":
            return node
    pytest.fail("CheckTargets ノードが見つからない")


def _targets_of(wf, name):
    outputs = wf["connections"].get(name, {}).get("main", [])
    return [c["node"] for outs in outputs for c in (outs or [])]


def test_check_targets_has_retry_on_fail(check_targets_node):
    # Given: Render 無料プランのプレスリープで ECONNABORTED が散発する
    # When: CheckTargets ノードの設定を読む
    # Then: retryOnFail=true が設定されている
    assert check_targets_node.get("retryOnFail") is True


def test_check_targets_max_tries_at_least_2(check_targets_node):
    # 1回目失敗 → 2回目で Render が起きて成功、を吸収できる最低ライン
    assert check_targets_node.get("maxTries", 1) >= 2


def test_check_targets_wait_between_tries_reasonable(check_targets_node):
    # Render edge の復帰を待つため 1秒以上必要
    assert check_targets_node.get("waitBetweenTries", 0) >= 1000


def test_check_targets_reads_url_from_build_targets(wf, check_targets_node):
    # 確認先は BuildTargets の item ごとに変わる
    assert check_targets_node["parameters"]["url"] == "={{ $json.url }}"
    assert _targets_of(wf, "CheckTestMode") == ["BuildTargets"]
    assert _targets_of(wf, "BuildTargets") == ["CheckTargets"]


def test_check_targets_keeps_failed_items_in_order(check_targets_node):
    # 失敗した item を出力 0 に同じ順で残す（FormatDiscord が順番で確認先と突き合わせる）
    assert check_targets_node["parameters"].get("onError") == "continueRegularOutput"


def test_all_ok_skips_notification(wf):
    # 全部成功なら通知せず TestResponse へ、失敗があれば IfSkipDiscord → SendToDiscord へ
    assert _targets_of(wf, "CheckTargets") == ["FormatDiscord"]
    assert _targets_of(wf, "FormatDiscord") == ["IfAllOk"]
    ok_branch, ng_branch = wf["connections"]["IfAllOk"]["main"]
    assert [c["node"] for c in ok_branch] == ["TestResponse"]
    assert [c["node"] for c in ng_branch] == ["IfSkipDiscord"]
