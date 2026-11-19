"""validate_workflows.check_onerror_placement の判定のテスト."""

import importlib.util
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "validate_workflows", Path(__file__).resolve().parent / "validate_workflows.py"
)
vw = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(vw)


def _wf(node_extra: dict | None = None, params_extra: dict | None = None) -> dict:
    node = {
        "name": "PingHealthchecks",
        "type": "n8n-nodes-base.httpRequest",
        "parameters": {"method": "GET", "url": "https://example.com", **(params_extra or {})},
        "retryOnFail": True,
        **(node_extra or {}),
    }
    return {"nodes": [node], "connections": {}}


def _check(wf: dict) -> list[str]:
    errors: list[str] = []
    vw.check_onerror_placement(wf, errors)
    return errors


def test_parametersの中のonErrorはエラー():
    errors = _check(_wf(params_extra={"onError": "continueRegularOutput"}))
    assert len(errors) == 1
    assert "PingHealthchecks" in errors[0]
    assert "parameters" in errors[0]


def test_parametersの中のほかのノード設定もエラー():
    errors = _check(_wf(params_extra={"retryOnFail": True, "executeOnce": True}))
    assert len(errors) == 1
    assert "executeOnce" in errors[0]
    assert "retryOnFail" in errors[0]


def test_ノード本体のn8nの値は通す():
    for value in ("stopWorkflow", "continueRegularOutput", "continueErrorOutput"):
        assert _check(_wf(node_extra={"onError": value})) == [], value


def test_ノード本体のn8nに無い値はエラー():
    errors = _check(_wf(node_extra={"onError": "stopAndFail"}))
    assert len(errors) == 1
    assert "stopAndFail" in errors[0]


def test_onErrorが無ければ通す():
    assert _check(_wf()) == []


def test_parametersの無いノードでも落ちない():
    wf = {"nodes": [{"name": "Schedule", "type": "n8n-nodes-base.scheduleTrigger"}]}
    assert _check(wf) == []
