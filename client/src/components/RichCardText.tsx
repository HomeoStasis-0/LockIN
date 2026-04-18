import type React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { styles } from "../styles/DeckStyles";

const UNICODE_LATEX_REPLACEMENTS: Array<[RegExp, string]> = [
  [/≠/g, "\\ne "],
  [/≤/g, "\\le "],
  [/≥/g, "\\ge "],
  [/≈/g, "\\approx "],
  [/∼/g, "\\sim "],
  [/±/g, "\\pm "],
  [/×/g, "\\times "],
  [/·/g, "\\cdot "],
  [/÷/g, "\\div "],
  [/∈/g, "\\in "],
  [/∉/g, "\\notin "],
  [/⊂/g, "\\subset "],
  [/⊆/g, "\\subseteq "],
  [/⊃/g, "\\supset "],
  [/⊇/g, "\\supseteq "],
  [/∩/g, "\\cap "],
  [/∪/g, "\\cup "],
  [/∧/g, "\\wedge "],
  [/∨/g, "\\vee "],
  [/∅/g, "\\emptyset "],
  [/∃/g, "\\exists "],
  [/∀/g, "\\forall "],
  [/∂/g, "\\partial "],
  [/∇/g, "\\nabla "],
  [/∞/g, "\\infty "],
  [/√/g, "\\sqrt{}"],
  [/∑/g, "\\sum "],
  [/∏/g, "\\prod "],
  [/∫/g, "\\int "],
  [/∝/g, "\\propto "],
  [/∠/g, "\\angle "],
  [/ℝ/g, "\\mathbb{R}"],
  [/ℕ/g, "\\mathbb{N}"],
  [/ℤ/g, "\\mathbb{Z}"],
  [/ℚ/g, "\\mathbb{Q}"],
  [/ℂ/g, "\\mathbb{C}"],
];

const LATEX_ENVIRONMENTS = [
  "align",
  "align*",
  "aligned",
  "alignedat",
  "array",
  "cases",
  "gather",
  "gather*",
  "matrix",
  "pmatrix",
  "bmatrix",
  "Bmatrix",
  "vmatrix",
  "Vmatrix",
  "equation",
  "equation*",
  "split",
  "multline",
  "multline*",
];

const ALIGN_LIKE_ENVIRONMENTS = new Set([
  "align",
  "align*",
  "aligned",
  "alignedat",
  "gather",
  "gather*",
  "split",
  "multline",
  "multline*",
]);

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

function replaceAllOutsideMathSpans(text: string, replacer: (segment: string) => string): string {
  return applyOutsideMathSpans(text, replacer);
}

function normalizeUnicodeMathOutsideMath(text: string): string {
  return UNICODE_LATEX_REPLACEMENTS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    text
  );
}

function isolateDisplayMathStarts(text: string): string {
  return text.replace(/([^\n])\$\$(?=\s*\\(?:begin|\[)|\s*[A-Za-z0-9\\])/g, (_match, prefix: string) => {
    return `${prefix}\n\n$$`;
  });
}

function normalizeLatexEnvironments(text: string): string {
  let normalized = text;

  for (const env of LATEX_ENVIRONMENTS) {
    const pattern = new RegExp(`\\\\begin\\{${env.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}([\\s\\S]*?)\\\\end\\{${env.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`, "g");
    normalized = normalized.replace(pattern, (_match, body) => {
      const inner = String(body).trim();
      if (ALIGN_LIKE_ENVIRONMENTS.has(env)) {
        const cleaned = inner.replace(/\s*&\s*/g, " ");
        return `$$\n${cleaned}\n$$`;
      }

      return `$$\n\\begin{${env}}\n${inner}\n\\end{${env}}\n$$`;
    });
  }

  return normalized;
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
    .replace(/\\(mathbb|mathcal|mathbf|mathrm|operatorname|text)\s+([A-Za-z0-9]+)/g, "\\$1{$2}")
    .replace(/\\sqrt\s+([A-Za-z0-9]+)/g, "\\sqrt{$1}")
    .replace(/\\(left|right)\s*([()\[\]{}|])/g, "\\$1$2")
    // \displaystyle is often emitted in inline contexts and can break readability
    // when not wrapped correctly; KaTeX does not require it for correctness here.
    .replace(/\\displaystyle\s*/g, "");
}

function looksLikeLatexDisplayLine(value: string): boolean {
  const text = String(value || "").trim();
  if (!text) return false;

  const commandMatches = text.match(/\\[A-Za-z]+/g) || [];
  const hasStructureTokens = /_[{(]|\^[{(]|\\frac|\\substack|\\mathbb|\\begin|\\end|\\left|\\right|\\sum|\\prod|\\int|\\sqrt/.test(text);
  const startsAsEquation = /^[=]|^(min|max|arg\s*min|arg\s*max)\b/i.test(text);
  const hasMathOperators = /[=<>]|\\le|\\ge|\\ne|\\to|\\times|\\cdot|\\pm|\\approx|\\sim|\\in|\\subset|\\supset|\\cup|\\cap|\\exists|\\forall/.test(text);
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
  const converted = normalizeLatexEnvironments(
    isolateDisplayMathStarts(
      text
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, inner) => `$${String(inner).trim()}$`)
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => `$$${String(inner).trim()}$$`)
    .replace(/∥([^∥]+)∥/g, "\\\\|$1\\\\|")
    .replace(/→/g, "\\\\to ")
    )
  );

  const withUnicodeMath = normalizeUnicodeMathOutsideMath(converted);
  const withSanitizedChains = sanitizeBrokenArrowChains(withUnicodeMath);
  const withNormalizedCommands = replaceAllOutsideMathSpans(withSanitizedChains, normalizeLatexCommandsOutsideMath);
  const withRepairedDisplayMath = repairMalformedDisplayMathLines(withNormalizedCommands);
  const normalizedOutsideMath = replaceAllOutsideMathSpans(withRepairedDisplayMath, (segment) =>
    segment.replace(/\\+to/g, "→")
  );

  const hasExplicitMath = /\$|\\\(|\\\[/.test(normalizedOutsideMath);
  if (hasExplicitMath) return normalizedOutsideMath;

  // Fallback for malformed AI output: wrap only math-like token clusters,
  // not whole sentences, to avoid rendering plain text as italic math.
  const mathLike = /([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+|\^[A-Za-z0-9{}()+\-]+)+(?:\([^)]+\))?|\\(?:begin|end|int|frac|sum|prod|lim|limsup|liminf|max|min|sup|inf|to|infty|cdot|times|le|ge|ne|pm|approx|sim|sqrt|alpha|beta|gamma|delta|theta|lambda|pi|sigma|omega|mu|phi|psi|mathbb|mathcal|mathbf|mathrm|operatorname|text|subset|subseteq|supset|supseteq|in|mid|forall|exists|cup|cap|wedge|vee|partial|nabla|emptyset|propto|angle)\b(?:\s*\{[^}]+\})?(?:\s*_[{][^}]+[}]|\s*\^[{][^}]+[}]|\s*_[A-Za-z0-9]+|\s*\^[A-Za-z0-9]+)*)/g;

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
