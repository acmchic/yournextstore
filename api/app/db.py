from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from app.settings import Settings

logger = logging.getLogger(__name__)


class DatabaseUnavailableError(ConnectionError):
    """Raised when a request races with pool disposal or reconnect."""


class Database:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._pool: Any | None = None
        self._pool_lock = asyncio.Lock()

    async def connect(self) -> None:
        async with self._pool_lock:
            if self._pool is not None and not self._pool.closed:
                return
            if self._pool is not None:
                self._pool = None

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
                pool_recycle=max(60, self._settings.mysql_pool_recycle),
                connect_timeout=max(1.0, self._settings.mysql_connect_timeout),
            )

    async def close(self) -> None:
        async with self._pool_lock:
            pool = self._pool
            self._pool = None
            if pool is None:
                return
            pool.close()
            await pool.wait_closed()

    async def _reset_pool(self) -> None:
        """Discard all pooled connections after a transient DB failure."""
        await self.close()

    @staticmethod
    def _is_transient(error: Exception) -> bool:
        import aiomysql

        return isinstance(
            error,
            (
                aiomysql.OperationalError,
                aiomysql.InterfaceError,
                ConnectionError,
                asyncio.TimeoutError,
            ),
        )

    @asynccontextmanager
    async def cursor(self) -> AsyncIterator[Any]:
        await self.connect()
        pool = self._pool
        if pool is None or pool.closed:
            raise DatabaseUnavailableError("Database pool is not available")
        try:
            async with pool.acquire() as connection:
                # aiomysql can keep a socket in the free list after MySQL closes it
                # for being idle.  Ping before every operation so the driver can
                # reconnect that socket instead of returning a sporadic 503.
                await connection.ping(reconnect=True)
                async with connection.cursor() as cursor:
                    yield cursor
        except RuntimeError as error:
            if pool.closed:
                raise DatabaseUnavailableError("Database pool closed during acquire") from error
            raise

    async def _read(
        self, sql: str, params: tuple[Any, ...], *, fetch_all: bool
    ) -> dict[str, Any] | None | list[dict[str, Any]]:
        retries = max(0, self._settings.mysql_read_retries)
        for attempt in range(retries + 1):
            try:
                async with self.cursor() as cursor:
                    await cursor.execute(sql, params)
                    return await cursor.fetchall() if fetch_all else await cursor.fetchone()
            except Exception as error:
                if not self._is_transient(error) or attempt >= retries:
                    raise
                logger.warning(
                    "Transient MySQL read failure; reconnecting (attempt %s/%s): %s",
                    attempt + 1,
                    retries + 1,
                    type(error).__name__,
                )
                await self._reset_pool()
                await asyncio.sleep(
                    max(0, self._settings.mysql_retry_backoff_ms)
                    / 1000
                    * (2**attempt)
                )
        raise RuntimeError("Database read did not return")

    async def fetch_one(self, sql: str, params: tuple[Any, ...]) -> dict[str, Any] | None:
        result = await self._read(sql, params, fetch_all=False)
        return result if result is None or isinstance(result, dict) else None

    async def fetch_all(self, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        result = await self._read(sql, params, fetch_all=True)
        return result if isinstance(result, list) else []

    async def execute(self, sql: str, params: tuple[Any, ...] = ()) -> int:
        async with self.cursor() as cursor:
            await cursor.execute(sql, params)
            return cursor.rowcount

    @asynccontextmanager
    async def transaction(self, *, lock_name: str | None = None) -> AsyncIterator[Any]:
        await self.connect()
        pool = self._pool
        if pool is None or pool.closed:
            raise DatabaseUnavailableError("Database pool is not available")
        async with pool.acquire() as connection:
            await connection.ping(reconnect=True)
            async with connection.cursor() as cursor:
                if lock_name:
                    await cursor.execute("select get_lock(%s, 30) as acquired", (lock_name,))
                    if (await cursor.fetchone())["acquired"] != 1:
                        raise TimeoutError("Another product import is busy; retry this batch")
                try:
                    await connection.begin()
                    try:
                        yield cursor
                    except BaseException:
                        await connection.rollback()
                        raise
                    else:
                        await connection.commit()
                finally:
                    if lock_name:
                        await cursor.execute("select release_lock(%s)", (lock_name,))
