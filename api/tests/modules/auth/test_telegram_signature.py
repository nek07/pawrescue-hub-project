import hashlib
import hmac
import time
from urllib.parse import parse_qsl

from app.modules.auth.telegram import verify_login_widget, verify_webapp_init_data
from helpers import BOT_TOKEN, telegram_payload


def _str(data: dict[str, object]) -> dict[str, str]:
    return {k: str(v) for k, v in data.items()}


def test_valid_widget_data() -> None:
    assert verify_login_widget(_str(telegram_payload()), BOT_TOKEN)


def test_tampered_field_is_rejected() -> None:
    data = _str(telegram_payload())
    data["id"] = "1"
    assert not verify_login_widget(data, BOT_TOKEN)


def test_other_bot_token_is_rejected() -> None:
    assert not verify_login_widget(_str(telegram_payload()), "999:other")


def test_stale_auth_date_is_rejected() -> None:
    day_ago = int(time.time()) - 86_401
    assert not verify_login_widget(_str(telegram_payload(auth_date=day_ago)), BOT_TOKEN)


def test_missing_hash_or_bad_date() -> None:
    data = _str(telegram_payload())
    assert not verify_login_widget({k: v for k, v in data.items() if k != "hash"}, BOT_TOKEN)
    assert not verify_login_widget({**data, "auth_date": "soon"}, BOT_TOKEN)


def test_webapp_init_data() -> None:
    fields = {"auth_date": "1700000000", "query_id": "AAE", "user": '{"id":777}'}
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    signed = {**fields, "hash": hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()}
    assert verify_webapp_init_data(signed, BOT_TOKEN)
    assert not verify_webapp_init_data({**signed, "user": '{"id":1}'}, BOT_TOKEN)
    assert dict(parse_qsl("a=1")) == {"a": "1"}  # initData приходит строкой query
