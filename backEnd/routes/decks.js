/**
 * Deck API routes.
 * POST /api/decks/:deckId/import-pdf - Upload PDF, generate flashcards via AI, import into deck.
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const aiService = require('../services/aiService');
const deckService = require('../services/deckService');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${path.extname(file.originalname) || '.pdf'}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname || '').toLowerCase();
    if (ext.endsWith('.pdf')) return cb(null, true);
    cb(new Error('Only PDF files are allowed'));
  },
});

/**
 * POST /api/decks/:deckId/import-pdf
 * Body: multipart/form-data with field "pdf" (file)
 * Returns: { flashcards: { inserted }, quiz: [...] }
 */
router.post('/:deckId/import-pdf', upload.single('pdf'), async (req, res) => {
  const deckId = parseInt(req.params.deckId, 10);
  const file = req.file;

  if (!file || !file.path) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }

  let studySet;
  try {
    const deck = await deckService.getDeckById(deckId);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    studySet = await aiService.generateStudyMaterialsFromPdf(file.path);
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to generate study materials',
      message: err.message,
    });
  } finally {
    try {
      await fs.unlink(file.path).catch(() => {});
    } catch (_) {}
  }

  try {
    const { inserted } = await deckService.importFlashcardsIntoDeck(
      deckId,
      studySet.flashcards
    );
    return res.json({
      flashcards: { inserted },
      quiz: studySet.quiz,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to import flashcards',
      message: err.message,
    });
  }
});

module.exports = router;
