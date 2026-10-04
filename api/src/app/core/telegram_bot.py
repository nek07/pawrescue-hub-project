import httpx

API = "https://api.telegram.org"


class TelegramBot:
    """Сообщения от бота. Писать можно тем, кто разрешил это при входе через виджет."""

    def __init__(self, token: str, client: httpx.AsyncClient) -> None:
        self._url = f"{API}/bot{token}/sendMessage"
        self._client = client

    async def send_message(self, chat_id: str, text: str) -> None:
        r = await self._client.post(self._url, json={"chat_id": chat_id, "text": text})
        if r.status_code == 403:  # человек заблокировал бота — повтор не поможет
            return
        r.raise_for_status()
