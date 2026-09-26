# Telegram order notifications

The API outbox worker sends a Telegram message after a Stripe checkout has been
confirmed as paid and the order has been committed. The message contains the
order number, paid total and item quantity; it does not include the buyer's
email or shipping address. Temporary Telegram/API failures are retried from
the outbox.

## Configure the bot

1. Create a Telegram bot with `@BotFather` and keep its bot token private.
2. Open a private chat with the bot and send `/start`.
3. Get the chat ID for that chat from the bot's updates, then set these values
   in the API environment file:

   ```dotenv
   TELEGRAM_BOT_TOKEN=
   TELEGRAM_CHAT_ID=
   ```

   For local `api/docker-compose.yml`, use `api/.env`. Root `compose.yaml` reads
   these values from the repository `.env`. Production uses
   `/etc/teebravo/api.env` (or the configured Docker config directory).

Restart/redeploy the API worker after changing credentials. For production,
`sudo bash deploy.sh --only-api` builds the API image and restarts both the API
and outbox worker. When credentials are blank, paid-order events stay pending
until both values are configured.
