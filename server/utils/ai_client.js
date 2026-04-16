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
const PDF_TO_QUIZ_PATH = path.join(__dirname, "..", "python", "pdf_to_quiz.py");

function isWindowsStylePath(candidate) {
  return typeof candidate === 'string' && (/^[A-Za-z]:[\\/]/.test(candidate) || candidate.includes('\\'));
}

function resolvePythonBin() {
  const projectVenvPythonPosix = path.join(__dirname, '..', '..', 'venv', 'bin', 'python');
  const projectVenvPythonWin = path.join(__dirname, '..', '..', 'venv', 'Scripts', 'python.exe');
  const activeVenvPythonPosix = process.env.VIRTUAL_ENV
    ? path.join(process.env.VIRTUAL_ENV, 'bin', 'python')
    : null;
  const activeVenvPythonWin = process.env.VIRTUAL_ENV
    ? path.join(process.env.VIRTUAL_ENV, 'Scripts', 'python.exe')
    : null;

  const preferPosixPython = process.platform !== 'win32';

  const candidates = [
    process.env.PYTHON_BIN,
    preferPosixPython ? activeVenvPythonPosix : activeVenvPythonWin,
    preferPosixPython ? projectVenvPythonPosix : projectVenvPythonWin,
    '/app/.heroku/python/bin/python3',
    '/app/.heroku/python/bin/python',
    '/usr/bin/python3',
    '/usr/local/bin/python3',
    '/opt/homebrew/bin/python3',
    'python',
    'python3',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (preferPosixPython && isWindowsStylePath(candidate)) {
      continue;
    }

    // Validate absolute paths, but allow command names (python/python3) for PATH lookup.
    if (path.isAbsolute(candidate)) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }
    return candidate;
  }

  return process.platform === 'win32' ? 'python' : 'python3';
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
          reject(new Error(`NO_EXTRACTABLE_TEXT: ${details}`));
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
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON_BIN, [PDF_TO_QUIZ_PATH, pdfPath], {
      cwd: path.dirname(PDF_TO_QUIZ_PATH),
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
        reject(new Error(`pdf_to_quiz.py exited ${code}: ${details || 'Unknown error'}`));
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

module.exports = { generateFromFile, generateFromPdf };
