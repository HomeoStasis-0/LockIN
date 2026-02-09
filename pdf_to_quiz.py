import os
import json
import pdfplumber
from groq import Groq

from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env file

# 1. Setup Groq Client
# Ensure you set this environment variable in your terminal or .env file
# export GROQ_API_KEY='your_groq_api_key_here'
client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"),
)

def extract_text_from_pdf(pdf_path):
    """
    Parses PDF/images into texts using pdfplumber[cite: 42, 51].
    """
    print(f"Extracting text from {pdf_path}...")
    full_text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text += text + "\n"
        return full_text
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return None

def generate_study_material(context_text):
    print("Generating study materials via Groq Structured Outputs...")

    # Define the JSON Schema
    study_material_schema = {
        "type": "object",
        "properties": {
            "flashcards": {
                "type": "array",
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
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a helpful study assistant. Extract concepts and questions from the text."},
                {"role": "user", "content": f"Lecture Notes: {context_text}"}
            ],
            # Use a model that supports Structured Outputs
            model="openai/gpt-oss-120b",
            temperature=0.3,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "study_set",
                    "strict": False, # This is 'Best-effort Mode'
                    "schema": study_material_schema
                }
            },
        )

        return chat_completion.choices[0].message.content

    except Exception as e:
        print(f"Error calling Groq API: {e}")
        return None

    
def main():
    # Example usage
    pdf_file = "lecture_notes.pdf" # Replace with your actual file path

    # 1. Extract
    raw_text = extract_text_from_pdf(pdf_file)

    if raw_text:
        # 2. Generate
        json_output = generate_study_material(raw_text)

        if json_output:
            # 3. Save/Export [cite: 52]
            output_filename = "study_set.json"
            with open(output_filename, "w", encoding="utf-8") as f:
                f.write(json_output)

            print(f"Success! Study set saved to {output_filename}")

            # Optional: Print a snippet to verify
            data = json.loads(json_output)
            print(f"Generated {len(data['flashcards'])} flashcards and {len(data['quiz'])} quiz questions.")

if __name__ == "__main__":
    main()
