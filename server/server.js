const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { updateCardDb } = require("../backEnd/spaced_repetition");

const app = express();

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

app.listen(8080, () => {
  console.log("Server started on port 8080");
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