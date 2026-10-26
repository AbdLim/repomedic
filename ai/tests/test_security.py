import secrets


def test_internal_secrets_are_constant_time_comparable() -> None:
    assert secrets.compare_digest("secret", "secret")
    assert not secrets.compare_digest("secret", "weebitdifferent")
