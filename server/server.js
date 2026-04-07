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
const extractZip = require("extract-zip");
const { updateCardDb } = require("./utils/spaced_repetition");
const { generateStudyMaterials, generateStudyMaterialsFromPdf } = require("./services/aiService");
const createCommunityRouter = require("./routes/community");
const nodemailer = require("nodemailer");
const crypto = require('crypto');

const app = express();

const uploadDir = path.join(__dirname, "..", "uploads");
const extractDir = path.join(__dirname, "..", "uploads", "extracted");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// Supported file extensions
const SUPPORTED_EXTENSIONS = [".pdf", ".pptx", ".docx", ".txt", ".md", ".markdown", ".csv", ".json", ".rtf", ".zip"];
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/rtf",
  "text/rtf",
]);

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
    const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${ext}`);
  },
});

const uploadFile = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || "").toLowerCase();
    const ext = path.extname(name);
    const mime = String(file.mimetype || "").toLowerCase();

    if (SUPPORTED_EXTENSIONS.includes(ext) || SUPPORTED_MIME_TYPES.has(mime)) {
      cb(null, true);
      return;
    }

    const typeLabel = ext || mime || "unknown";
    cb(new Error(`Unsupported file type: ${typeLabel}. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`));
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

// Similarity thresholds tuned to reduce duplicate paraphrases while avoiding aggressive merges.
const DEDUPE_THRESHOLDS = Object.freeze({
  highFrontJaccard: 0.7,
  highFrontOverlap: 0.9,
  minOverlapTokens: 3,
  mediumFrontOverlap: 0.62,
  lowBackJaccard: 0.18,
  lowBackOverlap: 0.25,
  lowCombinedJaccard: 0.42,
  mediumFrontJaccard: 0.58,
  mediumBackJaccard: 0.4,
  mediumCombinedJaccard: 0.56,
});

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

function toTokenSet(value, options = {}) {
  const normalized = options.isNormalized ? String(value ?? "") : normalizeCardText(value);
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
  const frontTokens = toTokenSet(frontNorm, { isNormalized: true });
  const backTokens = toTokenSet(backNorm, { isNormalized: true });

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

    if (frontSimilarity >= DEDUPE_THRESHOLDS.highFrontJaccard) {
      return true;
    }

    if (
      frontOverlap >= DEDUPE_THRESHOLDS.highFrontOverlap
      && frontOverlapCount >= DEDUPE_THRESHOLDS.minOverlapTokens
    ) {
      return true;
    }

    if (
      frontOverlap >= DEDUPE_THRESHOLDS.mediumFrontOverlap
      && (
        backSimilarity >= DEDUPE_THRESHOLDS.lowBackJaccard
        || backOverlap >= DEDUPE_THRESHOLDS.lowBackOverlap
        || combinedSimilarity >= DEDUPE_THRESHOLDS.lowCombinedJaccard
      )
    ) {
      return true;
    }

    if (
      frontSimilarity >= DEDUPE_THRESHOLDS.mediumFrontJaccard
      && (
        backSimilarity >= DEDUPE_THRESHOLDS.mediumBackJaccard
        || combinedSimilarity >= DEDUPE_THRESHOLDS.mediumCombinedJaccard
      )
    ) {
      return true;
    }
  }

  return false;
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

/**
 * Helper: Extract ZIP file and return list of extracted file paths
 */
async function extractZipFile(zipPath) {
  try {
    const zipExtractDir = path.join(extractDir, `zip-${Date.now()}`);
    await fs.mkdir(zipExtractDir, { recursive: true });
    
    await extractZip(zipPath, { dir: zipExtractDir });
    
    const files = [];
    async function walkDir(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (SUPPORTED_EXTENSIONS.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    }
    
    await walkDir(zipExtractDir);
    return files;
  } catch (err) {
    console.error("Error extracting ZIP:", err);
    throw err;
  }
}

/**
 * Helper: Process a single file and generate study materials
 */
async function processFileForStudyMaterials(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  // Keep backward compatibility for PDF imports (tests and legacy code paths).
  if (ext === ".pdf") {
    return generateStudyMaterialsFromPdf(filePath);
  }

  // Other file types are handled by the unified processor.
  return generateStudyMaterials(filePath);
}

/**
 * Helper: Process multiple files and generate study materials
 */
async function processMultipleFiles(filePaths) {
  const allFlashcards = [];
  const allQuiz = [];
  const errors = [];
  
  for (const filePath of filePaths) {
    try {
      console.log(`Processing file: ${filePath}`);
      const studySet = await processFileForStudyMaterials(filePath);
      
      if (studySet?.flashcards) {
        allFlashcards.push(...studySet.flashcards);
      }
      if (studySet?.quiz) {
        allQuiz.push(...studySet.quiz);
      }
    } catch (err) {
      console.error(`Error processing file ${filePath}:`, err);
      errors.push(err instanceof Error ? err.message : String(err));
      // Continue with other files.
    }
  }
  
  return {
    flashcards: allFlashcards,
    quiz: allQuiz,
    errors,
  };
}

app.use("/api/community", createCommunityRouter(pool, authenticate));


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

app.post("/api/decks/:id/import-pdf", authenticate, uploadFile.single("pdf"), async (req, res) => {
  const deckId = Number(req.params.id);
  const file = req.file;

  if (!Number.isFinite(deckId)) {
    return res.status(400).json({ error: "Invalid deck id" });
  }

  if (!file || !file.path) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  let filesToProcess = [file.path];
  let tempDirs = [];

  try {
    const deckQ = await pool.query(
      `SELECT id
       FROM deck
       WHERE id = $1 AND user_id = $2`,
      [deckId, req.user.user_id]
    );
    if (deckQ.rowCount === 0) {
      return res.status(404).json({ error: "Deck not found" });
    }

    // If ZIP file, extract and get list of supported files
    if (file.originalname.toLowerCase().endsWith(".zip")) {
      console.log("Processing ZIP file:", file.originalname);
      const extractedFiles = await extractZipFile(file.path);
      if (extractedFiles.length === 0) {
        return res.status(422).json({
          error: "No supported files found in ZIP archive",
          supportedFormats: SUPPORTED_EXTENSIONS.join(", "),
        });
      }
      filesToProcess = extractedFiles;
      tempDirs.push(path.dirname(extractedFiles[0]));
    }

    // Process all files
    const studySet = await processMultipleFiles(filesToProcess);
    const flashcards = normalizeFlashcards(studySet);
    
    console.log("File import result", {
      deckId,
      filesProcessed: filesToProcess.length,
      rawFlashcards: Array.isArray(studySet?.flashcards) ? studySet.flashcards.length : 0,
      rawQuiz: Array.isArray(studySet?.quiz) ? studySet.quiz.length : 0,
      normalizedFlashcards: flashcards.length,
    });

    if (flashcards.length === 0) {
      const noTextError = Array.isArray(studySet?.errors)
        && studySet.errors.some((m) => String(m).includes("NO_EXTRACTABLE_TEXT"));

      if (noTextError) {
        return res.status(422).json({
          error: "No extractable text found in uploaded file",
          message: "This file looks like a scanned/image-only document. Export as searchable PDF or upload a text-based file.",
          processingErrors: studySet.errors,
          quiz: Array.isArray(studySet?.quiz) ? studySet.quiz : [],
        });
      }

      return res.status(422).json({
        error: "No flashcards generated from uploaded files",
        processingErrors: Array.isArray(studySet?.errors) ? studySet.errors : [],
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

    const removedDuplicates = 0;

    console.log("File import insert summary", {
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
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    if (errMsg.includes("NO_EXTRACTABLE_TEXT")) {
      return res.status(422).json({
        error: "No extractable text found in uploaded file",
        message: "This file looks like a scanned/image-only document. Export as searchable PDF or upload a text-based file.",
      });
    }

    return res.status(500).json({
      error: "Failed to import file(s)",
      message: errMsg,
    });
  } finally {
    // Clean up uploaded file
    try {
      await fs.unlink(file.path);
    } catch (_) {}
    
    // Clean up extracted directories
    for (const dir of tempDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (_) {}
    }
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
    const result = await pool.query(
      `
      SELECT
        d.id,
        d.user_id,
        d.deck_name,
        d.subject,
        d.course_number,
        d.instructor,
        d.created_at,
        CASE
          WHEN pd.id IS NOT NULL THEN true
          ELSE false
        END AS is_published
      FROM deck d
      LEFT JOIN public_deck pd
        ON pd.deck_id = d.id
      WHERE d.user_id = $1
      ORDER BY d.created_at DESC
      `,
      [req.user.user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/decks error:", err);
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

// Serve the built client in production-style environments (e.g., Heroku).
const clientDistPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDistPath));

// SPA fallback: non-API routes should return index.html.
app.get(/^\/(?!api|auth).*/, (req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"), (err) => {
    if (err) {
      res.status(404).send("Client build not found. Run npm run build.");
    }
  });
});

/* istanbul ignore next */
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}

app.post("/api/decks/:id/publish", authenticate, async (req, res) => {
  const deckId = Number(req.params.id);

  if (!Number.isFinite(deckId)) {
    return res.status(400).json({ error: "Invalid deck id" });
  }

  try {
    const deckQ = await pool.query(
      `
      SELECT id, user_id
      FROM deck
      WHERE id = $1 AND user_id = $2
      `,
      [deckId, req.user.user_id]
    );

    if (deckQ.rowCount === 0) {
      return res.status(404).json({ error: "Deck not found or not owned by user" });
    }

    const publicDeckQ = await pool.query(
      `
      INSERT INTO public_deck (deck_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (deck_id) DO NOTHING
      RETURNING id, deck_id, user_id, published_at
      `,
      [deckId, req.user.user_id]
    );

    if (publicDeckQ.rowCount === 0) {
      return res.status(409).json({ error: "Deck is already public" });
    }

    res.status(201).json({
      message: "Deck made public",
      public_deck: publicDeckQ.rows[0],
    });
  } catch (err) {
    console.error("POST /api/decks/:id/publish error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.delete("/api/decks/:id/publish", authenticate, async (req, res) => {
  const deckId = Number(req.params.id);

  if (!Number.isFinite(deckId)) {
    return res.status(400).json({ error: "Invalid deck id" });
  }

  try {
    const deckQ = await pool.query(
      `
      SELECT id, user_id
      FROM deck
      WHERE id = $1 AND user_id = $2
      `,
      [deckId, req.user.user_id]
    );

    if (deckQ.rowCount === 0) {
      return res.status(404).json({ error: "Deck not found or not owned by user" });
    }

    const deleteQ = await pool.query(
      `
      DELETE FROM public_deck
      WHERE deck_id = $1 AND user_id = $2
      RETURNING id
      `,
      [deckId, req.user.user_id]
    );

    if (deleteQ.rowCount === 0) {
      return res.status(404).json({ error: "Public deck not found" });
    }

    res.json({ unpublished: true });
  } catch (err) {
    console.error("DELETE /api/decks/:id/publish error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// get bookmarked decks
app.get("/api/saved", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        upd.id AS saved_id,
        upd.user_id AS saved_by_user_id,
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
        true AS is_saved
      FROM user_public_deck upd
      JOIN public_deck pd
        ON pd.id = upd.public_deck_id
      JOIN deck d
        ON d.id = pd.deck_id
      LEFT JOIN card c
        ON c.deck_id = d.id
      WHERE upd.user_id = $1
      GROUP BY
        upd.id,
        upd.user_id,
        pd.id,
        pd.deck_id,
        pd.user_id,
        pd.published_at,
        d.id
      ORDER BY pd.published_at DESC
      `,
      [req.user.user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/saved error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// delete bookmark deck and cards
app.delete("/api/saved/:id", authenticate, async (req, res) => {
  const publicDeckId = Number(req.params.id);

  if (!Number.isFinite(publicDeckId)) {
    return res.status(400).json({ error: "Invalid public deck id" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const savedQ = await client.query(
      `
      SELECT id
      FROM user_public_deck
      WHERE user_id = $1 AND public_deck_id = $2
      `,
      [req.user.user_id, publicDeckId]
    );

    if (savedQ.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Saved deck not found" });
    }

    const deleteCardsQ = await client.query(
      `
      DELETE FROM user_public_card
      WHERE user_id = $1 AND public_deck_id = $2
      RETURNING id
      `,
      [req.user.user_id, publicDeckId]
    );

    await client.query(
      `
      DELETE FROM user_public_deck
      WHERE user_id = $1 AND public_deck_id = $2
      `,
      [req.user.user_id, publicDeckId]
    );

    await client.query("COMMIT");

    res.json({
      saved: false,
      removed_cards: deleteCardsQ.rowCount,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("DELETE /api/saved/:id error:", err);
    res.status(500).json({ error: "Database error" });
  } finally {
    client.release();
  }
});

// ######### FORGOT PASSWORD ENDPOINTS #########
// #############################################
app.post("/auth/forgot-password", async (req, res) => {
  const { login } = req.body ?? {};
  if (!login) return res.status(400).json({ error: "login required" });
 
  try {
    const result = await pool.query(
      `SELECT user_id, email FROM users WHERE username = $1 OR email = $1`,
      [login]
    );
 
    // Always return 200 — never reveal whether the account exists
    if (!result.rows.length) {
      return res.json({ ok: true });
    }
 
    const user = result.rows[0];
 
    // 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
 
    // Store hashed so plain text isn't sitting in the DB
    const hashedCode = await bcrypt.hash(code, 8);
 
    await pool.query(
      `UPDATE users
       SET reset_code = $1, reset_code_expires = $2
       WHERE user_id = $3`,
      [hashedCode, expiresAt, user.user_id]
    );
 
    await transporter.sendMail({
      from: `"LockIN" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: "Your password reset code",
      html: `
        <div style="font-family: sans-serif; max-width: 420px; margin: auto; padding: 2rem;">
          <h2 style="color: #4f46e5; margin-bottom: 0.5rem;">Password Reset</h2>
          <p style="color: #374151;">
            Use the code below to reset your password.
            It expires in <strong>15 minutes</strong>.
          </p>
          <div style="
            font-size: 2.5rem;
            font-weight: bold;
            letter-spacing: 0.4em;
            text-align: center;
            background: #eef2ff;
            color: #4338ca;
            padding: 1.25rem;
            border-radius: 12px;
            margin: 1.5rem 0;
          ">
            ${code}
          </div>
          <p style="color: #6b7280; font-size: 0.875rem;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });
 
    res.json({ ok: true });
  } catch (err) {
    console.error("forgot-password error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});
 
app.post("/auth/reset-password", async (req, res) => {
  const { login, code, newPassword } = req.body ?? {};
 
  if (!login || !code || !newPassword) {
    return res.status(400).json({ error: "login, code, and newPassword are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
 
  try {
    const result = await pool.query(
      `SELECT user_id, reset_code, reset_code_expires
       FROM users
       WHERE username = $1 OR email = $1`,
      [login]
    );
 
    const user = result.rows[0];
    const invalid = () => res.status(400).json({ error: "Invalid or expired code." });
 
    if (!user || !user.reset_code || !user.reset_code_expires) return invalid();
    if (new Date() > new Date(user.reset_code_expires)) return invalid();
 
    const codeMatches = await bcrypt.compare(code, user.reset_code);
    if (!codeMatches) return invalid();
 
    const hashedPassword = await bcrypt.hash(newPassword, 10);
 
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           reset_code = NULL,
           reset_code_expires = NULL
       WHERE user_id = $2`,
      [hashedPassword, user.user_id]
    );
 
    res.json({ ok: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("reset-password error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});
// #############################################
// #############################################

module.exports = app;