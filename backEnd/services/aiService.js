/**
 * AI service: orchestrates PDF → study materials via ai_client.
 * Handles file paths and delegates to the Python script.
 */
const path = require('path');
const fs = require('fs').promises;
const { generateFromPdf } = require('../ai_client');

/**
 * Generate flashcards and quiz from an uploaded PDF file.
 *
 * @param {string} pdfPath - Absolute path to the PDF (e.g. from multer)
 * @returns {Promise<{ flashcards, quiz }>}
 */
async function generateStudyMaterialsFromPdf(pdfPath) {
  const resolved = path.resolve(pdfPath);
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) {
    throw new Error('Path is not a file');
  }
  return generateFromPdf(resolved);
}

module.exports = { generateStudyMaterialsFromPdf };
