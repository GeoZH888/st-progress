"""
Create (or reset the password of) the admin user via the Supabase Auth Admin API.

This is a one-shot bootstrapping utility — equivalent to clicking "Add user"
in the Supabase dashboard, but driven from `.env` so it's reproducible.

Reads from .env:
  VITE_SUPABASE_URL           -> the project URL (used to compose the API URL)
  SUPABASE_SERVICE_ROLE_KEY   -> only the service role can call /auth/v1/admin/*

Edit ADMIN_EMAIL / ADMIN_PASSWORD below if you want different credentials.
The script:
  1. Tries to create the user with email_confirm=true (no email round-trip).
  2. If the user already exists (422), fetches the existing row and PUTs a
     password reset so this command is idempotent.

Usage:
    python scripts/create_admin_user.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(REPO_ROOT / ".env")

ADMIN_EMAIL = "superadmin@ci-world.com"
ADMIN_PASSWORD = "Admin123_**"

SUPABASE_URL = (os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    print(
        "!! Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env",
        file=sys.stderr,
    )
    sys.exit(1)

ADMIN_BASE = f"{SUPABASE_URL}/auth/v1/admin/users"


def _request(method: str, url: str, body: dict | None = None) -> tuple[int, dict | str]:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url,
        method=method,
        data=data,
        headers={
            "apikey": SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            payload = resp.read().decode("utf-8") or "{}"
            return resp.status, json.loads(payload)
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8") or "{}"
        try:
            return e.code, json.loads(payload)
        except json.JSONDecodeError:
            return e.code, payload


def find_user_by_email(email: str) -> dict | None:
    """The Admin Users list endpoint accepts ?email= to filter."""
    qs = urllib.parse.urlencode({"email": email, "per_page": 1})
    status, body = _request("GET", f"{ADMIN_BASE}?{qs}")
    if status != 200 or not isinstance(body, dict):
        return None
    users = body.get("users") or body.get("data") or []
    for u in users:
        if u.get("email", "").lower() == email.lower():
            return u
    return None


def main() -> None:
    print(f"[+] target: {ADMIN_EMAIL}  at  {SUPABASE_URL}")

    # 1. Try a clean create.
    create_status, create_body = _request(
        "POST",
        ADMIN_BASE,
        {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "email_confirm": True},
    )

    if create_status in (200, 201):
        uid = (create_body or {}).get("id", "?")
        print(f"    created. user id = {uid}")
        print("    email is auto-confirmed. login at /admin/login.")
        return

    # 2. Already exists? Reset the password instead.
    msg = (
        (create_body.get("msg") or create_body.get("message") or "")
        if isinstance(create_body, dict)
        else str(create_body)
    )
    if create_status in (422, 400) and "registered" in msg.lower():
        print(f"    user already exists ({msg}); resetting password instead")
        existing = find_user_by_email(ADMIN_EMAIL)
        if not existing:
            print("    ! could not locate user via list endpoint", file=sys.stderr)
            sys.exit(2)
        update_status, update_body = _request(
            "PUT",
            f"{ADMIN_BASE}/{existing['id']}",
            {"password": ADMIN_PASSWORD, "email_confirm": True},
        )
        if update_status == 200:
            print("    password reset; email confirmed. login at /admin/login.")
            return
        print(f"    ! update failed ({update_status}): {update_body}", file=sys.stderr)
        sys.exit(3)

    print(f"    ! create failed ({create_status}): {create_body}", file=sys.stderr)
    sys.exit(4)


if __name__ == "__main__":
    main()
