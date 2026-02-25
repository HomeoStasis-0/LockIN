import { useRef, useState } from "react";
import type { CardRow } from "../Types";
import { styles } from "../Styles";

export default function AddView(props: {
  deckId: number;
  makeCard: (front: string, back: string) => CardRow;
  onCreate: (c: CardRow) => void;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  function submit() {
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) return;

    const card = props.makeCard(f, b);
    props.onCreate(card);

    setFront("");
    setBack("");
  }

  return (
    <section style={styles.section}>
      <div style={styles.h2}>Add</div>

      <div style={styles.addGrid}>
        <div style={styles.panel}>
          <div style={styles.h3}>Manual</div>
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
          <div style={styles.h3}>Import notes (placeholder)</div>
          <div style={styles.muted}>
            Your sketch: upload file → AI → JSON → split processing. Hook your backend here.
          </div>
          <input ref={fileRef} type="file" style={{ display: "none" }} />
          <button style={styles.btn} onClick={() => fileRef.current?.click()}>
            Upload file
          </button>
        </div>
      </div>
    </section>
  );
}