/**
 * AI service: orchestrates study materials generation via ai_client.
 * Handles multiple file types (PDF, PPTX, DOCX, TXT, etc.) and delegates to the Python script.
 */
const path = require('path');
const fs = require('fs').promises;
const { generateFromFile, generateFromPdf } = require('../utils/ai_client');

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
  const resolved = path.resolve(pdfPath);
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) {
    throw new Error('Path is not a file');
  }

  try {
    return await generateFromPdf(resolved);
  } catch (err) {
    // Fallback to the unified processor for PDFs the legacy script cannot parse.
    return generateFromFile(resolved);
  }
}

module.exports = { generateStudyMaterials, generateStudyMaterialsFromPdf };
