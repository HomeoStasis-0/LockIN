"""Spaced repetition (SM-2) utilities for LockIN backend.

This module provides a pure implementation of the SM-2 algorithm and
helpers to compute card scheduling fields. It does not depend on a DB
package so it can be used in unit tests and in your backend code.

Functions:
- `sm2_update(card, quality, now=None)` -> returns updated fields dict

Card argument is a mapping with at least these keys:
  - `ease_factor` (float)
  - `repetitions` (int)
  - `interval_days` (int)

`quality` follows Anki's 0-5 scale (int).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, TYPE_CHECKING


if TYPE_CHECKING:
    import psycopg2


@dataclass
class CardState:
    ease_factor: float
    repetitions: int
    interval_days: int


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def sm2_update(card: Dict[str, Any], quality: int, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Compute SM-2 updates for a card given a `quality` (0-5).

    Args:
      card: mapping containing `ease_factor` (float), `repetitions` (int),
            and `interval_days` (int). Other keys are ignored.
      quality: integer 0..5 (Anki-style quality rating)
      now: optional datetime for `last_reviewed` and `due_date` computation

    Returns:
      dict with updated keys: `ease_factor`, `repetitions`, `interval_days`,
      `due_date` (ISO str), `last_reviewed` (ISO str)

    Notes:
      - Uses classic SM-2 formula for ease factor adjustment and intervals.
      - Ensures ease factor >= 1.3.
    """
    if now is None:
        now = _now_utc()

    # Defensive defaults
    ef = float(card.get("ease_factor", 2.5))
    reps = int(card.get("repetitions", 0))
    prev_interval = int(card.get("interval_days", 0))

    # the clamp quality
    q = int(quality)
    if q < 0:
        q = 0
    if q > 5:
        q = 5

    if q < 3:
        # the failed review, which will then reset repetitions
        reps = 0
        interval = 1
    else:
        reps += 1
        if reps == 1:
            interval = 1
        elif reps == 2:
            interval = 6
        else:
            # for repetitions > 2 use previous interval * EF
            # if prev_interval is 0 (defensive), treat it as 6
            base = prev_interval if prev_interval > 0 else 6
            interval = round(base * ef)

    # update ease factor
    new_ef = ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
    if new_ef < 1.3:
        new_ef = 1.3

    due_date = now + timedelta(days=interval)

    return {
        "ease_factor": round(new_ef, 4),
        "repetitions": reps,
        "interval_days": int(interval),
        "due_date": due_date.isoformat(),
        "last_reviewed": now.isoformat(),
    }


def update_card_db(conn, card_id: int, quality: int, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Update a card row in the DB using a DB-API connection.

    This function expects `conn` to be a DB-API connection (e.g. psycopg2).
    It will SELECT the current card fields, compute updates, apply them
    with an UPDATE, and return the new fields.

    If `psycopg2` is not installed or the connection doesn't match the
    expected interface, the function will raise an informative error.
    """
    try:
        import psycopg2
    except Exception as exc:
        raise RuntimeError("psycopg2 is required for DB updates: install psycopg2-binary") from exc

    cur = conn.cursor()
    cur.execute(
        "SELECT ease_factor, repetitions, interval_days FROM \"Card\" WHERE id = %s",
        (card_id,),
    )
    row = cur.fetchone()
    if not row:
        cur.close()
        raise ValueError(f"Card id={card_id} not found")

    card = {"ease_factor": float(row[0]), "repetitions": int(row[1]), "interval_days": int(row[2])}
    updates = sm2_update(card, quality, now=now)

    cur.execute(
        "UPDATE \"Card\" SET ease_factor = %s, repetitions = %s, interval_days = %s, due_date = %s, last_reviewed = %s WHERE id = %s RETURNING id",
        (
            updates["ease_factor"],
            updates["repetitions"],
            updates["interval_days"],
            updates["due_date"],
            updates["last_reviewed"],
            card_id,
        ),
    )
    conn.commit()
    cur.close()
    return updates


if __name__ == "__main__":
    # demo
    sample = {"ease_factor": 2.5, "repetitions": 0, "interval_days": 0}
    print("Initial:", sample)
    for q in [5, 5, 5, 4, 2, 5]:
        updates = sm2_update(sample, q)
        print(f"quality={q} ->", updates)
        # apply updates to sample for next iteration
        sample["ease_factor"] = updates["ease_factor"]
        sample["repetitions"] = updates["repetitions"]
        sample["interval_days"] = updates["interval_days"]
