import type React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { styles } from "../styles/DeckStyles";

function applyOutsideMathSpans(
  text: string,
  transform: (segment: string) => string
): string {
  const mathSpanPattern = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g;
  const isMathSpan = /^\$\$[\s\S]*\$\$$|^\$[^$\n]+\$$/;
  const segments = text.split(mathSpanPattern);
  return segments
    .map((segment) => (isMathSpan.test(segment) ? segment : transform(segment)))
    .join("");
}

function sanitizeBrokenArrowChains(text: string): string {
  // Some AI output incorrectly wraps prose sequences containing \to in $...$.
  // Convert those to plain text with unicode arrows.
  const proseArrowChain = /\$([^$]*\\+to[^$]*)\$/g;
  return text.replace(proseArrowChain, (_m, inner) => {
    const raw = String(inner ?? "");
    const maybeProse = /[A-Za-z]{3,}/.test(raw) && /\\+to/.test(raw);
    if (!maybeProse) {
      return `$${raw}$`;
    }
    return raw.replace(/\\+to/g, "→").replace(/\s+/g, " ").trim();
  });
}

function normalizeLatexCommandsOutsideMath(text: string): string {
  return text
    // Normalize common command forms like "\\mathbb R" -> "\\mathbb{R}".
    .replace(/\\(mathbb|mathcal|mathbf|mathrm)\s+([A-Za-z])/g, "\\$1{$2}")
    // \displaystyle is often emitted in inline contexts and can break readability
    // when not wrapped correctly; KaTeX does not require it for correctness here.
    .replace(/\\displaystyle\s*/g, "");
}

function looksLikeLatexDisplayLine(value: string): boolean {
  const text = String(value || "").trim();
  if (!text) return false;

  const commandMatches = text.match(/\\[A-Za-z]+/g) || [];
  const hasStructureTokens = /_[{(]|\^[{(]|\\frac|\\substack|\\mathbb/.test(text);
  const startsAsEquation = /^[=]|^(min|max|arg\s*min|arg\s*max)\b/i.test(text);
  const hasMathOperators = /[=<>]|\\le|\\ge|\\ne|\\to|\\times|\\cdot/.test(text);
  const hasMultipleBraces = (text.match(/[{}]/g) || []).length >= 4;

  return (
    (commandMatches.length >= 2 && (hasStructureTokens || startsAsEquation || hasMathOperators))
    || (commandMatches.length >= 3 && hasMultipleBraces)
  );
}

function repairMalformedDisplayMathLines(text: string): string {
  const normalized = text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Move punctuation before closing $$ outside the math block.
      const punctuationBeforeClose = trimmed.match(/^(.*?)([.,;:!?])\$\$$/);
      if (punctuationBeforeClose && !trimmed.startsWith("$$")) {
        const body = String(punctuationBeforeClose[1] || "").trim();
        const punctuation = punctuationBeforeClose[2] || "";
        if (looksLikeLatexDisplayLine(body)) {
          return `\n$$\n${body}\n$$\n${punctuation}`;
        }
      }

      if (trimmed.endsWith("$$") && !trimmed.startsWith("$$") && looksLikeLatexDisplayLine(trimmed.slice(0, -2))) {
        return `\n$$\n${trimmed.slice(0, -2).trim()}\n$$\n`;
      }

      if (trimmed.startsWith("$$") && !trimmed.endsWith("$$") && looksLikeLatexDisplayLine(trimmed.slice(2))) {
        return `\n$$\n${trimmed.slice(2).trim()}\n$$\n`;
      }

      if (!trimmed.includes("$") && looksLikeLatexDisplayLine(trimmed)) {
        return `\n$$\n${trimmed}\n$$\n`;
      }

      return line;
    })
    .join("\n");

  // Normalize accidental 3+ dollar delimiters down to canonical display delimiters.
  return normalized
    .replace(/\${3,}\s*\n/g, "$$\n")
    .replace(/\n\s*\${3,}/g, "\n$$");
}

function normalizeMathDelimiters(text: string): string {
  // Support common LaTeX delimiters from AI output in addition to $...$/$$...$$.
  const converted = text
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => `$${String(inner).trim()}$`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => `$$${String(inner).trim()}$$`)
    .replace(/∥([^∥]+)∥/g, "\\\\|$1\\\\|")
    .replace(/→/g, "\\\\to ")
    .replace(/∞/g, "\\\\infty")
    .replace(/≤/g, "\\\\le ")
    .replace(/≥/g, "\\\\ge ")
    .replace(/≠/g, "\\\\ne ")
    .replace(/×/g, "\\\\times ")
    .replace(/·/g, "\\\\cdot ")
    .replace(/∫/g, "\\\\int ");

  const withSanitizedChains = sanitizeBrokenArrowChains(converted);
  const withNormalizedCommands = applyOutsideMathSpans(withSanitizedChains, normalizeLatexCommandsOutsideMath);
  const withRepairedDisplayMath = repairMalformedDisplayMathLines(withNormalizedCommands);
  const normalizedOutsideMath = applyOutsideMathSpans(withRepairedDisplayMath, (segment) =>
    segment.replace(/\\+to/g, "→")
  );

  const hasExplicitMath = /\$|\\\(|\\\[/.test(normalizedOutsideMath);
  if (hasExplicitMath) return normalizedOutsideMath;

  // Fallback for malformed AI output: wrap only math-like token clusters,
  // not whole sentences, to avoid rendering plain text as italic math.
  const mathLike = /([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+|\^[A-Za-z0-9{}()+\-]+)+(?:\([^)]+\))?|\\(?:int|frac|sum|prod|lim|limsup|liminf|max|min|sup|inf|to|infty|cdot|times|le|ge|ne|sqrt|alpha|beta|gamma|delta|theta|lambda|pi|sigma|omega|mu|phi|psi|mathbb|mathcal|mathbf|mathrm|subset|subseteq|in|mid|forall|exists)\b(?:\s*\{[^}]+\})?(?:\s*_[{][^}]+[}]|\s*\^[{][^}]+[}]|\s*_[A-Za-z0-9]+|\s*\^[A-Za-z0-9]+)*)/g;

  return normalizedOutsideMath.replace(mathLike, (segment, _g1, offset, full) => {
    const before = offset > 0 ? full[offset - 1] : "";
    const after = offset + segment.length < full.length ? full[offset + segment.length] : "";
    if (before === "$" || after === "$") return segment;
    return `$${segment}$`;
  });
}

export default function RichCardText(props: {
  text: string;
  style?: React.CSSProperties;
}) {
  const value = normalizeMathDelimiters(String(props.text ?? ""));

  return (
    <div style={{ ...styles.richText, ...(props.style ?? {}) }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p style={{ margin: "0 0 8px 0" }}>{children}</p>,
          ul: ({ children }) => <ul style={{ margin: "0 0 8px 18px" }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: "0 0 8px 18px" }}>{children}</ol>,
          li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
          code: ({ children }) => (
            <code
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                background: "#f3f4f6",
                padding: "1px 4px",
                borderRadius: 4,
              }}
            >
              {children}
            </code>
          ),
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
