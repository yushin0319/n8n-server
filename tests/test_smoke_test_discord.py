"""smoke_test.send_discord_summary の送信条件テスト.

デプロイごとの成功通知で Discord が埋まるのを避けるため、失敗があるときだけ送る。
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts import smoke_test


def _result(ok: bool) -> dict:
    return {
        "ok": ok,
        "endpoint": {"name": "cron-x"},
        "result": {"error": None if ok else "boom", "status_code": 200 if ok else 500},
    }


@pytest.fixture
def sent(monkeypatch):
    calls = []
    monkeypatch.setattr(smoke_test, "DISCORD_WEBHOOK_URL", "https://discord.example/webhooks/X/Y")
    monkeypatch.setattr(
        smoke_test.urllib.request, "urlopen", lambda req, timeout: calls.append(req)
    )
    return calls


def test_all_passed_does_not_post(sent):
    # Given: 全件成功 / When: 通知 / Then: Discord に送らない
    smoke_test.send_discord_summary([_result(True), _result(True)])
    assert sent == []


def test_any_failure_posts(sent):
    # Given: 1 件失敗 / When: 通知 / Then: 1 回送る
    smoke_test.send_discord_summary([_result(True), _result(False)])
    assert len(sent) == 1
