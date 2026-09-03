from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from app.settings import Settings


class Database:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._pool: Any | None = None

    async def connect(self) -> None:
        if self._pool is not None:
            return
        import aiomysql

        self._pool = await aiomysql.create_pool(
            host=self._settings.mysql_host,
            port=self._settings.mysql_port,
            user=self._settings.mysql_user,
            password=self._settings.mysql_password,
            db=self._settings.mysql_database,
            autocommit=True,
            cursorclass=aiomysql.DictCursor,
            minsize=1,
            maxsize=10,
        )

    async def close(self) -> None:
        if self._pool is None:
            return
        self._pool.close()
        await self._pool.wait_closed()
        self._pool = None

    @asynccontextmanager
    async def cursor(self) -> AsyncIterator[Any]:
        await self.connect()
        if self._pool is None:
            raise RuntimeError("Database pool is not available")
        async with self._pool.acquire() as connection, connection.cursor() as cursor:
            yield cursor

    async def fetch_one(self, sql: str, params: tuple[Any, ...]) -> dict[str, Any] | None:
        async with self.cursor() as cursor:
            await cursor.execute(sql, params)
            return await cursor.fetchone()

    async def fetch_all(self, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        async with self.cursor() as cursor:
            await cursor.execute(sql, params)
            return await cursor.fetchall()

    async def execute(self, sql: str, params: tuple[Any, ...] = ()) -> int:
        async with self.cursor() as cursor:
            await cursor.execute(sql, params)
            return cursor.rowcount

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[Any]:
        await self.connect()
        if self._pool is None:
            raise RuntimeError("Database pool is not available")
        async with self._pool.acquire() as connection:
            await connection.begin()
            try:
                async with connection.cursor() as cursor:
                    yield cursor
            except Exception:
                await connection.rollback()
                raise
            else:
                await connection.commit()
