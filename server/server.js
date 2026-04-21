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
const { spawn } = require("child_process");
const { sm2Update, updateCardDb } = require("./utils/spaced_repetition");
const { generateStudyMaterials, generateStudyMaterialsFromPdf } = require("./services/aiService");
const createCommunityRouter = require("./routes/community");
const nodemailer = require("nodemailer");
const crypto = require('crypto');

const app = express();
app.disable("x-powered-by");

const uploadDir = path.join(__dirname, "..", "uploads");
const extractDir = path.join(__dirname, "..", "uploads", "extracted");
const COMPRESS_FOR_IMPORT_PATH = path.join(__dirname, "python", "compress_for_import.py");

function parseEnvMb(name, fallbackMb) {
  const raw = process.env[name];
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMb * 1024 * 1024;
  }
  return Math.floor(parsed * 1024 * 1024);
}

const MAX_UPLOAD_FILE_BYTES = parseEnvMb("MAX_UPLOAD_FILE_MB", 1024); // upload hard cap
const MAX_IMPORT_PROCESSING_BYTES = parseEnvMb("MAX_IMPORT_PROCESSING_MB", 25); // compress when larger than this
const MAX_COMPRESSED_TEXT_CHARS = Number(process.env.MAX_COMPRESSED_TEXT_CHARS || 300_000);

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
  limits: { fileSize: MAX_UPLOAD_FILE_BYTES },
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

function resolvePythonBin() {
  const projectVenvPython = path.join(__dirname, "..", "venv", "bin", "python");
  const activeVenvPython = process.env.VIRTUAL_ENV
    ? path.join(process.env.VIRTUAL_ENV, "bin", "python")
    : null;

  const candidates = [
    process.env.PYTHON_BIN,
    activeVenvPython,
    projectVenvPython,
    "/app/.heroku/python/bin/python3",
    "/app/.heroku/python/bin/python",
    "/usr/bin/python3",
    "/usr/local/bin/python3",
    "python3",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!candidate.startsWith("/")) return candidate;
    try {
      require("fs").accessSync(candidate);
      return candidate;
    } catch (_) {}
  }

  return "python3";
}

async function compressOversizedFileForImport(filePath) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size <= MAX_IMPORT_PROCESSING_BYTES) {
    return { path: filePath, compressed: false, cleanup: false, originalSize: stat.size };
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file type for compression: ${ext || "unknown"}`);
  }

  const outputPath = path.join(
    path.dirname(filePath),
    `${path.basename(filePath, ext)}-compressed-${Date.now()}.txt`
  );

  const pythonBin = resolvePythonBin();
  const stderrChunks = [];

  await new Promise((resolve, reject) => {
    const py = spawn(
      pythonBin,
      [COMPRESS_FOR_IMPORT_PATH, filePath, outputPath, String(MAX_COMPRESSED_TEXT_CHARS)],
      {
        cwd: path.dirname(COMPRESS_FOR_IMPORT_PATH),
        env: { ...process.env },
        timeout: 300000,
      }
    );

    py.stderr.on("data", (chunk) => {
      stderrChunks.push(chunk.toString());
    });

    py.on("error", (err) => {
      reject(new Error(`Failed to run compression helper: ${err.message}`));
    });

    py.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Compression helper failed (${code}): ${stderrChunks.join("").trim() || "unknown error"}`));
        return;
      }
      resolve();
    });
  });

  const compressedStat = await fs.stat(outputPath);
  if (!compressedStat.isFile() || compressedStat.size === 0) {
    throw new Error("Compression helper did not produce a valid output file");
  }

  return {
    path: outputPath,
    compressed: true,
    cleanup: true,
    originalSize: stat.size,
    compressedSize: compressedStat.size,
  };
}

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
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

function hasDangerousObjectKeys(value) {
  if (!value || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some(hasDangerousObjectKeys);
  }

  for (const key of Object.keys(value)) {
    if (key === "__proto__" || key === "prototype" || key === "constructor") {
      return true;
    }
    if (hasDangerousObjectKeys(value[key])) {
      return true;
    }
  }

  return false;
}

app.use((req, res, next) => {
  if (hasDangerousObjectKeys(req.body) || hasDangerousObjectKeys(req.query) || hasDangerousObjectKeys(req.params)) {
    return res.status(400).json({ error: "Invalid request payload" });
  }
  return next();
});

function isValidUsername(value) {
  return /^[a-zA-Z0-9._-]{3,30}$/.test(String(value || ""));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function isValidLogin(value) {
  const login = String(value || "").trim();
  if (!login || login.length > 120) return false;
  return /^[a-zA-Z0-9._@+-]+$/.test(login);
}

function isValidPasswordLength(value) {
  const password = String(value || "");
  return password.length >= 8 && password.length <= 256;
}

// NOTE: production static serving moved to after API routes so API endpoints work
const connectionString = process.env.DATABASE_URL;
const dbSslMode = String(process.env.DB_SSL ?? "").toLowerCase();
const isLocalDb = /localhost|127\.0\.0\.1/i.test(connectionString ?? "");
const useDbSsl =
  dbSslMode === "true" ||
  (!isLocalDb && process.env.NODE_ENV === "production");

const pool = new Pool({
  connectionString,
  ...(useDbSsl ? { ssl: { rejectUnauthorized: false } } : {}),
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
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getConfiguredAdminEmails() {
  const envEmails = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);

  return new Set(envEmails);
}

const ADMIN_EMAILS = getConfiguredAdminEmails();

function isAdminEmail(email) {
  return ADMIN_EMAILS.has(normalizeEmail(email));
}

const generateToken = (user) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      auth_provider: user.auth_provider || "local",
      is_admin: Boolean(user.is_admin),
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
};

const googleCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 10 * 60 * 1000,
};

function getGoogleRedirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }

  return `${req.protocol}://${req.get("host")}/auth/google/callback`;
}

function getFrontendPath(req, pathName) {
  const normalizedPath = pathName.startsWith("/") ? pathName : `/${pathName}`;

  if (process.env.CLIENT_ORIGIN) {
    return `${process.env.CLIENT_ORIGIN}${normalizedPath}`;
  }

  if (process.env.NODE_ENV === "production") {
    return normalizedPath;
  }

  return `http://localhost:5173${normalizedPath}`;
}

function toUsernameBase(profile) {
  const source = profile?.preferred_username || profile?.name || profile?.email || "user";
  const cleaned = String(source)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return cleaned || "user";
}

async function findOrCreateGoogleUser(profile) {
  const email = String(profile?.email || "").toLowerCase().trim();
  if (!email) {
    throw new Error("Google account does not include an email address");
  }

  const existing = await pool.query(
    `SELECT user_id, username, email
     FROM users
     WHERE email=$1`,
    [email]
  );

  if (existing.rowCount > 0) {
    return existing.rows[0];
  }

  const base = toUsernameBase(profile);
  const generatedSecret = crypto.randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(generatedSecret, 10);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = attempt === 0 ? "" : `_${crypto.randomBytes(2).toString("hex")}`;
    const username = `${base}${suffix}`.slice(0, 30);

    try {
      const inserted = await pool.query(
        `INSERT INTO users (username, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING user_id, username, email`,
        [username, email, passwordHash]
      );
      return inserted.rows[0];
    } catch (err) {
      if (err?.code === "23505") {
        continue;
      }
      throw err;
    }
  }

  throw new Error("Failed to create user from Google profile");
}

app.get("/auth/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Google OAuth is not configured" });
  }

  const state = crypto.randomBytes(24).toString("hex");
  res.cookie("google_oauth_state", state, googleCookieOptions);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleRedirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get("/auth/google/callback", async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect(getFrontendPath(req, "/login?oauth=not_configured"));
  }

  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(getFrontendPath(req, "/login?oauth=denied"));
  }

  if (!code || !state || state !== req.cookies.google_oauth_state) {
    return res.redirect(getFrontendPath(req, "/login?oauth=state_mismatch"));
  }

  res.clearCookie("google_oauth_state", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getGoogleRedirectUri(req),
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const details = await tokenResponse.text();
      console.error("Google token exchange failed", details);
      return res.redirect(getFrontendPath(req, "/login?oauth=token_failed"));
    }

    const tokenPayload = await tokenResponse.json();
    const accessToken = tokenPayload.access_token;

    if (!accessToken) {
      return res.redirect(getFrontendPath(req, "/login?oauth=token_missing"));
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileResponse.ok) {
      const details = await profileResponse.text();
      console.error("Google userinfo failed", details);
      return res.redirect(getFrontendPath(req, "/login?oauth=profile_failed"));
    }

    const profile = await profileResponse.json();
    if (!profile.email || profile.email_verified === false) {
      return res.redirect(getFrontendPath(req, "/login?oauth=email_unverified"));
    }

    const user = await findOrCreateGoogleUser(profile);
    const token = generateToken({
      ...user,
      auth_provider: "google",
      is_admin: isAdminEmail(user.email),
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });

    return res.redirect(getFrontendPath(req, "/dashboard"));
  } catch (err) {
    console.error("Google OAuth callback error", err);
    return res.redirect(getFrontendPath(req, "/login?oauth=failed"));
  }
});

// Registration
app.post("/auth/register", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: "Username must be 3-30 characters and use only letters, numbers, dot, underscore, or hyphen" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }

  if (!isValidPasswordLength(password)) {
    return res.status(400).json({ error: "Password must be between 8 and 256 characters" });
  }

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
    const token = generateToken({
      ...user,
      auth_provider: "local",
      is_admin: isAdminEmail(user.email),
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false
    });

    res.json({
      ...user,
      auth_provider: "local",
      is_admin: isAdminEmail(user.email),
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({
      error: "Username or email already exists"
    });
  }
});

// Login with username or email
app.post("/auth/login", async (req, res) => {
  const login = String(req.body?.login || "").trim();
  const password = String(req.body?.password || "");

  if (!isValidLogin(login)) {
    return res.status(400).json({ error: "Invalid login format" });
  }

  if (password.length === 0 || password.length > 256) {
    return res.status(400).json({ error: "Invalid password format" });
  }

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

  const token = generateToken({
    ...user,
    auth_provider: "local",
    is_admin: isAdminEmail(user.email),
  });

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false
  });

  res.json({
    user_id: user.user_id,
    username: user.username,
    email: user.email,
    auth_provider: "local",
    is_admin: isAdminEmail(user.email),
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

function clampProgress(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num <= 0) return 0;
  if (num >= 100) return 100;
  return Math.round(num);
}

function hasOcrRuntimeIssue(errors = []) {
  return Array.isArray(errors)
    && errors.some((m) => {
      const msg = String(m || "");
      return msg.includes("OCR_UNAVAILABLE") || msg.includes("tesseract binary not found");
    });
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

  res.json({
    ...result.rows[0],
    auth_provider: req.user.auth_provider || "local",
    is_admin: Boolean(req.user.is_admin),
  });
});

// Logout
app.post("/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

app.patch("/auth/username", authenticate, async (req, res) => {
  const username = String(req.body?.username || "").trim();

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: "Username must be 3-30 characters and use only letters, numbers, dot, underscore, or hyphen" });
  }

  try {
    const updateQ = await pool.query(
      `UPDATE users
       SET username = $1
       WHERE user_id = $2
       RETURNING user_id, username, email`,
      [username, req.user.user_id]
    );

    if (updateQ.rowCount === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    const authProvider = req.user.auth_provider || "local";
    const updatedUser = updateQ.rows[0];
    const token = generateToken({
      ...updatedUser,
      auth_provider: authProvider,
      is_admin: isAdminEmail(updatedUser.email),
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });

    return res.json({
      ...updatedUser,
      auth_provider: authProvider,
      is_admin: isAdminEmail(updatedUser.email),
    });
  } catch (err) {
    if (err && err.code === "23505") {
      return res.status(409).json({ error: "Username already exists" });
    }
    console.error("PATCH /auth/username error:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

app.patch("/auth/password", authenticate, async (req, res) => {
  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;

  if (req.user.auth_provider === "google") {
    return res.status(400).json({
      error: "Google-authenticated accounts must set an initial password first",
      code: "INITIAL_PASSWORD_REQUIRED",
    });
  }

  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return res.status(400).json({ error: "currentPassword is required" });
  }

  if (typeof newPassword !== "string" || newPassword.length === 0) {
    return res.status(400).json({ error: "newPassword is required" });
  }

  if (!isValidPasswordLength(newPassword)) {
    return res.status(400).json({ error: "newPassword must be between 8 and 256 characters long" });
  }

  try {
    const userQ = await pool.query(
      `SELECT user_id, password_hash
       FROM users
       WHERE user_id = $1`,
      [req.user.user_id]
    );

    if (userQ.rowCount === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    const user = userQ.rows[0];
    const currentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

    if (!currentPasswordValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateQ = await pool.query(
      `UPDATE users
       SET password_hash = $1
       WHERE user_id = $2
       RETURNING user_id`,
      [hashedPassword, req.user.user_id]
    );

    if (updateQ.rowCount === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("PATCH /auth/password error:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

app.patch("/auth/password/set-initial", authenticate, async (req, res) => {
  const newPassword = req.body?.newPassword;

  if (req.user.auth_provider !== "google") {
    return res.status(400).json({ error: "Initial password setup is only available for Google-authenticated sessions" });
  }

  if (typeof newPassword !== "string" || newPassword.length === 0) {
    return res.status(400).json({ error: "newPassword is required" });
  }

  if (!isValidPasswordLength(newPassword)) {
    return res.status(400).json({ error: "newPassword must be between 8 and 256 characters long" });
  }

  try {
    const userQ = await pool.query(
      `SELECT user_id, username, email
       FROM users
       WHERE user_id = $1`,
      [req.user.user_id]
    );

    if (userQ.rowCount === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateQ = await pool.query(
      `UPDATE users
       SET password_hash = $1
       WHERE user_id = $2
       RETURNING user_id, username, email`,
      [hashedPassword, req.user.user_id]
    );

    if (updateQ.rowCount === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    const updatedUser = updateQ.rows[0];
    const token = generateToken({
      ...updatedUser,
      auth_provider: "local",
      is_admin: isAdminEmail(updatedUser.email),
    });

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });

    return res.json({
      ...updatedUser,
      auth_provider: "local",
      is_admin: isAdminEmail(updatedUser.email),
    });
  } catch (err) {
    console.error("PATCH /auth/password/set-initial error:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

app.delete("/auth/account", authenticate, async (req, res) => {
  const confirmation = req.body?.confirmation;

  if (typeof confirmation !== "string" || confirmation.length === 0) {
    return res.status(400).json({ error: "confirmation is required" });
  }

  if (confirmation !== req.user.username) {
    return res.status(400).json({ error: "Confirmation does not match username" });
  }

  try {
    const deleteQ = await pool.query(
      `DELETE FROM users
       WHERE user_id = $1
       RETURNING user_id`,
      [req.user.user_id]
    );

    if (deleteQ.rowCount === 0) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.clearCookie("token");
    return res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("DELETE /auth/account error:", err);
    return res.status(500).json({ error: "Database error" });
  }
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

const importJobs = new Map();
const IMPORT_JOB_TTL_MS = 1000 * 60 * 60; // 1 hour

function pruneImportJobs() {
  const now = Date.now();
  for (const [jobId, job] of importJobs.entries()) {
    const doneAt = job.completedAt ? Date.parse(job.completedAt) : 0;
    if (doneAt > 0 && now - doneAt > IMPORT_JOB_TTL_MS) {
      importJobs.delete(jobId);
    }
  }
}

function createImportJob({ userId, deckId, fileName }) {
  pruneImportJobs();
  const id = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
  const createdAt = new Date().toISOString();
  const job = {
    id,
    userId,
    deckId,
    fileName,
    status: "queued",
    progress: 0,
    phase: "Queued",
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    result: null,
    error: null,
  };
  importJobs.set(id, job);
  return job;
}

function setImportJobState(jobId, patch) {
  const job = importJobs.get(jobId);
  if (!job) return;

  const nextPatch = { ...patch };
  if (Object.prototype.hasOwnProperty.call(nextPatch, "progress")) {
    nextPatch.progress = clampProgress(nextPatch.progress);
  }

  const updated = {
    ...job,
    ...nextPatch,
    updatedAt: new Date().toISOString(),
  };
  importJobs.set(jobId, updated);
}

function importFailure(status, body) {
  const error = new Error(String(body?.error || body?.message || "Import failed"));
  error.importStatus = status;
  error.importBody = body;
  return error;
}

app.post("/api/decks/:id/import-pdf", authenticate, uploadFile.single("pdf"), async (req, res) => {
  const deckId = Number(req.params.id);
  const file = req.file;

  if (!Number.isFinite(deckId)) {
    return res.status(400).json({ error: "Invalid deck id" });
  }

  if (!file || !file.path) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const userId = req.user.user_id;
  const wantsAsync = String(req.query.async || "") === "1"
    || String(req.get("x-import-async") || "") === "1";

  const executeImport = async (onProgress = () => {}) => {
    let filesToProcess = [file.path];
    let tempDirs = [];
    let tempFiles = [];

    try {
      onProgress(5, "Validating deck");
      const deckQ = await pool.query(
        `SELECT id
         FROM deck
         WHERE id = $1 AND user_id = $2`,
        [deckId, userId]
      );
      if (deckQ.rowCount === 0) {
        throw importFailure(404, { error: "Deck not found" });
      }
      onProgress(10, "Preparing files");

      if (file.originalname.toLowerCase().endsWith(".zip")) {
        console.log("Processing ZIP file:", file.originalname);
        onProgress(15, "Extracting ZIP archive");
        const extractedFiles = await extractZipFile(file.path);
        if (extractedFiles.length === 0) {
          throw importFailure(422, {
            error: "No supported files found in ZIP archive",
            supportedFormats: SUPPORTED_EXTENSIONS.join(", "),
          });
        }
        filesToProcess = extractedFiles;
        tempDirs.push(path.dirname(extractedFiles[0]));
      }

      const preparedFiles = [];
      const fileCount = Math.max(1, filesToProcess.length);
      for (let index = 0; index < filesToProcess.length; index += 1) {
        const currentFilePath = filesToProcess[index];
        const prepProgress = 20 + Math.round(((index + 1) / fileCount) * 25);
        onProgress(prepProgress, `Preparing file ${index + 1}/${fileCount}`);
        const prepared = await compressOversizedFileForImport(currentFilePath);
        preparedFiles.push(prepared.path);
        if (prepared.cleanup) {
          tempFiles.push(prepared.path);
        }
        if (prepared.compressed) {
          console.log("Compressed oversized file for import", {
            source: currentFilePath,
            preparedPath: prepared.path,
            originalBytes: prepared.originalSize,
            compressedBytes: prepared.compressedSize,
          });
        }
      }

      onProgress(50, "Generating study materials");
      const studySet = await processMultipleFiles(preparedFiles);
      const flashcards = normalizeFlashcards(studySet);

      console.log("File import result", {
        deckId,
        filesProcessed: preparedFiles.length,
        rawFlashcards: Array.isArray(studySet?.flashcards) ? studySet.flashcards.length : 0,
        rawQuiz: Array.isArray(studySet?.quiz) ? studySet.quiz.length : 0,
        normalizedFlashcards: flashcards.length,
      });

      if (flashcards.length === 0) {
        const noTextError = Array.isArray(studySet?.errors)
          && studySet.errors.some((m) => String(m).includes("NO_EXTRACTABLE_TEXT"));
        const ocrRuntimeIssue = hasOcrRuntimeIssue(studySet?.errors);

        if (noTextError) {
          throw importFailure(422, {
            error: "No extractable text found in uploaded file",
            message: ocrRuntimeIssue
              ? "Scanned/image-only document detected, but OCR is not configured on the server runtime. On Heroku, add Apt buildpack and an Aptfile with tesseract packages, then redeploy."
              : "This file looks like a scanned/image-only document. Export as searchable PDF or upload a text-based file.",
            processingErrors: studySet.errors,
            quiz: Array.isArray(studySet?.quiz) ? studySet.quiz : [],
          });
        }

        throw importFailure(422, {
          error: "No flashcards generated from uploaded files",
          processingErrors: Array.isArray(studySet?.errors) ? studySet.errors : [],
          quiz: Array.isArray(studySet?.quiz) ? studySet.quiz : [],
        });
      }

      onProgress(82, "Checking duplicates");
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
      const totalCards = Math.max(1, flashcards.length);
      for (let idx = 0; idx < flashcards.length; idx += 1) {
        const card = flashcards[idx];
        const persistProgress = 82 + Math.round(((idx + 1) / totalCards) * 16);
        onProgress(persistProgress, `Saving cards ${idx + 1}/${totalCards}`);
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

      onProgress(100, "Completed");

      return {
        flashcards: { inserted: insertedCards.length, skippedDuplicates, removedDuplicates },
        insertedCards,
        quiz: Array.isArray(studySet?.quiz) ? studySet.quiz : [],
      };
    } catch (err) {
      if (err && err.importStatus && err.importBody) {
        throw err;
      }

      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      if (errMsg.includes("NO_EXTRACTABLE_TEXT")) {
        const ocrRuntimeIssue = errMsg.includes("OCR_UNAVAILABLE") || errMsg.includes("tesseract binary not found");
        throw importFailure(422, {
          error: "No extractable text found in uploaded file",
          message: ocrRuntimeIssue
            ? "Scanned/image-only document detected, but OCR is not configured on the server runtime. On Heroku, add Apt buildpack and an Aptfile with tesseract packages, then redeploy."
            : "This file looks like a scanned/image-only document. Export as searchable PDF or upload a text-based file.",
        });
      }

      throw importFailure(500, {
        error: "Failed to import file(s)",
        message: errMsg,
      });
    } finally {
      try {
        await fs.unlink(file.path);
      } catch (_) {}

      for (const dir of tempDirs) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch (_) {}
      }

      for (const tempFile of tempFiles) {
        try {
          await fs.unlink(tempFile);
        } catch (_) {}
      }
    }
  };

  if (!wantsAsync) {
    try {
      const payload = await executeImport();
      return res.json(payload);
    } catch (err) {
      if (err && err.importStatus && err.importBody) {
        return res.status(err.importStatus).json(err.importBody);
      }
      return res.status(500).json({ error: "Failed to import file(s)", message: "Unknown error" });
    }
  }

  const job = createImportJob({ userId, deckId, fileName: file.originalname || file.filename || "upload" });

  setImmediate(async () => {
    const updateProgress = (progress, phase) => {
      setImportJobState(job.id, {
        status: "running",
        progress,
        phase,
      });
    };
    updateProgress(2, "Queued");
    try {
      const result = await executeImport(updateProgress);
      setImportJobState(job.id, {
        status: "succeeded",
        progress: 100,
        phase: "Completed",
        result,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      const status = err && err.importStatus ? err.importStatus : 500;
      const body = err && err.importBody
        ? err.importBody
        : { error: "Failed to import file(s)", message: err instanceof Error ? err.message : "Unknown error" };
      setImportJobState(job.id, {
        status: "failed",
        progress: 100,
        phase: "Failed",
        error: {
          status,
          ...body,
        },
        completedAt: new Date().toISOString(),
      });
    }
  });

  return res.status(202).json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    phase: job.phase,
  });
});

app.get("/api/decks/import-jobs/:jobId", authenticate, async (req, res) => {
  pruneImportJobs();
  const job = importJobs.get(req.params.jobId);

  if (!job || job.userId !== req.user.user_id) {
    return res.status(404).json({ error: "Import job not found" });
  }

  return res.json({
    jobId: job.id,
    deckId: job.deckId,
    fileName: job.fileName,
    status: job.status,
    progress: job.progress,
    phase: job.phase,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    result: job.status === "succeeded" ? job.result : undefined,
    error: job.status === "failed" ? job.error : undefined,
  });
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
    const isAdmin = Boolean(req.user.is_admin);
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
      WHERE ($1::boolean = true OR d.user_id = $2)
      ORDER BY d.created_at DESC
      `,
      [isAdmin, req.user.user_id]
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

  if (String(deck_name).trim().length > 120) {
    return res.status(400).json({ error: "deck_name is too long (max 120 chars)" });
  }

  if (subject != null && String(subject).length > 80) {
    return res.status(400).json({ error: "subject is too long (max 80 chars)" });
  }

  if (instructor != null && String(instructor).length > 120) {
    return res.status(400).json({ error: "instructor is too long (max 120 chars)" });
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

app.patch("/api/decks/:id", authenticate, async (req, res) => {
  const deckId = Number(req.params.id);
  if (!Number.isFinite(deckId)) {
    return res.status(400).json({ error: "Invalid deck id" });
  }

  const {
    deck_name,
    subject = null,
    course_number = null,
    instructor = null,
  } = req.body ?? {};

  if (!deck_name || typeof deck_name !== "string" || !deck_name.trim()) {
    return res.status(400).json({ error: "deck_name is required" });
  }

  if (String(deck_name).trim().length > 120) {
    return res.status(400).json({ error: "deck_name is too long (max 120 chars)" });
  }

  if (subject != null && String(subject).length > 80) {
    return res.status(400).json({ error: "subject is too long (max 80 chars)" });
  }

  if (instructor != null && String(instructor).length > 120) {
    return res.status(400).json({ error: "instructor is too long (max 120 chars)" });
  }

  if (course_number != null && !Number.isFinite(Number(course_number))) {
    return res.status(400).json({ error: "course_number must be a number or null" });
  }

  try {
    const isAdmin = Boolean(req.user.is_admin);
    const q = await pool.query(
      `UPDATE deck
       SET deck_name = $1,
           subject = $2,
           course_number = $3,
           instructor = $4
       WHERE id = $5 AND ($7::boolean = true OR user_id = $6)
       RETURNING id, user_id, deck_name, subject, course_number, instructor, created_at`,
      [
        deck_name.trim(),
        subject ?? null,
        course_number == null ? null : Number(course_number),
        instructor ?? null,
        deckId,
        req.user.user_id,
        isAdmin,
      ]
    );

    if (q.rowCount === 0) {
      return res.status(404).json({ error: "Deck not found" });
    }

    return res.json(q.rows[0]);
  } catch (err) {
    console.error("PATCH /api/decks/:id error:", err);
    return res.status(500).json({ error: "Database error" });
  }
});


app.delete("/api/decks/:id", authenticate, async (req, res) => {
  const deckId = Number(req.params.id);
  if (!Number.isFinite(deckId)) {
    return res.status(400).json({ error: "Invalid deck id" });
  }

  const client = await pool.connect();
  try {
    const isAdmin = Boolean(req.user.is_admin);
    await client.query("BEGIN");

    const ownerQ = await client.query(
      `SELECT id
       FROM deck
       WHERE id = $1 AND ($3::boolean = true OR user_id = $2)`,
      [deckId, req.user.user_id, isAdmin]
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
    const isAdmin = Boolean(req.user.is_admin);
    const deckQ = await pool.query(
      `
      SELECT id, user_id
      FROM deck
      WHERE id = $1 AND ($3::boolean = true OR user_id = $2)
      `,
      [deckId, req.user.user_id, isAdmin]
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
    const isAdmin = Boolean(req.user.is_admin);
    const deckQ = await pool.query(
      `
      SELECT id, user_id
      FROM deck
      WHERE id = $1 AND ($3::boolean = true OR user_id = $2)
      `,
      [deckId, req.user.user_id, isAdmin]
    );

    if (deckQ.rowCount === 0) {
      return res.status(404).json({ error: "Deck not found or not owned by user" });
    }

    const deleteQ = await pool.query(
      `
      DELETE FROM public_deck
      WHERE deck_id = $1 AND ($3::boolean = true OR user_id = $2)
      RETURNING id
      `,
      [deckId, req.user.user_id, isAdmin]
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

app.post("/api/public-cards/:id/rate", authenticate, async (req, res) => {
  const id = Number(req.params.id);
  const rating = req.body?.rating;

  const quality = ratingToQuality(rating);
  if (!Number.isFinite(id) || quality === null) {
    return res.status(400).json({ error: "Invalid public card id or rating" });
  }

  try {
    const currentQ = await pool.query(
      `
      SELECT id, user_id, public_deck_id, card_id, ease_factor, repetitions, interval_days
      FROM user_public_card
      WHERE id = $1 AND user_id = $2
      `,
      [id, req.user.user_id]
    );

    if (currentQ.rowCount === 0) {
      return res.status(404).json({ error: "Public card not found" });
    }

    const row = currentQ.rows[0];

    const updates = sm2Update(
      {
        ease_factor: Number(row.ease_factor),
        repetitions: Number(row.repetitions),
        interval_days: Number(row.interval_days),
      },
      quality
    );

    const updatedQ = await pool.query(
      `
      UPDATE user_public_card
      SET
        ease_factor = $1,
        repetitions = $2,
        interval_days = $3,
        due_date = $4,
        last_reviewed = $5
      WHERE id = $6
      RETURNING
        id,
        user_id,
        public_deck_id,
        card_id,
        ease_factor,
        repetitions,
        interval_days,
        due_date,
        last_reviewed
      `,
      [
        updates.ease_factor,
        updates.repetitions,
        updates.interval_days,
        updates.due_date,
        updates.last_reviewed,
        id,
      ]
    );

    res.json(updatedQ.rows[0]);
  } catch (err) {
    console.error("POST /api/public-cards/:id/rate error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.patch("/api/public-cards/:id/toggle-review", authenticate, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Invalid public card id" });
  }

  try {
    const currentQ = await pool.query(
      `
      SELECT id, user_id, public_deck_id, card_id, due_date, last_reviewed
      FROM user_public_card
      WHERE id = $1 AND user_id = $2
      `,
      [id, req.user.user_id]
    );

    if (currentQ.rowCount === 0) {
      return res.status(404).json({ error: "Public card not found" });
    }

    const updatedQ = await pool.query(
      `
      UPDATE user_public_card
      SET
        due_date = CASE WHEN due_date IS NULL THEN NOW() ELSE NULL END,
        last_reviewed = CASE WHEN due_date IS NULL THEN last_reviewed ELSE NULL END
      WHERE id = $1
      RETURNING
        id,
        user_id,
        public_deck_id,
        card_id,
        ease_factor,
        interval_days,
        repetitions,
        due_date,
        last_reviewed
      `,
      [id]
    );

    res.json(updatedQ.rows[0]);
  } catch (err) {
    console.error("PATCH /api/public-cards/:id/toggle-review error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/bookmarked/:id", authenticate, async (req, res) => {
  const publicDeckId = Number(req.params.id);

  if (!Number.isFinite(publicDeckId)) {
    return res.status(400).json({ error: "Invalid public deck id" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Confirm the current user has actually bookmarked this deck
    const deckQ = await client.query(
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
        true AS is_saved
      FROM user_public_deck upd
      JOIN public_deck pd
        ON pd.id = upd.public_deck_id
      JOIN deck d
        ON d.id = pd.deck_id
      WHERE upd.user_id = $1
        AND pd.id = $2
      `,
      [req.user.user_id, publicDeckId]
    );

    if (deckQ.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Bookmarked deck not found" });
    }

    const deck = deckQ.rows[0];

    // Backfill missing user_public_card rows for any new author cards
    await client.query(
      `
      INSERT INTO user_public_card (user_id, public_deck_id, card_id)
      SELECT
        $1,
        $2,
        c.id
      FROM card c
      WHERE c.deck_id = $3
        AND NOT EXISTS (
          SELECT 1
          FROM user_public_card upc
          WHERE upc.user_id = $1
            AND upc.public_deck_id = $2
            AND upc.card_id = c.id
        )
      `,
      [req.user.user_id, publicDeckId, deck.deck_id]
    );

    // Return bookmarker's personal review rows joined with shared card content
    const cardsQ = await client.query(
      `
      SELECT
        upc.id,
        upc.public_deck_id,
        upc.card_id,
        c.card_front,
        c.card_back,
        upc.ease_factor,
        upc.interval_days,
        upc.repetitions,
        upc.due_date,
        upc.last_reviewed
      FROM user_public_card upc
      JOIN card c
        ON c.id = upc.card_id
      WHERE upc.user_id = $1
        AND upc.public_deck_id = $2
      ORDER BY upc.id
      `,
      [req.user.user_id, publicDeckId]
    );

    await client.query("COMMIT");

    res.json({
      ...deck,
      cards: cardsQ.rows,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("GET /api/bookmarked/:id error:", err);
    res.status(500).json({ error: "Database error" });
  } finally {
    client.release();
  }
});

// #############################################
// #############################################

module.exports = app;

