from __future__ import annotations

import asyncio
import json
import logging

from app.db import Database
from app.order_email import MailtrapDeliveryError, send_order_success_email
from app.settings import settings
from app.telegram_notifications import TelegramDeliveryError, send_order_paid_notification

logger = logging.getLogger(__name__)


async def process_once(database: Database) -> bool:
    async with database.transaction() as cursor:
        await cursor.execute(
            """
            select id, event_type, aggregate_id, payload_json from outbox_events
            where (
                (status='pending' and available_at <= current_timestamp(6))
                or (status='processing' and available_at <= current_timestamp(6))
            )
            and (event_type <> 'order.paid' or (%s <> '' and %s <> ''))
            and (event_type <> 'order.receipt' or (%s <> '' and %s <> ''))
            order by id limit 1 for update skip locked
            """,
            (
                settings.telegram_bot_token,
                settings.telegram_chat_id,
                settings.mailtrap_api_key,
                settings.email_support,
            ),
        )
        event = await cursor.fetchone()
        if not event:
            return False
        await cursor.execute(
            """update outbox_events
            set status='processing', attempts=attempts+1,
                available_at=date_add(current_timestamp(6), interval 5 minute)
            where id=%s""",
            (event["id"],),
        )

    payload = event["payload_json"]
    try:
        if isinstance(payload, str):
            payload = json.loads(payload)
        if event["event_type"] == "order.paid":
            await send_order_paid_notification(
                payload,
                event["aggregate_id"],
                settings.telegram_bot_token,
                settings.telegram_chat_id,
            )
        elif event["event_type"] == "order.receipt":
            await send_order_success_email(
                payload,
                event["aggregate_id"],
                settings.mailtrap_api_key,
                settings.email_support,
                settings.email_support_name,
            )
    except (
        TelegramDeliveryError,
        MailtrapDeliveryError,
        ValueError,
        TypeError,
        AttributeError,
    ) as error:
        async with database.transaction() as cursor:
            await cursor.execute(
                """update outbox_events
                set status='pending',
                    available_at=date_add(current_timestamp(6), interval least(attempts, 30) minute)
                where id=%s""",
                (event["id"],),
            )
        logger.warning(
            "Outbox event %s delivery failed (%s); it will be retried",
            event["id"],
            str(error)
            if isinstance(error, (TelegramDeliveryError, MailtrapDeliveryError))
            else type(error).__name__,
        )
        return True

    async with database.transaction() as cursor:
        await cursor.execute(
            "update outbox_events set status='done', processed_at=current_timestamp(6) where id=%s",
            (event["id"],),
        )
        return True


async def main() -> None:
    database = Database(settings)
    try:
        while True:
            processed = await process_once(database)
            if not processed:
                await asyncio.sleep(2)
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
