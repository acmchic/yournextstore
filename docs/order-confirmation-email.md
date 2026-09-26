# Customer order confirmation email

After Stripe confirms payment and the order transaction commits, the outbox
worker sends the customer a receipt through Mailtrap's transactional email
API. The email includes an order number, product image previews, titles,
catalog/color/size, quantities, line totals, subtotal, shipping method and
price, tax, total paid, and the payment method. Card payments show the brand
and last four digits when Stripe supplies them. It does not include the
customer's shipping address.

## Configuration

Set these API-only environment variables:

```dotenv
EMAIL_SUPPORT=help@teebravo.com
EMAIL_SUPPORT_NAME=TeeBravo
MAILTRAP_API_KEY=
```

Use `api/.env` with `api/docker-compose.yml`, the repository `.env` with the
root `compose.yaml`, or `/etc/teebravo/api.env` on production. Keep
`MAILTRAP_API_KEY` out of source control and browser-visible configuration.
The sender domain/address must be authorized in Mailtrap. Restart the API
worker after changing configuration; production can use
`sudo bash deploy.sh --only-api`.

When the API key is blank, receipt events remain pending. Mailtrap or network
errors retry independently from the Telegram order alert.
