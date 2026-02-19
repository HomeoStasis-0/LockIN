const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config(); // for .env variables

const app = express();

const corsOptions = {
  origin: ["http://localhost:5173"],
}

app.use(cors(corsOptions));
app.use(express.json());

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

app.listen(8080, () => {
  console.log("Server started on port 8080");
});