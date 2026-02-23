/*
 * Spaced repetition (SM-2) utilities for LockIN backend (JavaScript).
 *
 * Exports:
 * - sm2Update(card, quality, now?) -> updated fields object
 * - updateCardDb(client, cardId, quality, now?) -> Promise resolving to updates
 */
'use strict';

function _nowUtc() {
  return new Date();
}

function clampInt(v, lo, hi) {
  v = Number(v) | 0;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/**
 * Compute SM-2 updates for a card.
 * card: object with ease_factor (number), repetitions (int), interval_days (int)
 * quality: integer 0..5
 * now: optional Date
 * Returns object with keys: ease_factor, repetitions, interval_days, due_date, last_reviewed
 */
function sm2Update(card = {}, quality, now = null) {
  if (!now) now = _nowUtc();

  const ef = Number(card.ease_factor !== undefined ? card.ease_factor : 2.5);
  let reps = Number.isFinite(card.repetitions) ? (card.repetitions | 0) : 0;
  const prev_interval = Number.isFinite(card.interval_days) ? (card.interval_days | 0) : 0;

  let q = clampInt(quality, 0, 5);

  let interval;
  if (q < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) {
      interval = 1;
    } else if (reps === 2) {
      interval = 6;
    } else {
      const base = prev_interval > 0 ? prev_interval : 6;
      interval = Math.round(base * ef);
    }
  }

  let newEf = ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  if (newEf < 1.3) newEf = 1.3;

  const dueDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return {
    ease_factor: Math.round(newEf * 10000) / 10000,
    repetitions: reps,
    interval_days: Number(interval),
    due_date: dueDate.toISOString(),
    last_reviewed: now.toISOString(),
  };
}

/**
 * Update a card row in the DB using a node-postgres client or pool.
 * client: any object with `query(text, params)` returning a Promise.
 * Returns the computed updates.
 */
async function updateCardDb(client, cardId, quality, now = null) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('A node-postgres client (with query()) is required for DB updates');
  }
  const res = await client.query('SELECT ease_factor, repetitions, interval_days FROM "Card" WHERE id = $1', [cardId]);
  if (!res || !res.rows || res.rows.length === 0) {
    throw new Error(`Card id=${cardId} not found`);
  }
  const row = res.rows[0];
  const card = { ease_factor: Number(row.ease_factor), repetitions: Number(row.repetitions), interval_days: Number(row.interval_days) };

  const updates = sm2Update(card, quality, now);

  await client.query(
    'UPDATE "Card" SET ease_factor = $1, repetitions = $2, interval_days = $3, due_date = $4, last_reviewed = $5 WHERE id = $6',
    [updates.ease_factor, updates.repetitions, updates.interval_days, updates.due_date, updates.last_reviewed, cardId]
  );

  return updates;
}

module.exports = { sm2Update, updateCardDb };

if (require.main === module) {
  // demo
  let sample = { ease_factor: 2.5, repetitions: 0, interval_days: 0 };
  console.log('Initial:', sample);
  for (const q of [5, 5, 5, 4, 2, 5]) {
    const updates = sm2Update(sample, q);
    console.log(`quality=${q} ->`, updates);
    sample.ease_factor = updates.ease_factor;
    sample.repetitions = updates.repetitions;
    sample.interval_days = updates.interval_days;
  }
}
