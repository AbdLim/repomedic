from app.features.repairs.agent import RepairAgent


def test_unified_diff_shows_change() -> None:
    patch = RepairAgent.unified_diff("app/api.py", "value = 1\n", "value = 2\n")
    assert "--- a/app/api.py" in patch
    assert "+++ b/app/api.py" in patch
    assert "-value = 1" in patch
    assert "+value = 2" in patch
