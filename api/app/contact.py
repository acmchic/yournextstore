from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.settings import Settings


class ContactEmailError(RuntimeError):
    pass


def send_contact_email(config: Settings, customer_email: str, customer_message: str) -> None:
    if not config.smtp_host or not config.smtp_from_email or not config.contact_email_to:
        raise ContactEmailError("Contact email SMTP settings are incomplete")
    if config.smtp_use_ssl and config.smtp_starttls:
        raise ContactEmailError("Use either SMTP SSL or STARTTLS, not both")
    if bool(config.smtp_username) != bool(config.smtp_password):
        raise ContactEmailError("Both SMTP username and password must be configured together")

    try:
        email_message = EmailMessage()
        email_message["Subject"] = "New customer message - TeeBravo"
        email_message["From"] = formataddr(("TeeBravo Support", config.smtp_from_email))
        email_message["To"] = config.contact_email_to
        email_message["Reply-To"] = customer_email
        email_message.set_content(
            "A customer sent a message through the TeeBravo contact form.\n\n"
            f"Customer email: {customer_email}\n\n"
            "Message:\n"
            f"{customer_message}\n"
        )

        context = ssl.create_default_context()
        if config.smtp_use_ssl:
            with smtplib.SMTP_SSL(
                config.smtp_host, config.smtp_port, timeout=15, context=context
            ) as server:
                if config.smtp_username:
                    server.login(config.smtp_username, config.smtp_password)
                server.send_message(email_message)
            return

        with smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=15) as server:
            if config.smtp_starttls:
                server.starttls(context=context)
            if config.smtp_username:
                server.login(config.smtp_username, config.smtp_password)
            server.send_message(email_message)
    except (OSError, RuntimeError, ValueError, smtplib.SMTPException) as error:
        raise ContactEmailError("Could not deliver contact form email") from error
