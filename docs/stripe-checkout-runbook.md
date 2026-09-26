# Stripe Checkout production runbook

## Environment

Set these only in the API runtime or secret manager. Keep test and live keys and
webhook signing secrets in separate variables; they must come from endpoints in
the corresponding Stripe mode:

- `STRIPE_MODE=test` or `STRIPE_MODE=live` (defaults to `test`)
- `STRIPE_TEST_SECRET_KEY`
- `STRIPE_TEST_WEBHOOK_SECRET`
- `STRIPE_LIVE_SECRET_KEY`
- `STRIPE_LIVE_WEBHOOK_SECRET`
- `CHECKOUT_SUCCESS_URL=https://teebravo.com/checkout/success?session_id={CHECKOUT_SESSION_ID}`
- `CHECKOUT_CANCEL_URL=https://teebravo.com/checkout`
- `STRIPE_AUTOMATIC_TAX=false` until Stripe Tax registrations and the store's tax obligations are confirmed

Never expose either Stripe secret to the browser. The storefront calls FastAPI from server actions.

## Stripe Dashboard

1. Register the production HTTPS domain `teebravo.com` for payment-method domains.
2. Keep cards enabled. Apple Pay is available through Stripe Checkout by default when the customer and device are eligible. Enable Google Pay in Stripe payment-method settings.
3. If automatic tax is enabled, configure Stripe Tax registrations and the correct default product tax code before changing `STRIPE_AUTOMATIC_TAX` to `true`.
4. Add a webhook endpoint pointing to the public API route `/v1/stripe/webhook` and subscribe to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
5. Store each endpoint signing secret in the matching `STRIPE_TEST_WEBHOOK_SECRET` or `STRIPE_LIVE_WEBHOOK_SECRET` variable.

## TeeBravo admin launch gate

Complete `Shipping & business` with truthful business identity, support email, processing/transit estimates, restrictions and returns/refunds terms. Review and publish all five pages: About, Shipping, Returns, Privacy and Terms. Live Stripe keys intentionally refuse checkout while any of these pages is missing or still a draft.

The shipping policy uses dynamic tokens, including `{{standard_first}}`, `{{standard_additional}}`, `{{express_first}}` and `{{express_additional}}`. Keep those tokens in the published Shipping page so an admin rate change updates the public policy.

## Verification

Use Stripe test mode first:

1. Add two quantities to a cart and verify Standard is `$8.00` and Express is `$15.00`.
2. Complete a US card payment and confirm one order, one customer record and one converted cart in admin.
3. Repeat the same webhook event and confirm no duplicate order is created.
4. Cancel an open checkout, edit the cart and verify reserved stock is restored once.
5. Test Apple Pay on an eligible Safari/Wallet device and Google Pay on an eligible signed-in Chrome/Wallet device. Wallet availability is decided by Stripe, browser and device.
6. Confirm subtotal, shipping, tax and total are visible before payment and match the resulting admin order.

To switch modes, change only `STRIPE_MODE` and restart/redeploy the API so it
loads the matching secret key and webhook signing secret. After switching to
`live`, run one small real order and refund it in Stripe. Do not submit the
Merchant Center feed until the purchase path, contact details, policies,
inventory, product price and images all match production.
