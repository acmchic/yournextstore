from __future__ import annotations

from html import escape

import httpx


class MailtrapDeliveryError(Exception):
    pass


def _money(amount_minor: int, currency: str) -> str:
    amount = f"{amount_minor // 100:,}.{amount_minor % 100:02d}"
    return f"${amount}" if currency.upper() == "USD" else f"{amount} {currency.upper()}"


def render_order_success_email(
    payload: dict[str, object], aggregate_id: str
) -> tuple[str, str, str]:
    order_number = str(payload.get("order_number") or aggregate_id)
    currency = str(payload.get("currency") or "USD").upper()
    items = payload.get("items") or []
    rows = []
    text_rows = []
    for item in items:
        title = str(item.get("title") or "Item")
        catalog = str(item.get("catalog_name") or "")
        color = str(item.get("color_name") or "")
        size = str(item.get("size_code") or "")
        quantity = int(item.get("quantity") or 0)
        unit_price = _money(int(item.get("unit_price_minor") or 0), currency)
        line_total = _money(int(item.get("line_total_minor") or 0), currency)
        details = " · ".join(value for value in (catalog, color, size) if value)
        image_url = str(item.get("image_url") or "")
        preview = (
            f'<img src="{escape(image_url, quote=True)}" alt="{escape(title, quote=True)}" '
            'width="88" height="88" style="display:block;width:88px;height:88px;'
            'object-fit:cover;border-radius:8px;background:#f4f4f4">'
            if image_url
            else ""
        )
        rows.append(
            "<tr>"
            f'<td style="padding:16px 12px 16px 0;vertical-align:top">{preview}</td>'
            '<td style="padding:16px 12px;vertical-align:top">'
            f'<div style="font-weight:600;color:#171717">{escape(title)}</div>'
            f'<div style="margin-top:5px;color:#666;font-size:13px">{escape(details)}</div>'
            f'<div style="margin-top:5px;color:#666;font-size:13px">Qty: {quantity} × {unit_price}</div>'
            f'</td><td style="padding:16px 0;text-align:right;vertical-align:top;white-space:nowrap">{line_total}</td>'
            "</tr>"
        )
        text_rows.append(f"{title} ({details}) — Qty {quantity} × {unit_price} — {line_total}")

    subtotal = _money(int(payload.get("subtotal_minor") or 0), currency)
    shipping = _money(int(payload.get("shipping_minor") or 0), currency)
    tax = _money(int(payload.get("tax_minor") or 0), currency)
    total = _money(int(payload.get("total_minor") or 0), currency)
    shipping_method = str(payload.get("shipping_method") or "Shipping")
    payment_method = str(payload.get("payment_method") or "Card")
    subject = f"Order confirmation — {order_number}"
    text = "\n".join(
        (
            "Thanks for your TeeBravo order!",
            "Your payment was received and your order is confirmed.",
            f"Order: {order_number}",
            "",
            *text_rows,
            "",
            f"Subtotal: {subtotal}",
            f"Shipping ({shipping_method}): {shipping}",
            f"Tax: {tax}",
            f"Total paid: {total}",
            f"Payment method: {payment_method}",
            "",
            "Questions? Email help@teebravo.com.",
            "TeeBravo",
        )
    )
    html = (
        '<!doctype html><html><body style="margin:0;background:#f7f7f5;'
        'font-family:Arial,Helvetica,sans-serif;color:#171717">'
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="background:#f7f7f5;padding:32px 12px"><tr><td align="center">'
        '<table role="presentation" width="600" cellspacing="0" cellpadding="0" '
        'style="width:100%;max-width:600px;background:#fff;border:1px solid #e7e5e4;'
        'border-radius:12px"><tr><td style="padding:32px">'
        '<div style="font-size:18px;letter-spacing:6px;font-weight:500">TEEBRAVO</div>'
        '<p style="margin:32px 0 8px;color:#777;font-size:12px;letter-spacing:2px">ORDER CONFIRMED</p>'
        '<h1 style="margin:0 0 12px;font-size:28px;font-weight:500">Thank you for your order.</h1>'
        '<p style="margin:0;color:#666;line-height:1.6">Your payment was received and your order is confirmed.</p>'
        '<p style="margin:18px 0 28px;color:#666">Order <strong style="color:#171717">'
        f"{escape(order_number)}</strong></p>"
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="border-collapse:collapse;border-top:1px solid #e7e5e4;border-bottom:1px solid #e7e5e4">'
        f"{''.join(rows)}"
        "</table>"
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        'style="margin-top:20px;color:#666;font-size:14px">'
        f'<tr><td style="padding:6px 0">Subtotal</td><td align="right">{subtotal}</td></tr>'
        f'<tr><td style="padding:6px 0">Shipping · {escape(shipping_method)}</td><td align="right">{shipping}</td></tr>'
        f'<tr><td style="padding:6px 0">Tax</td><td align="right">{tax}</td></tr>'
        f'<tr><td style="padding:12px 0;border-top:1px solid #e7e5e4;color:#171717;font-size:16px;font-weight:700">Total paid</td>'
        f'<td align="right" style="padding:12px 0;border-top:1px solid #e7e5e4;color:#171717;font-size:16px;font-weight:700">{total}</td></tr>'
        "</table>"
        f'<p style="margin:18px 0 0;color:#666;font-size:14px">Payment method: {escape(payment_method)}</p>'
        '<p style="margin:32px 0 0;padding-top:20px;border-top:1px solid #e7e5e4;color:#666;line-height:1.6">'
        'Questions about your order? <a href="mailto:help@teebravo.com" style="color:#171717">'
        "help@teebravo.com</a></p>"
        '<p style="margin:20px 0 0;color:#777;font-size:12px">TeeBravo</p>'
        "</td></tr></table></td></tr></table></body></html>"
    )
    return subject, text, html


async def send_order_success_email(
    payload: dict[str, object],
    aggregate_id: str,
    api_key: str,
    from_email: str,
    from_name: str,
) -> None:
    recipient = str(payload.get("email") or "").strip()
    if not recipient:
        raise MailtrapDeliveryError("missing_recipient")
    subject, text, html = render_order_success_email(payload, aggregate_id)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://send.api.mailtrap.io/api/send",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "from": {"email": from_email, "name": from_name},
                    "to": [{"email": recipient}],
                    "subject": subject,
                    "text": text,
                    "html": html,
                },
            )
    except httpx.HTTPError as error:
        raise MailtrapDeliveryError(type(error).__name__) from None

    if response.status_code < 200 or response.status_code >= 300:
        raise MailtrapDeliveryError(f"http_{response.status_code}")
    try:
        result = response.json()
    except ValueError:
        raise MailtrapDeliveryError("invalid_response") from None
    if not isinstance(result, dict) or result.get("success") is not True:
        raise MailtrapDeliveryError("api_rejected")
