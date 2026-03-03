/**
 * AI client for LockIN backend.
 * Spawns the Python pdf_to_quiz.py script to extract text from PDFs
 * and generate flashcards + quiz questions via Groq.
 *
 * @module ai_client
 */

const { spawn } = require('child_process');
const path = require('path');

/** Path to pdf_to_quiz.py (project root) */
const PDF_TO_QUIZ_PATH = path.join(__dirname, '..', 'pdf_to_quiz.py');

/**
 * Generate study materials (flashcards + quiz) from a PDF file.
 *
 * @param {string} pdfPath - Absolute path to the PDF file
 * @returns {Promise<{ flashcards: Array<{front,back}>, quiz: Array<{question,options,correct_answer}> }>}
 * @throws {Error} If Python fails or output is invalid
 */
async function generateFromPdf(pdfPath) {
  return new Promise((resolve, reject) => {
    const py = spawn('python', [PDF_TO_QUIZ_PATH, pdfPath], {
      cwd: path.dirname(PDF_TO_QUIZ_PATH),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    py.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pdf_to_quiz.py exited ${code}: ${stderr || 'Unknown error'}`));
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

module.exports = { generateFromPdf };
