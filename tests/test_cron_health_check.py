"""cron-health-check WF の構造テスト.

CheckHistLink ノードは外部 HTTP (Render 無料プラン) を叩くため、
transient ECONNABORTED を吸収するリトライ設定が必須。
"""

import json
import os

import pytest

WF_PATH = os.path.join(os.path.dirname(__file__), "..", "workflows", "cron-health-check.json")


@pytest.fixture(scope="module")
def check_histlink_node():
    with open(WF_PATH, encoding="utf-8") as f:
        wf = json.load(f)
    for node in wf["nodes"]:
        if node["name"] == "CheckHistLink":
            return node
    pytest.fail("CheckHistLink ノードが見つからない")


def test_check_histlink_has_retry_on_fail(check_histlink_node):
    # Given: Render 無料プランのプレスリープで ECONNABORTED が散発する
    # When: CheckHistLink ノードの設定を読む
    # Then: retryOnFail=true が設定されている
    assert check_histlink_node.get("retryOnFail") is True


def test_check_histlink_max_tries_at_least_2(check_histlink_node):
    # 1回目失敗 → 2回目で Render が起きて成功、を吸収できる最低ライン
    assert check_histlink_node.get("maxTries", 1) >= 2


def test_check_histlink_wait_between_tries_reasonable(check_histlink_node):
    # Render edge の復帰を待つため 1秒以上必要
    assert check_histlink_node.get("waitBetweenTries", 0) >= 1000
