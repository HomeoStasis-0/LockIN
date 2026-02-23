const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config(); // for .env variables
const bcrypt = require("bcryptjs"); // for password_hash
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();

const corsOptions = {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true 
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
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

// ######### Authentication routes #########
// #########################################

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

// #########################################
// #########################################

// ######### Deck and card routes ##########
// #########################################

// Get user decks
app.get("/api/decks", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM deck
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch decks" });
  }
});

// Create new deck
app.post("/api/decks", authenticate, async (req, res) => {
  const { deck_name, subject, course_number, instructor } = req.body;

  if (!deck_name) {
    return res.status(400).json({ error: "Deck name required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO deck (user_id, deck_name, subject, course_number, instructor)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        req.user.user_id,
        deck_name,
        subject,
        course_number,
        instructor,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create deck" });
  }
});

// Get cards in deck
app.get("/api/decks/:deckId/cards", authenticate, async (req, res) => {
  const { deckId } = req.params;

  try {
    const result = await pool.query(
      `SELECT *
       FROM card
       WHERE deck_id = $1
       ORDER BY created_at ASC`,
      [deckId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch cards" });
  }
});

// Add card manually
app.post("/api/decks/:deckId/cards", authenticate, async (req, res) => {
  const { deckId } = req.params;
  const { card_front, card_back } = req.body;

  if (!card_front || !card_back) {
    return res.status(400).json({ error: "Front and back required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO card (deck_id, card_front, card_back)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [deckId, card_front, card_back]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add card" });
  }
});

app.listen(8080, () => {
  console.log("Server started on port 8080");
});