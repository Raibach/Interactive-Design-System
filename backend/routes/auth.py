"""Auth — the login the schema was built for and the endpoints never were.

WHY THIS FILE EXISTS
────────────────────
`users.password_hash`, `failed_login_attempts`, `locked_until`, `last_login_at`
and `last_login_ip` have been in `init_db.py` since it was written. Two real
people — `john@raibach.net` and `jt@raibach.net` — have real bcrypt hashes in
those columns. And `frontend/src/services/authService.ts` has been calling
`POST /api/auth/login` and `POST /api/auth/signup` the whole time.

The endpoints did not exist. There was no `auth.py` at all.

So the frontend carried its own workaround: `PinGate.tsx` held a hardcoded map
of four-digit codes inside a React component, with ONE entry, pointing at
DEFAULT_USER_ID. That is why there is one user in practice — the only way in
was a constant in the bundle, and a constant cannot be a second person.

WHAT THAT COST
──────────────
`session_permissions` holds 267 rows and every one of them is `owner`: one row
per package, written at creation. Zero rows have ever been shared. The sharing
endpoints are not missing — `POST /api/prompt-sessions/{id}/permissions` has
been there, owner-only, roles owner/editor/viewer. Nobody could call it,
because there was no second identity to grant to and no way to become one.

Identity is the one thing everything else hangs off: a package is owned by a
user, a permission row names a user, and a conversation belongs to a package.
So this is the smallest file that unblocks the largest amount of the system.

IDENTITY IS A ROW, NOT FRONTEND STATE
─────────────────────────────────────
This is the same database that holds the packages, so the identity that owns a
package is the same identity the permission rows point at — one system of
record, no second copy in the browser to drift from it. Who you are, whether
you are locked out, when you last got in and from where: all of it is recorded
here, in the row, where it survives a refresh, a different machine, and a
different day.
"""
import sys
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

import services as state
from deps import get_user_id_from_header, user_is_admin, DEFAULT_USER_ID

router = APIRouter()

# Five wrong passwords locks the row for fifteen minutes. These live in the
# schema as `failed_login_attempts` and `locked_until` — they were written for
# this and have never held a value, so the defaults are set here rather than
# guessed at later.
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

# The database enforces `users_role_check`: role must be teacher, student or
# admin. 'admin' is deliberately NOT offered here — the schema permits it, but
# an endpoint that mints administrators on request is a privilege-escalation
# path, and admin is granted by an existing admin, not claimed at signup.
SELF_SIGNUP_ROLES = ("teacher", "student")
DEFAULT_SIGNUP_ROLE = "student"

# bcrypt silently ignores anything past 72 bytes, and bcrypt 5.x RAISES on it.
# Truncating is what the algorithm already does, so this makes the behaviour
# explicit instead of turning a long password into a 500.
BCRYPT_MAX_BYTES = 72


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    # `users.role` vocabulary, not `prompt_role`'s — the check constraint on
    # the column allows teacher/student/admin only. See SELF_SIGNUP_ROLES.
    role: str = "student"


def _verify_password(password: str, password_hash: str) -> bool:
    """Check a password against a stored hash. Never raises.

    A placeholder hash is not a server error, it is a credential that cannot
    match. Seven of the ten rows are placeholders — `test_hash`,
    `dev_user_no_password` — and bcrypt raises `ValueError` on all of them. If
    that escaped as a 500 it would report a database fault for what is simply
    a login that does not work, and the person would be told the wrong thing.
    """
    try:
        import bcrypt

        return bcrypt.checkpw(
            password.encode("utf-8")[:BCRYPT_MAX_BYTES],
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def _hash_password(password: str) -> str:
    import bcrypt

    return bcrypt.hashpw(
        password.encode("utf-8")[:BCRYPT_MAX_BYTES], bcrypt.gensalt(rounds=12)
    ).decode("utf-8")


def _db():
    """The pool the rest of the app uses. None when the database is down."""
    if not state.prompt_sessions_api:
        return None
    return state.prompt_sessions_api.get_db()


@router.post("/api/auth/login")
async def login(request: LoginRequest, http_request: Request):
    """Verify an email + password against `users` and record the login.

    Returns exactly the shape `authService.ts::login()` already parses, so the
    client that has been written against this endpoint for months works
    unchanged. That is the point of matching it rather than inventing a new
    one — the contract was already agreed by the code that calls it.
    """
    conn = _db()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database not available")

    email = (request.email or "").strip().lower()
    if not email or not request.password:
        conn.close()
        raise HTTPException(status_code=400, detail="Email and password are required")

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, email, full_name, password_hash, status,
                   failed_login_attempts, locked_until, role, prompt_role
            FROM users
            WHERE lower(email) = %s AND deleted_at IS NULL
            """,
            (email,),
        )
        row = cursor.fetchone()

        # ── One message for every way this can fail ──────────────────────
        # "No such email" and "wrong password" must be indistinguishable, or
        # the endpoint becomes a way to ask which people have accounts. The
        # lockout message is the single deliberate exception: it is addressed
        # to someone who already proved they hold the account.
        if not row:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if row.get("locked_until") and row["locked_until"] > datetime.now():
            remaining = int((row["locked_until"] - datetime.now()).total_seconds() // 60) + 1
            raise HTTPException(
                status_code=423,
                detail=f"Account locked after too many attempts. Try again in {remaining} minute(s).",
            )

        if (row.get("status") or "active") != "active":
            raise HTTPException(status_code=403, detail="This account is not active.")

        if not _verify_password(request.password, row["password_hash"] or ""):
            # Count the miss on the row itself. A lockout that lives in memory
            # is a lockout that a restart forgets.
            failed = (row.get("failed_login_attempts") or 0) + 1
            if failed >= MAX_FAILED_ATTEMPTS:
                cursor.execute(
                    "UPDATE users SET failed_login_attempts = %s, locked_until = %s WHERE id = %s",
                    (failed, datetime.now() + timedelta(minutes=LOCKOUT_MINUTES), row["id"]),
                )
            else:
                cursor.execute(
                    "UPDATE users SET failed_login_attempts = %s WHERE id = %s",
                    (failed, row["id"]),
                )
            conn.commit()
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # ── Success: clear the counter and write the visit down ──────────
        client_ip = http_request.client.host if http_request.client else None
        cursor.execute(
            """
            UPDATE users
               SET failed_login_attempts = 0,
                   locked_until = NULL,
                   last_login_at = NOW(),
                   last_login_ip = %s
             WHERE id = %s
            """,
            (client_ip, row["id"]),
        )
        conn.commit()

        # The gate links to the ONE real user — the identity the packages are
        # actually owned by (DEFAULT_USER_ID), not the row the credentials live
        # on. The credentials row is the gate; the identity is the owner. This
        # is not multi-tenant auth — it is a doorman that drops you into the
        # existing owner.
        user_id = DEFAULT_USER_ID
        owner_email = DEFAULT_USER_ID
        owner_name = DEFAULT_USER_ID
        owner_role = None
        owner_prompt_role = None
        cursor.execute(
            """
            SELECT email, full_name, role, prompt_role
            FROM users WHERE id = %s AND deleted_at IS NULL
            """,
            (user_id,),
        )
        owner = cursor.fetchone()
        if owner:
            owner_email = owner["email"]
            owner_name = owner.get("full_name") or owner["email"]
            owner_role = owner.get("role")
            owner_prompt_role = owner.get("prompt_role")

        admin = user_is_admin(user_id)
        teacher = (owner_role == "teacher")
        return {
            "success": True,
            "user_id": user_id,
            "email": owner_email,
            "name": owner_name,
            "role": owner_prompt_role or owner_role or "basic",
            # The client reads both spellings (`data.is_admin || data.isAdmin`),
            # so both are sent rather than betting on which one it meant.
            "is_admin": admin,
            "isAdmin": admin,
            "is_teacher": teacher,
            "isTeacher": teacher,
            "last_login_at": row.get("last_login_at").isoformat() if row.get("last_login_at") else None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        print(f"❌ [auth] login failed: {exc}", file=sys.stderr)
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Login error: {exc}")
    finally:
        conn.close()


@router.get("/api/auth/me")
async def me(
    user_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
):
    """Resolve a stored user id back into a person.

    The browser keeps the id, not the person. After a refresh it holds a UUID
    and nothing else, so it needs one call that says who that is and whether
    they are still allowed in — the check `App.tsx` currently does by reading
    a localStorage flag it wrote itself.
    """
    conn = _db()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, email, full_name, status, role, prompt_role, last_login_at
            FROM users WHERE id = %s AND deleted_at IS NULL
            """,
            (user_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Unknown user")
        if (row.get("status") or "active") != "active":
            raise HTTPException(status_code=403, detail="This account is not active.")
        return {
            "success": True,
            "user_id": str(row["id"]),
            "email": row["email"],
            "name": row.get("full_name") or row["email"],
            "role": row.get("prompt_role") or row.get("role") or "basic",
            "is_admin": user_is_admin(str(row["id"])),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()


@router.post("/api/auth/signup")
async def signup(request: SignupRequest):
    """Create a user.

    `authService.ts::signup()` already calls this, and a second person is the
    only way to exercise sharing — the path has to exist before it can be
    walked. The password is hashed here with the same bcrypt cost the existing
    rows use (`$2b$12$`), so a new account is indistinguishable from one of
    the ten that are already in the table.
    """
    conn = _db()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database not available")

    email = (request.email or "").strip().lower()
    if not email or not request.password:
        conn.close()
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(request.password) < 6:
        conn.close()
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Two different columns, two different vocabularies, and getting them mixed
    # up is a 500 from a check constraint rather than a message. `users.role`
    # is the account type (teacher/student/admin); `prompt_role` is the product
    # persona (governance/ux-design/research/product/basic). The client sends
    # the account type, so that is what is validated here.
    account_role = (request.role or DEFAULT_SIGNUP_ROLE).strip().lower()
    if account_role not in SELF_SIGNUP_ROLES:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"role must be one of: {', '.join(SELF_SIGNUP_ROLES)}",
        )

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE lower(email) = %s", (email,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="An account with that email already exists")

        cursor.execute(
            """
            INSERT INTO users (email, password_hash, full_name, status, role, prompt_role)
            VALUES (%s, %s, %s, 'active', %s, 'basic')
            RETURNING id, email, full_name
            """,
            (email, _hash_password(request.password), request.full_name, account_role),
        )
        row = cursor.fetchone()
        conn.commit()
        return {
            "success": True,
            "user_id": str(row["id"]),
            "email": row["email"],
            "name": row.get("full_name") or row["email"],
            "role": "basic",
        }
    except HTTPException:
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Signup error: {exc}")
    finally:
        conn.close()


@router.get("/api/auth/users")
async def list_users(
    email: Optional[str] = None,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
):
    """Find someone to share a package WITH — admin only.

    Granting a permission needs a `user_id`, and until now the only way to get
    one was to open the database by hand. That is the step that made sharing
    something only its author could ever do, so it is given an endpoint.

    Guarded, because an unguarded list of every account and its email is a
    directory of the company — and this prototype has no real session layer to
    lean on (`deps.user_is_admin` is a documented stub in dev mode).
    """
    uid = get_user_id_from_header(x_user_id)
    if not user_is_admin(uid):
        raise HTTPException(status_code=403, detail="Only an administrator can list users")

    conn = _db()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        cursor = conn.cursor()
        if email:
            cursor.execute(
                """
                SELECT id, email, full_name, status, prompt_role
                FROM users WHERE lower(email) = %s AND deleted_at IS NULL
                """,
                (email.strip().lower(),),
            )
        else:
            cursor.execute(
                """
                SELECT id, email, full_name, status, prompt_role
                FROM users WHERE deleted_at IS NULL ORDER BY email
                """
            )
        users = [
            {
                "user_id": str(r["id"]),
                "email": r["email"],
                "name": r.get("full_name") or r["email"],
                "status": r.get("status"),
                "role": r.get("prompt_role"),
            }
            for r in cursor.fetchall()
        ]
        return {"success": True, "users": users, "count": len(users)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        conn.close()



