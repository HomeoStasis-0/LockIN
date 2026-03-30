const express = require("express");

module.exports = function createCommunityRouter(pool, authenticate) {
  const router = express.Router();

  // Get/search all public decks
  router.get("/decks", authenticate, async (req, res) => {
    const search = String(req.query.search ?? "").trim();

    try {
      const result = await pool.query(
        `
        SELECT
          pd.id,
          pd.user_id,
          pd.deck_name,
          pd.subject,
          pd.course_number,
          pd.instructor,
          pd.created_at
        FROM public_deck pd
        WHERE
          $1 = ''
          OR pd.deck_name ILIKE '%' || $1 || '%'
          OR COALESCE(pd.subject, '') ILIKE '%' || $1 || '%'
          OR COALESCE(pd.instructor, '') ILIKE '%' || $1 || '%'
          OR COALESCE(pd.course_number::text, '') ILIKE '%' || $1 || '%'
        ORDER BY pd.created_at DESC
        `,
        [search]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("GET /api/community/decks error:", err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Get one public deck together with its cards
  router.get("/decks/:id", authenticate, async (req, res) => {
    const publicDeckId = Number(req.params.id);

    if (!Number.isFinite(publicDeckId)) {
      return res.status(400).json({ error: "Invalid public deck id" });
    }

    try {
      const deckQ = await pool.query(
        `
        SELECT
          id,
          user_id,
          deck_name,
          subject,
          course_number,
          instructor,
          created_at
        FROM public_deck
        WHERE id = $1
        `,
        [publicDeckId]
      );

      if (deckQ.rowCount === 0) {
        return res.status(404).json({ error: "Public deck not found" });
      }

      const cardsQ = await pool.query(
        `
        SELECT
          pdc.id,
          pdc.public_deck_id,
          pdc.card_id
        FROM public_deck_card pdc
        WHERE pdc.public_deck_id = $1
        ORDER BY pdc.id
        `,
        [publicDeckId]
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

