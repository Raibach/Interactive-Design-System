"""THE OUTGOING MAIL — one place, standard library only.

WHY `smtplib` AND NOT A LIBRARY. Sending mail over an authenticated SMTP server is four moves —
connect, log in, hand over a message, hang up — and Python's standard library does all four. A
mail library would add a dependency to do the same work; the only thing this repository would
gain is a newer CVE surface on the path where a password travels.

WHY IT SAYS NO RATHER THAN RAISING. Every caller here is a person trying to create an account.
A missing SMTP_PASS is a configuration mistake on this side, not something they did, and turning
it into a 500 would present it as their failure. So the send returns (ok, detail) and the CALLER
decides what the person is told — see the signup route, which reports the account as created and
the mail as unsent, because those are two different facts and only one of them is their problem.

BLOCKING BY NATURE, AND SAID SO. smtplib is synchronous: it opens a socket and waits. Callers
must hand it to a thread (`asyncio.to_thread`) so a slow mail server cannot stall the event loop
that is serving everyone else. This module does not do that itself — it cannot know whether its
caller is async, and quietly starting threads inside a library is how a program ends up with
threads nobody owns.
"""
from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr


# The connection values, read at call time rather than at import: a developer who fixes .env
# should not have to restart the process to find out whether they fixed it.
def _settings() -> dict[str, str]:
    import os

    return {
        "host": os.getenv("SMTP_HOST", "").strip(),
        "port": os.getenv("SMTP_PORT", "465").strip(),
        "user": os.getenv("SMTP_USER", "").strip(),
        "password": os.getenv("SMTP_PASS", ""),
        "sender": os.getenv("FROM_EMAIL", "").strip(),
    }


def smtp_configured() -> bool:
    """Whether there is enough here to attempt a send. Says nothing about whether it will work."""
    s = _settings()
    return bool(s["host"] and s["user"] and s["password"] and s["sender"])


def send_email(to_email: str, subject: str, body: str) -> tuple[bool, str]:
    """Send one plain-text message. Returns (sent, detail) — never raises for a mail failure.

    The detail is written to be shown to a person where that is useful ("the mail server
    refused the login") and to a log where it is not. It never contains the password.
    """
    s = _settings()
    if not smtp_configured():
        return False, "email is not configured on this server (SMTP_HOST/SMTP_USER/SMTP_PASS/FROM_EMAIL)"

    message = EmailMessage()
    message["From"] = formataddr(("Raibach IDS", s["sender"]))
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        port = int(s["port"] or "465")
    except ValueError:
        return False, f"SMTP_PORT is not a number: {s['port']!r}"

    try:
        # Port 465 is implicit TLS — the socket is wrapped before the conversation starts.
        # (587 would be STARTTLS, a different dance; this host publishes 465, and both are
        # written here rather than guessed so the difference is visible to whoever reads this.)
        if port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(s["host"], port, context=context, timeout=20) as server:
                server.login(s["user"], s["password"])
                server.send_message(message)
        else:
            with smtplib.SMTP(s["host"], port, timeout=20) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(s["user"], s["password"])
                server.send_message(message)
    except smtplib.SMTPAuthenticationError:
        return False, "the mail server refused the login (check SMTP_USER and SMTP_PASS)"
    except Exception as exc:  # a refused connection, a timeout, a bad host — all the same to the caller
        return False, f"the mail could not be sent: {type(exc).__name__}: {exc}"

    return True, f"sent to {to_email}"


def send_verification_code(to_email: str, code: str) -> tuple[bool, str]:
    """The one message this repository sends today."""
    return send_email(
        to_email,
        "Your Raibach IDS verification code",
        (
            f"Your verification code is: {code}\n\n"
            "Enter it on the page you came from to finish creating your account.\n\n"
            "If you did not ask for this, nothing was created that you need to undo — the "
            "account simply stays unverified and expires.\n"
        ),
    )
