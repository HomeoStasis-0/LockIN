const express = require("express");

module.exports = function createCommunityRouter(pool, authenticate) {
  const router = express.Router();

// Get/search all public decks
router.get("/decks", authenticate, async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const normalizedSearch = search.toLowerCase().replace(/\s+/g, "");

  try {
    const result = await pool.query(
      `
      SELECT
        pd.id AS public_deck_id,
        pd.deck_id,
        pd.user_id,
        pd.published_at,

        d.deck_name,
        d.subject,
        d.course_number,
        d.instructor,
        d.created_at AS deck_created_at,

        COUNT(c.id)::int AS card_count,

        CASE
          WHEN BOOL_OR(upd.id IS NOT NULL) THEN true
          ELSE false
        END AS is_saved

      FROM public_deck pd
      JOIN deck d
        ON d.id = pd.deck_id
      LEFT JOIN card c
        ON c.deck_id = d.id
      LEFT JOIN user_public_deck upd
        ON upd.public_deck_id = pd.id
       AND upd.user_id = $2

      WHERE
        $1 = ''
        OR d.deck_name ILIKE '%' || $1 || '%'
        OR COALESCE(d.subject, '') ILIKE '%' || $1 || '%'
        OR COALESCE(d.instructor, '') ILIKE '%' || $1 || '%'
        OR COALESCE(d.course_number::text, '') ILIKE '%' || $1 || '%'
        OR LOWER(COALESCE(d.subject, '') || COALESCE(d.course_number::text, '')) LIKE '%' || $3 || '%'
        OR LOWER(COALESCE(d.subject, '') || ' ' || COALESCE(d.course_number::text, '')) LIKE '%' || LOWER($1) || '%'
        OR EXISTS (
          SELECT 1
          FROM card c2
          WHERE c2.deck_id = d.id
            AND (
              c2.card_front ILIKE '%' || $1 || '%'
              OR c2.card_back ILIKE '%' || $1 || '%'
            )
        )

      GROUP BY
        pd.id,
        pd.deck_id,
        pd.user_id,
        pd.published_at,
        d.id

      ORDER BY pd.published_at DESC
      `,
      [search, req.user.user_id, normalizedSearch]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/community/decks error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

  // Get one public deck together with its real cards
  router.get("/decks/:id", authenticate, async (req, res) => {
    const publicDeckId = Number(req.params.id);

    if (!Number.isFinite(publicDeckId)) {
      return res.status(400).json({ error: "Invalid public deck id" });
    }

    try {
      const deckQ = await pool.query(
        `
        SELECT
          pd.id AS public_deck_id,
          pd.deck_id,
          pd.user_id,
          pd.published_at,

          d.deck_name,
          d.subject,
          d.course_number,
          d.instructor,
          d.created_at AS deck_created_at,

          CASE
            WHEN upd.id IS NOT NULL THEN true
            ELSE false
          END AS is_saved

        FROM public_deck pd
        JOIN deck d
          ON d.id = pd.deck_id
        LEFT JOIN user_public_deck upd
          ON upd.public_deck_id = pd.id
         AND upd.user_id = $2

        WHERE pd.id = $1
        `,
        [publicDeckId, req.user.user_id]
      );

      if (deckQ.rowCount === 0) {
        return res.status(404).json({ error: "Public deck not found" });
      }

      const cardsQ = await pool.query(
        `
        SELECT
          c.id,
          c.deck_id,
          c.card_front,
          c.card_back,
          c.created_at,
          c.ease_factor,
          c.interval_days,
          c.repetitions,
          c.due_date,
          c.last_reviewed
        FROM card c
        WHERE c.deck_id = $1
        ORDER BY c.id
        `,
        [deckQ.rows[0].deck_id]
      );

      res.json({
        ...deckQ.rows[0],
        cards: cardsQ.rows,
      });
    } catch (err) {
      console.error("GET /api/community/decks/:id error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Save a public deck for the current user
  router.post("/decks/:id/save", authenticate, async (req, res) => {
    const publicDeckId = Number(req.params.id);

    if (!Number.isFinite(publicDeckId)) {
      return res.status(400).json({ error: "Invalid public deck id" });
    }

    try {
      const publicDeckQ = await pool.query(
        `
        SELECT id
        FROM public_deck
        WHERE id = $1
        `,
        [publicDeckId]
      );

      if (publicDeckQ.rowCount === 0) {
        return res.status(404).json({ error: "Public deck not found" });
      }

      await pool.query(
        `
        INSERT INTO user_public_deck (user_id, public_deck_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, public_deck_id) DO NOTHING
        `,
        [req.user.user_id, publicDeckId]
      );

      res.json({ saved: true });
    } catch (err) {
      console.error("POST /api/community/decks/:id/save error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Unsave a public deck for the current user
  router.delete("/decks/:id/save", authenticate, async (req, res) => {
    const publicDeckId = Number(req.params.id);

    if (!Number.isFinite(publicDeckId)) {
      return res.status(400).json({ error: "Invalid public deck id" });
    }

    try {
      const deleteQ = await pool.query(
        `
        DELETE FROM user_public_deck
        WHERE user_id = $1 AND public_deck_id = $2
        RETURNING id
        `,
        [req.user.user_id, publicDeckId]
      );

      if (deleteQ.rowCount === 0) {
        return res.status(404).json({ error: "Saved public deck link not found" });
      }

      res.json({ saved: false });
    } catch (err) {
      console.error("DELETE /api/community/decks/:id/save error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  return router;
};