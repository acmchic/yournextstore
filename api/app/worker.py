from __future__ import annotations

import asyncio
import json

from app.db import Database
from app.settings import settings


async def process_once(database: Database) -> bool:
    async with database.transaction() as cursor:
        await cursor.execute(
            """
            select id, event_type, aggregate_id, payload_json from outbox_events
            where status='pending' and available_at <= current_timestamp(6)
            order by id limit 1 for update skip locked
            """
        )
        event = await cursor.fetchone()
        if not event:
            return False
        await cursor.execute(
            "update outbox_events set status='processing', attempts=attempts+1 where id=%s",
            (event["id"],),
        )
        payload = event["payload_json"]
        if isinstance(payload, str):
            json.loads(payload)
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
