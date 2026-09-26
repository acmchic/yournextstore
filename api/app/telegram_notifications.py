from __future__ import annotations

import httpx


class TelegramDeliveryError(Exception):
    pass


async def send_order_paid_notification(
    payload: dict[str, object],
    aggregate_id: str,
    bot_token: str,
    chat_id: str,
) -> None:
    order_number = str(payload.get("order_number") or aggregate_id)
    amount_minor = int(payload.get("total_minor") or 0)
    currency = str(payload.get("currency") or "USD").upper()
    amount = f"{amount_minor // 100:,}.{amount_minor % 100:02d}"
    total = f"${amount}" if currency == "USD" else f"{amount} {currency}"
    item_count = int(payload.get("item_count") or 0)
    message = (
        f"✅ New TeeBravo order paid\nOrder: {order_number}\nTotal: {total}\nItems: {item_count}"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": message},
            )
    except httpx.HTTPError as error:
        raise TelegramDeliveryError(type(error).__name__) from None

    if response.status_code < 200 or response.status_code >= 300:
        raise TelegramDeliveryError(f"http_{response.status_code}")
    try:
        result = response.json()
    except ValueError:
        raise TelegramDeliveryError("invalid_response") from None
    if not isinstance(result, dict) or result.get("ok") is not True:
        raise TelegramDeliveryError("api_rejected")
