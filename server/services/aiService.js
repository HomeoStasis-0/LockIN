/**
 * AI service: orchestrates study materials generation via ai_client.
 * Handles multiple file types (PDF, PPTX, DOCX, TXT, etc.) and delegates to the Python script.
 */
const path = require('path');
const fs = require('fs').promises;
const { generateFromFile } = require('../utils/ai_client');

/**
 * Generate flashcards and quiz from an uploaded file.
 * Supports PDF, PPTX, DOCX, TXT, MD, CSV, JSON, RTF and other formats.
 *
 * @param {string} filePath - Absolute path to the file (e.g. from multer)
 * @returns {Promise<{ flashcards, quiz }>}
 */
async function generateStudyMaterials(filePath) {
  const resolved = path.resolve(filePath);
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) {
    throw new Error('Path is not a file');
  }
  return generateFromFile(resolved);
}

/**
 * Backward compatibility: PDF-specific function (deprecated)
 * @deprecated Use generateStudyMaterials instead
 */
async function generateStudyMaterialsFromPdf(pdfPath) {
  return generateStudyMaterials(pdfPath);
}

module.exports = { generateStudyMaterials, generateStudyMaterialsFromPdf };
