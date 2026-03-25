const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;
const { Pool } = require("pg");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const { updateCardDb } = require("../backEnd/spaced_repetition");
const { generateStudyMaterialsFromPdf } = require("../backEnd/services/aiService");

const app = express();

const uploadDir = path.join(__dirname, "..", "uploads");
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "") || ".pdf";
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${ext}`);
  },
});

const uploadPdf = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    if (name.endsWith(".pdf")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF files are allowed"));
  },
});

function normalizeFlashcards(studySet) {
  const rawCards = Array.isArray(studySet?.flashcards) ? studySet.flashcards : [];
  const quiz = Array.isArray(studySet?.quiz) ? studySet.quiz : [];

  const cardsFromFlashcards = rawCards
    .map((card) => {
      const front = String(
        card?.front ?? card?.question ?? card?.term ?? card?.title ?? ""
      ).trim();
      const back = String(
        card?.back ?? card?.answer ?? card?.definition ?? card?.explanation ?? ""
      ).trim();
      return { front, back };
    })
    .filter((c) => c.front && c.back);

  // If model returns quiz-only output, turn each quiz item into a card.
  const cardsFromQuiz = quiz
    .map((q) => {
      const front = String(q?.question ?? "").trim();
      const options = Array.isArray(q?.options) ? q.options.filter(Boolean).join(" | ") : "";
      const answer = String(q?.correct_answer ?? "").trim();
      const back = [
        answer ? `Answer: ${answer}` : "",
        options ? `Options: ${options}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return { front, back };
    })
    .filter((c) => c.front && c.back);

  const merged = cardsFromFlashcards.length > 0 ? cardsFromFlashcards : cardsFromQuiz;

  // Deduplicate repeated cards from model output.
  const signatures = [];
  return merged.filter((c) => {
    const signature = buildCardSignature(c.front, c.back);
    if (isLikelyDuplicateCard(signature, signatures)) {
      return false;
    }
    signatures.push(signature);
    return true;
  });
}

function normalizeCardText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CARD_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "about",
  "be",
  "by",
  "can",
  "condition",
  "define",
  "does",
  "equivalently",
  "exist",
  "exists",
  "existence",
  "for",
  "from",
  "given",
  "guarantee",
  "guarantees",
  "has",
  "have",
  "how",
  "if",
  "imply",
  "in",
  "is",
  "it",
  "its",
  "mean",
  "means",
  "of",
  "on",
  "or",
  "over",
  "state",
  "such",
  "that",
  "the",
  "theorem",
  "then",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
]);

function stemToken(token) {
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function canonicalizeToken(token) {
  const aliases = {
    identical: "identity",
    nontrivial: "non",
    theorem: "result",
  };
  return aliases[token] || token;
}

function toTokenSet(value) {
  const normalized = normalizeCardText(value);
  if (!normalized) return new Set();

  const tokens = normalized
    .split(" ")
    .map(stemToken)
    .map(canonicalizeToken)
    .filter((token) => (token.length > 1 || /^\d+$/.test(token)) && !CARD_STOP_WORDS.has(token));

  return new Set(tokens);
}

function tokenOverlapCount(setA, setB) {
  if (!setA.size || !setB.size) return 0;

  let overlap = 0;
  for (const token of setA) {
    if (setB.has(token)) overlap += 1;
  }
  return overlap;
}

function jaccardSimilarity(setA, setB) {
  if (!setA.size && !setB.size) return 1;
  if (!setA.size || !setB.size) return 0;

  const overlap = tokenOverlapCount(setA, setB);

  const unionSize = setA.size + setB.size - overlap;
  return unionSize === 0 ? 0 : overlap / unionSize;
}

function overlapCoefficient(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  const overlap = tokenOverlapCount(setA, setB);
  return overlap / Math.min(setA.size, setB.size);
}

function hasLargeContainment(left, right) {
  if (!left || !right) return false;
  const minLen = Math.min(left.length, right.length);
  if (minLen < 28) return false;
  return left.includes(right) || right.includes(left);
}

function buildCardSignature(front, back) {
  const frontNorm = normalizeCardText(front);
  const backNorm = normalizeCardText(back);
  const frontTokens = toTokenSet(frontNorm);
  const backTokens = toTokenSet(backNorm);

  return {
    exactKey: `${frontNorm}__${backNorm}`,
    frontNorm,
    backNorm,
    frontTokens,
    backTokens,
    combinedTokens: new Set([...frontTokens, ...backTokens]),
  };
}

function isLikelyDuplicateCard(candidate, existingSignatures) {
  for (const existing of existingSignatures) {
    if (existing.exactKey === candidate.exactKey) {
      return true;
    }

    if (existing.frontNorm === candidate.frontNorm && existing.frontNorm.length > 0) {
      return true;
    }

    if (hasLargeContainment(existing.frontNorm, candidate.frontNorm)) {
      return true;
    }

    const frontSimilarity = jaccardSimilarity(existing.frontTokens, candidate.frontTokens);
    const backSimilarity = jaccardSimilarity(existing.backTokens, candidate.backTokens);
    const combinedSimilarity = jaccardSimilarity(
      existing.combinedTokens,
      candidate.combinedTokens
    );
    const frontOverlapCount = tokenOverlapCount(existing.frontTokens, candidate.frontTokens);
    const frontOverlap = overlapCoefficient(existing.frontTokens, candidate.frontTokens);
    const backOverlap = overlapCoefficient(existing.backTokens, candidate.backTokens);

    if (frontSimilarity >= 0.7) {
      return true;
    }

    if (frontOverlap >= 0.9 && frontOverlapCount >= 3) {
      return true;
    }

    if (
      frontOverlap >= 0.62
      && (backSimilarity >= 0.18 || backOverlap >= 0.25 || combinedSimilarity >= 0.42)
    ) {
      return true;
    }

    if (frontSimilarity >= 0.58 && (backSimilarity >= 0.4 || combinedSimilarity >= 0.56)) {
      return true;
    }
  }

  return false;
}

async function removeDuplicateCardsInDeck(deckId) {
  const cardsQ = await pool.query(
    `SELECT id, card_front, card_back
     FROM card
     WHERE deck_id = $1
     ORDER BY created_at ASC, id ASC`,
    [deckId]
  );

  const rows = Array.isArray(cardsQ?.rows) ? cardsQ.rows : [];
  if (rows.length <= 1) {
    return 0;
  }

  const keptSignatures = [];
  const duplicateIds = [];

  for (const row of rows) {
    const signature = buildCardSignature(row.card_front, row.card_back);
    if (isLikelyDuplicateCard(signature, keptSignatures)) {
      duplicateIds.push(row.id);
      continue;
    }
    keptSignatures.push(signature);
  }

  if (duplicateIds.length === 0) {
    return 0;
  }

  await pool.query(
    `DELETE FROM card
     WHERE id = ANY($1::int[])`,
    [duplicateIds]
  );

  return duplicateIds.length;
}

const corsOptions = {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true 
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// NOTE: production static serving moved to after API routes so API endpoints work
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Test route using database
app.get("/api", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// JWT helper
const generateToken = (user) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
};

// Registration
app.post("/auth/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users
       (username, email, password_hash)
       VALUES ($1,$2,$3)
       RETURNING user_id, username, email`,
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false
    });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(400).json({
      error: "Username or email already exists"
    });
  }
});

// Login with username or email
app.post("/auth/login", async (req, res) => {
  const { login, password } = req.body;

  const result = await pool.query(
    `SELECT * FROM users
     WHERE username=$1 OR email=$1`,
    [login]
  );

  const user = result.rows[0];

  if (!user)
    return res.status(401).json({
      error: "Invalid credentials"
    });

  const validPassword = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!validPassword)
    return res.status(401).json({
      error: "Invalid credentials"
    });

  const token = generateToken(user);

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false
  });

  res.json({
    user_id: user.user_id,
    username: user.username,
    email: user.email
  });
});

// Auth middleware
const authenticate = (req, res, next) => {
  const token = req.cookies.token;

  if (!token)
    return res.sendStatus(401);

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;
    next();
  } catch {
    res.sendStatus(403);
  }
};

// React checks login 
app.get("/auth/me", authenticate, async (req, res) => {
  const result = await pool.query(
    `SELECT user_id, username, email
     FROM users
     WHERE user_id=$1`,
    [req.user.user_id]
  );

  res.json(result.rows[0]);
});

// Logout
app.post("/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

app.get("/api/decks/:id", async (req, res) => {
  const deckId = Number(req.params.id);
  if (!Number.isFinite(deckId)) return res.status(400).json({ error: "Invalid deck id" });

  try {
    const deckQ = await pool.query(
      `SELECT id, user_id, deck_name, subject, course_number, instructor, created_at
       FROM deck
       WHERE id = $1`,
      [deckId]
    );

    if (deckQ.rowCount === 0) return res.status(404).json({ error: "Deck not found" });

    const cardsQ = await pool.query(
      `SELECT id, deck_id, card_front, card_back, created_at,
              ease_factor, interval_days, repetitions, due_date, last_reviewed
       FROM card
       WHERE deck_id = $1
       ORDER BY created_at DESC`,
      [deckId]
    );

    res.json({ deck: deckQ.rows[0], cards: cardsQ.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/cards", async (req, res) => {
  const { deck_id, card_front, card_back } = req.body ?? {};
  if (!deck_id || !card_front || !card_back) {
    return res.status(400).json({ error: "deck_id, card_front, card_back required" });
  }

  try {
    const q = await pool.query(
      `INSERT INTO card (
         deck_id, card_front, card_back, created_at,
         ease_factor, interval_days, repetitions, due_date, last_reviewed
       )
       VALUES ($1, $2, $3, now(), 2.5, 0, 0, now(), null)
       RETURNING id, deck_id, card_front, card_back, created_at,
                 ease_factor, interval_days, repetitions, due_date, last_reviewed`,
      [Number(deck_id), card_front, card_back]
    );

    res.status(201).json(q.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/decks/:id/import-pdf", uploadPdf.single("pdf"), async (req, res) => {
  const deckId = Number(req.params.id);
  const file = req.file;

  if (!Number.isFinite(deckId)) {
    return res.status(400).json({ error: "Invalid deck id" });
  }

  if (!file || !file.path) {
    return res.status(400).json({ error: "No PDF file uploaded" });
  }

  try {
    const deckQ = await pool.query("SELECT id FROM deck WHERE id = $1", [deckId]);
    if (deckQ.rowCount === 0) {
      return res.status(404).json({ error: "Deck not found" });
    }

    const studySet = await generateStudyMaterialsFromPdf(file.path);
    const flashcards = normalizeFlashcards(studySet);
    console.log("PDF import result", {
      deckId,
      rawFlashcards: Array.isArray(studySet?.flashcards) ? studySet.flashcards.length : 0,
      rawQuiz: Array.isArray(studySet?.quiz) ? studySet.quiz.length : 0,
      normalizedFlashcards: flashcards.length,
    });

    if (flashcards.length === 0) {
      return res.status(422).json({
        error: "No flashcards generated from PDF",
        quiz: Array.isArray(studySet?.quiz) ? studySet.quiz : [],
      });
    }

    const existingQ = await pool.query(
      `SELECT card_front, card_back
       FROM card
       WHERE deck_id = $1`,
      [deckId]
    );
    const existingSignatures = existingQ.rows.map((r) =>
      buildCardSignature(r.card_front, r.card_back)
    );

    const insertedCards = [];
    let skippedDuplicates = 0;
    for (const card of flashcards) {
      const front = String(card.front ?? "").trim();
      const back = String(card.back ?? "").trim();
      if (!front || !back) {
        continue;
      }

      const signature = buildCardSignature(front, back);
      if (isLikelyDuplicateCard(signature, existingSignatures)) {
        skippedDuplicates++;
        continue;
      }
      existingSignatures.push(signature);

      const q = await pool.query(
        `INSERT INTO card (
           deck_id, card_front, card_back, created_at,
           ease_factor, interval_days, repetitions, due_date, last_reviewed
         )
         VALUES ($1, $2, $3, now(), 2.5, 0, 0, now(), null)
         RETURNING id, deck_id, card_front, card_back, created_at,
                   ease_factor, interval_days, repetitions, due_date, last_reviewed`,
        [deckId, front, back]
      );
      insertedCards.push(q.rows[0]);
    }

    let removedDuplicates = 0;
    try {
      // Cleanup pass for duplicates created by older imports before dedupe logic improved.
      removedDuplicates = await removeDuplicateCardsInDeck(deckId);
    } catch (cleanupErr) {
      console.error("PDF dedupe cleanup failed", cleanupErr);
    }

    console.log("PDF import insert summary", {
      deckId,
      inserted: insertedCards.length,
      skippedDuplicates,
      removedDuplicates,
    });

    return res.json({
      flashcards: { inserted: insertedCards.length, skippedDuplicates, removedDuplicates },
      insertedCards,
      quiz: Array.isArray(studySet?.quiz) ? studySet.quiz : [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Failed to import PDF",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  } finally {
    try {
      await fs.unlink(file.path);
    } catch (_) {}
  }
});

function ratingToQuality(rating) {
  // map your UI buttons to SM-2 quality 0..5
  switch (rating) {
    case "again": return 1; // fail
    case "hard":  return 3;
    case "good":  return 4;
    case "easy":  return 5;
    default:      return null;
  }
}

app.post("/api/cards/:id/rate", async (req, res) => {
  const id = Number(req.params.id);
  const rating = req.body?.rating;

  const quality = ratingToQuality(rating);
  if (!Number.isFinite(id) || quality === null) {
    return res.status(400).json({ error: "Invalid card id or rating" });
  }

  try {
    // updateCardDb updates the DB; we then return the updated full card row
    await updateCardDb(pool, id, quality);

    const updated = await pool.query(
      `SELECT id, deck_id, card_front, card_back, created_at,
              ease_factor, interval_days, repetitions, due_date, last_reviewed
       FROM card
       WHERE id = $1`,
      [id]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.patch("/api/cards/:id", async (req, res) => {
  const id = Number(req.params.id);
  const c = req.body ?? {};

  try {
    const q = await pool.query(
      `UPDATE card
       SET card_front = $1,
           card_back = $2,
           ease_factor = $3,
           interval_days = $4,
           repetitions = $5,
           due_date = $6,
           last_reviewed = $7
       WHERE id = $8
       RETURNING id, deck_id, card_front, card_back, created_at,
                 ease_factor, interval_days, repetitions, due_date, last_reviewed`,
      [
        c.card_front,
        c.card_back,
        c.ease_factor,
        c.interval_days,
        c.repetitions,
        c.due_date,
        c.last_reviewed,
        id,
      ]
    );

    if (q.rowCount === 0) return res.status(404).json({ error: "Card not found" });
    res.json(q.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.delete("/api/cards/:id", async (req, res) => {
  const id = Number(req.params.id);

  try {
    await pool.query(`DELETE FROM card WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/decks", authenticate, async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT id, user_id, deck_name, subject, course_number, instructor, created_at
       FROM deck
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.user_id]
    );
    res.json(q.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/api/decks", authenticate, async (req, res) => {
  const { deck_name, subject, course_number, instructor } = req.body ?? {};

  if (!deck_name || typeof deck_name !== "string") {
    return res.status(400).json({ error: "deck_name is required" });
  }

  try {
    const q = await pool.query(
      `INSERT INTO deck (user_id, deck_name, subject, course_number, instructor)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, deck_name, subject, course_number, instructor, created_at`,
      [
        req.user.user_id,
        deck_name,
        subject ?? null,
        course_number ?? null,
        instructor ?? null,
      ]
    );

    res.status(201).json(q.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.delete("/api/decks/:id", authenticate, async (req, res) => {
  const deckId = Number(req.params.id);
  if (!Number.isFinite(deckId)) {
    return res.status(400).json({ error: "Invalid deck id" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ownerQ = await client.query(
      `SELECT id
       FROM deck
       WHERE id = $1 AND user_id = $2`,
      [deckId, req.user.user_id]
    );

    if (ownerQ.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Deck not found" });
    }

    await client.query(`DELETE FROM card WHERE deck_id = $1`, [deckId]);
    await client.query(`DELETE FROM deck WHERE id = $1`, [deckId]);

    await client.query("COMMIT");
    return res.json({ ok: true, deletedDeckId: deckId });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    return res.status(500).json({ error: "Database error" });
  } finally {
    client.release();
  }
});

/* istanbul ignore next */
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}

module.exports = app;