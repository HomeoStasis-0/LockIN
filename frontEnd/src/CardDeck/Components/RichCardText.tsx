import type React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { styles } from "../Styles";

function normalizeMathDelimiters(text: string): string {
  // Support common LaTeX delimiters from AI output in addition to $...$/$$...$$.
    const converted = text
      .replace(/\\\(([\s\S]+?)\\\)/g, "$1$")
      .replace(/\\\[([\s\S]+?)\\\]/g, "$$$1$$")
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

    const lines = converted.split("\n");
    const normalizedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      const hasMathCue = /[_^=]|\\(int|frac|sum|prod|lim|to|infty|cdot|times|le|ge|ne)\b/.test(trimmed);
      if (!hasMathCue) return line;
      if (/\$/.test(trimmed)) return line;
      return `$${trimmed}$`;
    });

    return normalizedLines.join("\n");
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
