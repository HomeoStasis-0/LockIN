/**
 * AI client for LockIN backend.
 * Spawns the Python file_processor.py script to extract text from various file formats
 * and generate flashcards + quiz questions via Groq.
 *
 * @module ai_client
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/** Path to file_processor.py (project root) */
const FILE_PROCESSOR_PATH = path.join(__dirname, "..", "python", "file_processor.py");

function resolvePythonBin() {
  const candidates = [
    process.env.PYTHON_BIN,
    '/usr/local/bin/python3',
    '/opt/homebrew/bin/python3',
    'python3',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!candidate.startsWith('/')) return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }

  return 'python3';
}

const PYTHON_BIN = resolvePythonBin();

/**
 * Generate study materials (flashcards + quiz) from a file.
 * Supports PDF, PPTX, DOCX, TXT, MD, CSV, JSON, RTF and other text-based formats.
 *
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<{ flashcards: Array<{front,back}>, quiz: Array<{question,options,correct_answer}> }>}
 * @throws {Error} If Python fails or output is invalid
 */
async function generateFromFile(filePath) {
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON_BIN, [FILE_PROCESSOR_PATH, filePath], {
      cwd: path.dirname(FILE_PROCESSOR_PATH),
      env: { ...process.env },
      timeout: 300000, // 5 minutes
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    py.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    py.on('close', (code) => {
      if (code !== 0) {
        const details = String(stderr || '').trim();
        if (details.includes('NO_EXTRACTABLE_TEXT')) {
          reject(new Error('NO_EXTRACTABLE_TEXT: Uploaded file has no extractable text (likely scanned/image-only).'));
          return;
        }
        reject(new Error(`file_processor.py exited ${code}: ${details || 'Unknown error'}`));
        return;
      }
      try {
        const data = JSON.parse(stdout.trim());
        if (!data.flashcards || !data.quiz) {
          reject(new Error('Invalid output: missing flashcards or quiz'));
          return;
        }
        resolve(data);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${e.message}`));
      }
    });

    py.on('error', (err) => {
      reject(new Error(`Failed to spawn Python: ${err.message}`));
    });
  });
}

/**
 * Backward compatibility: PDF-specific function (deprecated)
 * @deprecated Use generateFromFile instead
 */
async function generateFromPdf(pdfPath) {
  return generateFromFile(pdfPath);
}

module.exports = { generateFromFile, generateFromPdf };
