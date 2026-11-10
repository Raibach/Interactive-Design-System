"""The card archive: one session row set to archived, with its conversations and activity left in place."""
from __future__ import annotations

from typing import Any


def archive_card(api: Any, session_id: str, user_id: str) -> bool:
    """Archive one card for its owner. Nothing is deleted; the record stays readable."""
    with api.get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("SET app.current_user_id = %s", (user_id,))
            cursor.execute(
                """
                UPDATE prompt_sessions
                SET is_archived = TRUE, updated_at = NOW()
                WHERE id = %s AND user_id = %s
                RETURNING id
                """,
                (session_id, user_id),
            )
            result = cursor.fetchone()
            conn.commit()
            return result is not None
        except Exception:
            conn.rollback()
            raise
