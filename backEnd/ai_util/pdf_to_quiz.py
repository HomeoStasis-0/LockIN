
import os
import json
import pdfplumber
from groq import Groq
import sys

from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env file

# 1. Setup Groq Client
# Ensure you set this environment variable in your terminal or .env file
# export GROQ_API_KEY='your_groq_api_key_here'
client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

MAX_CHARS_PER_CHUNK = 8000
MAX_CHUNKS = 4

def extract_text_from_pdf(pdf_path):
    """
    Parses PDF/images into texts using pdfplumber[cite: 42, 51].
    """
    print(f"Extracting text from {pdf_path}...", file=sys.stderr)
    full_text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n"
        print(f"Extracted {len(full_text)} characters from PDF.", file=sys.stderr)
        return full_text
    except Exception as e:
        print(f"Error reading PDF: {e}", file=sys.stderr)
        return None


def chunk_text(text, max_chars=MAX_CHARS_PER_CHUNK, max_chunks=MAX_CHUNKS):
    """Split long text into chunks to reduce truncation and improve coverage."""
    if len(text) <= max_chars:
        return [text]

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current = ""

    for para in paragraphs:
        candidate = f"{current}\n\n{para}".strip() if current else para
        if len(candidate) <= max_chars:
            current = candidate
            continue

        if current:
            chunks.append(current)
            if len(chunks) >= max_chunks:
                break

        # Handle very large single paragraphs.
        if len(para) > max_chars:
            start = 0
            while start < len(para) and len(chunks) < max_chunks:
                chunks.append(para[start:start + max_chars])
                start += max_chars
            current = ""
        else:
            current = para

    if current and len(chunks) < max_chunks:
        chunks.append(current)

    return chunks[:max_chunks]


def dedupe_study_set(study_set):
    """Deduplicate cards/questions while preserving order."""
    flashcards = []
    seen_cards = set()
    for card in study_set.get("flashcards", []):
        front = str(card.get("front", "")).strip()
        back = str(card.get("back", "")).strip()
        if not front or not back:
            continue
        key = (front, back)
        if key in seen_cards:
            continue
        seen_cards.add(key)
        flashcards.append({"front": front, "back": back})

    quiz = []
    seen_quiz = set()
    for item in study_set.get("quiz", []):
        question = str(item.get("question", "")).strip()
        options = item.get("options", [])
        correct_answer = str(item.get("correct_answer", "")).strip()
        if not question or not isinstance(options, list) or len(options) < 2 or not correct_answer:
            continue
        normalized_options = [str(o).strip() for o in options if str(o).strip()]
        key = (question, tuple(normalized_options), correct_answer)
        if key in seen_quiz:
            continue
        seen_quiz.add(key)
        quiz.append(
            {
                "question": question,
                "options": normalized_options,
                "correct_answer": correct_answer,
            }
        )

    return {"flashcards": flashcards, "quiz": quiz}


def _generate_study_material_for_chunk(context_text, chunk_index, total_chunks):
    print(
        f"Generating chunk {chunk_index + 1}/{total_chunks} via Groq Structured Outputs...",
        file=sys.stderr,
    )

    # Define the JSON Schema
    study_material_schema = {
        "type": "object",
        "properties": {
            "flashcards": {
                "type": "array",
                "minItems": 5,
                "items": {
                    "type": "object",
                    "properties": {
                        "front": {"type": "string"},
                        "back": {"type": "string"}
                    },
                    "required": ["front", "back"],
                    "additionalProperties": False
                }
            },
            "quiz": {
                "type": "array",
                "minItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "question": {"type": "string"},
                        "options": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 4,
                            "maxItems": 4
                        },
                        "correct_answer": {"type": "string"}
                    },
                    "required": ["question", "options", "correct_answer"],
                    "additionalProperties": False
                }
            }
        },
        "required": ["flashcards", "quiz"],
        "additionalProperties": False
    }

    try:
        prompt = (
            "Create concise, high-quality study materials from these notes. "
            "Cover distinct concepts and avoid duplicates. "
            "For flashcards: use clear term/question on front and precise explanation on back. "
            "For quiz: include plausible distractors and ensure correct_answer exactly matches one option.\n\n"
            f"Chunk {chunk_index + 1} of {total_chunks}.\n"
            f"Lecture Notes:\n{context_text}"
        )

        last_err = None
        for _ in range(2):
            try:
                chat_completion = client.chat.completions.create(
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a helpful study assistant. Return only schema-compliant JSON.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    model="openai/gpt-oss-120b",
                    temperature=0.0,
                    response_format={
                        "type": "json_schema",
                        "json_schema": {
                            "name": "study_set",
                            "strict": True,
                            "schema": study_material_schema,
                        },
                    },
                )
                return json.loads(chat_completion.choices[0].message.content)
            except Exception as inner:
                last_err = inner

        raise last_err if last_err else RuntimeError("Unknown Groq generation error")

    except Exception as e:
        print(f"Error calling Groq API: {e}", file=sys.stderr)
        return None


def generate_study_material(context_text):
    chunks = chunk_text(context_text)
    print(f"Processing {len(chunks)} chunk(s).", file=sys.stderr)

    merged = {"flashcards": [], "quiz": []}
    for idx, chunk in enumerate(chunks):
        result = _generate_study_material_for_chunk(chunk, idx, len(chunks))
        if not result:
            continue
        merged["flashcards"].extend(result.get("flashcards", []))
        merged["quiz"].extend(result.get("quiz", []))

    merged = dedupe_study_set(merged)
    print(
        f"Generated {len(merged['flashcards'])} flashcards and {len(merged['quiz'])} quiz items.",
        file=sys.stderr,
    )
    return json.dumps(merged)

def run_pipeline(pdf_path):
    """
    Extract text from PDF and generate study materials.
    Returns JSON string or None on failure.
    When run as CLI: accepts pdf_path as arg, prints JSON to stdout (errors to stderr).
    """
    raw_text = extract_text_from_pdf(pdf_path)
    if not raw_text:
        return None
    return generate_study_material(raw_text)


def main():
    import sys
    if len(sys.argv) < 2:
        print("Usage: python pdf_to_quiz.py <path_to_pdf>", file=sys.stderr)
        sys.exit(1)

    pdf_file = sys.argv[1]
    json_output = run_pipeline(pdf_file)

    if json_output:
        # Print JSON to stdout for Node.js to capture
        print(json_output)
    else:
        print("Error: Failed to generate study materials.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
