import { useRef, useState } from "react";
import { styles } from "../styles/DeckStyles";
import type { ImportPdfProgressHandlers } from "../API/DeckAPI";

const SUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".pptx",
  ".docx",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".rtf",
  ".zip",
]);

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/rtf",
  "text/rtf",
]);

export default function AddView(props: {
  deckId: number;
  onCreate: (front: string, back: string) => Promise<void> | void;
  onImportPdf: (
    file: File,
    handlers?: ImportPdfProgressHandlers
  ) => Promise<{ inserted: number; skippedDuplicates?: number }>;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState("Preparing upload");
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function submit() {
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) return;

    await props.onCreate(f, b);
    setFront("");
    setBack("");
  }

  async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadMsg(null);
    setUploadErr(null);

    const lowerName = file.name.toLowerCase();
    const dotIndex = lowerName.lastIndexOf(".");
    const ext = dotIndex >= 0 ? lowerName.slice(dotIndex) : "";
    const mime = String(file.type || "").toLowerCase();
    const supported = SUPPORTED_EXTENSIONS.has(ext) || SUPPORTED_MIME_TYPES.has(mime);

    if (!supported) {
      setUploadErr("Unsupported file. Use PDF, PPTX, DOCX, TXT, MD, CSV, JSON, RTF, or ZIP.");
      e.target.value = "";
      return;
    }

    try {
      setIsUploading(true);
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingPhase("Uploading file");
      const result = await props.onImportPdf(file, {
        onProgress: (progress) => {
          setIsProcessing(true);
          setProcessingProgress((current) => Math.max(current, Math.round(progress)));
        },
        onPhase: (phase) => {
          setIsProcessing(true);
          setProcessingPhase(phase);
        },
        onUploadComplete: () => {
          setIsProcessing(true);
          setProcessingProgress((current) => Math.max(current, 10));
          setProcessingPhase("Processing import");
        },
      });
      setProcessingProgress(100);
      setProcessingPhase("Completed");
      setIsProcessing(false);
      const skipped = result.skippedDuplicates ?? 0;
      if (result.inserted === 0 && skipped > 0) {
        setUploadMsg(`No new flashcards added. Skipped ${skipped} duplicates from ${file.name}.`);
      } else if (skipped > 0) {
        setUploadMsg(`Imported ${result.inserted} flashcards and skipped ${skipped} duplicates from ${file.name}.`);
      } else {
        setUploadMsg(`Imported ${result.inserted} flashcards from ${file.name}.`);
      }
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Failed to import file.");
    } finally {
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      setIsUploading(false);
      setIsProcessing(false);
      setProcessingProgress(0);
      e.target.value = "";
    }
  }

  return (
    <section style={styles.section}>
      <div style={styles.h2}>Add</div>

      <div style={styles.addGrid}>
        <div style={styles.panel}>
          <div style={styles.h3}>Manual</div>
          <div style={styles.muted}>
            Supports Markdown + math (for example <code>$x^2 + y^2 = z^2$</code> or <code>\\(x^2\\)</code>).
          </div>
          <label style={styles.label}>Front</label>
          <textarea
            value={front}
            onChange={(e) => setFront(e.target.value)}
            style={styles.textarea}
          />
          <label style={styles.label}>Back</label>
          <textarea
            value={back}
            onChange={(e) => setBack(e.target.value)}
            style={styles.textarea}
          />
          <button style={styles.primaryBtn} onClick={submit}>
            Add
          </button>
        </div>

        <div style={styles.panel}>
          <div style={styles.h3}>Import from File</div>
          <div style={styles.muted}>
            Upload PDF, PPTX, DOCX, TXT, MD, CSV, JSON, RTF, or ZIP to generate flashcards.
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.pptx,.docx,.txt,.md,.markdown,.csv,.json,.rtf,.zip,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json,application/rtf,text/rtf,application/zip"
            onChange={handlePdfChange}
            style={{ display: "none" }}
          />
          <button
            style={styles.btn}
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? "Importing..." : "Upload File"}
          </button>
          {isUploading ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ ...styles.muted, marginBottom: 6 }}>
                {isProcessing ? `${processingPhase}... ${processingProgress}%` : "Uploading file..."}
              </div>
              {isProcessing ? (
                <div
                  role="progressbar"
                  aria-label="File processing progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={processingProgress}
                  style={{
                    width: "100%",
                    height: 8,
                    borderRadius: 999,
                    background: "#e5e7eb",
                    overflow: "hidden",
                    border: "1px solid #d1d5db",
                  }}
                >
                  <div
                    style={{
                      width: `${processingProgress}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: "linear-gradient(90deg, #111827 0%, #4b5563 100%)",
                      transition: "width 120ms linear",
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {uploadMsg ? <div style={{ ...styles.muted, marginTop: 10 }}>{uploadMsg}</div> : null}
          {uploadErr ? <div style={{ ...styles.muted, marginTop: 10, color: "#dc2626" }}>{uploadErr}</div> : null}
        </div>
      </div>
    </section>
  );
}