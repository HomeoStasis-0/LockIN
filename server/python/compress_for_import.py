import os
import sys

from file_processor import extract_text_from_file, clean_extracted_text


def compress_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text

    head_len = int(max_chars * 0.7)
    tail_len = max_chars - head_len
    head = text[:head_len].rstrip()
    tail = text[-tail_len:].lstrip() if tail_len > 0 else ""

    marker = "\n\n[TRUNCATED FOR SIZE]\n\n"
    combined = f"{head}{marker}{tail}" if tail else head
    return combined[:max_chars]


def main() -> int:
    if len(sys.argv) < 3:
        print(
            "Usage: python compress_for_import.py <input_file> <output_file> [max_chars]",
            file=sys.stderr,
        )
        return 1

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    max_chars = int(sys.argv[3]) if len(sys.argv) > 3 else 2_000_000

    if max_chars < 1000:
        print("max_chars must be at least 1000", file=sys.stderr)
        return 1

    text = extract_text_from_file(input_file)
    if not text or not str(text).strip():
        print("NO_EXTRACTABLE_TEXT: unable to extract text for compression", file=sys.stderr)
        return 2

    text = clean_extracted_text(text)
    compressed = compress_text(text, max_chars)

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(compressed)

    print(
        f"Compressed import input from {len(text)} to {len(compressed)} characters",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())