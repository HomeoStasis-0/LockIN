import type React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { styles } from "../styles/DeckStyles";

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

    const hasExplicitMath = /\$|\\\(|\\\[/.test(converted);
    if (hasExplicitMath) return converted;

    // Fallback for malformed AI output: wrap only math-like token clusters,
    // not whole sentences, to avoid rendering plain text as italic math.
    const mathLike = /([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+|\^[A-Za-z0-9{}()+\-]+)+(?:\([^)]+\))?|\\(?:int|frac|sum|prod|lim|to|infty|cdot|times|le|ge|ne|sqrt|alpha|beta|gamma|delta|theta|lambda|pi|sigma|omega)\b(?:\s*\{[^}]+\})?)/g;

    return converted.replace(mathLike, (segment, _g1, offset, full) => {
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
