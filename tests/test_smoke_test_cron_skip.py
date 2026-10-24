"""smoke_test の cron / trigger WF の扱いのテスト.

2026-10-24、cron WF の test webhook に {"test": true} を送っても試験モードにならず、
本番の処理（Discord 投稿・shirankedo への書き込み・Notion 作成など）が動いていた。
原因が直るまでは、SMOKE_CRON_TESTS=1 を付けたときだけ cron / trigger WF を叩く。
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts import smoke_test


@pytest.fixture
def posted(monkeypatch, tmp_path):
    calls = []

    def fake_post(ep):
        calls.append(ep["name"])
        return {"status_code": 200, "body": {"status": "ok", "test": True}, "error": None}

    monkeypatch.setattr(smoke_test, "post_test", fake_post)
    monkeypatch.setattr(smoke_test, "send_discord_summary", lambda results: None)
    only = tmp_path / "deployed.txt"
    only.write_text("workflows/cron-health-check.json\n", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["smoke_test.py", "--only-file", str(only)])
    return calls


def test_cron_tests_are_skipped_by_default(monkeypatch, posted):
    # Given: SMOKE_CRON_TESTS 未設定 / When: cron WF だけデプロイされた / Then: 叩かない
    monkeypatch.delenv("SMOKE_CRON_TESTS", raising=False)
    assert smoke_test.main() == 0
    assert posted == []


def test_cron_tests_run_when_enabled(monkeypatch, posted):
    # Given: SMOKE_CRON_TESTS=1 / Then: 従来どおり test webhook を叩く
    monkeypatch.setenv("SMOKE_CRON_TESTS", "1")
    assert smoke_test.main() == 0
    assert posted == ["cron-health-check"]
