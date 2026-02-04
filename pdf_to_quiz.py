import os
import json
import pdfplumber
from groq import Groq

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
    """
    Sends text to GroqCloud to generate JSON for quizzes and flashcards[cite: 42, 52].
    """
    print("Generating study materials via GroqCloud...")

    # Define the strict JSON schema for the AI to follow
    prompt = f"""
    You are an AI study assistant for the LockIN app.
    Analyze the following lecture notes and generate a study set.

    Output strictly valid JSON with no markdown formatting. The JSON must follow this structure:
    {{
      "flashcards": [
        {{ "front": "Concept/Term", "back": "Definition/Explanation" }}
      ],
      "quiz": [
        {{
          "question": "Question text here?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_answer": "Option A"
        }}
      ]
    }}

    Lecture Notes:
    {context_text}
    """

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful study assistant that outputs only valid JSON."
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            # Llama 3 is a good default for Groq, but swap to Mixtral if preferred
            model="llama3-8b-8192",
            temperature=0.5, # Lower temperature for more deterministic JSON
            response_format={"type": "json_object"}, # Ensures valid JSON output
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
            with open(output_filename, "w") as f:
                f.write(json_output)

            print(f"Success! Study set saved to {output_filename}")

            # Optional: Print a snippet to verify
            data = json.loads(json_output)
            print(f"Generated {len(data['flashcards'])} flashcards and {len(data['quiz'])} quiz questions.")

if __name__ == "__main__":
    main()