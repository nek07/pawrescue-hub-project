"""Проверка данных Telegram Login Widget и Mini App (initData).

https://core.telegram.org/widgets/login#checking-authorization
"""

import hashlib
import hmac
import time

MAX_AGE_SECONDS = 86_400  # не старше суток


def _check_string(data: dict[str, str]) -> str:
    return "\n".join(f"{k}={v}" for k, v in sorted(data.items()) if k != "hash")


def verify_login_widget(data: dict[str, str], bot_token: str, *, now: float | None = None) -> bool:
    if "hash" not in data or "auth_date" not in data:
        return False
    secret = hashlib.sha256(bot_token.encode()).digest()
    calc = hmac.new(secret, _check_string(data).encode(), hashlib.sha256).hexdigest()
    try:
        age = (now if now is not None else time.time()) - int(data["auth_date"])
    except ValueError:
        return False
    return hmac.compare_digest(calc, data["hash"]) and 0 <= age < MAX_AGE_SECONDS


def verify_webapp_init_data(data: dict[str, str], bot_token: str) -> bool:
    if "hash" not in data:
        return False
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calc = hmac.new(secret, _check_string(data).encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(calc, data["hash"])
