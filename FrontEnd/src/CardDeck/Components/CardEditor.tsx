import { useState } from "react";
import type { Card } from "../Types";
import { styles } from "../Styles";

export default function CardEditor(props: {
  initial: Card;
  onCancel: () => void;
  onSave: (c: Card) => void;
}) {
  const [front, setFront] = useState(props.initial.front);
  const [back, setBack] = useState(props.initial.back);

  return (
    <div>
      <div style={styles.h3}>Edit card</div>
      <label style={styles.label}>Front</label>
      <textarea value={front} onChange={(e) => setFront(e.target.value)} style={styles.textarea} />
      <label style={styles.label}>Back</label>
      <textarea value={back} onChange={(e) => setBack(e.target.value)} style={styles.textarea} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button style={styles.primaryBtn} onClick={() => props.onSave({ ...props.initial, front, back })}>
          Save
        </button>
        <button style={styles.btn} onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}