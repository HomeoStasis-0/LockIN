import { useState } from "react";
import type { Card } from "../Types";
import { styles } from "../Styles";
import CardEditor from "./CardEditor";


export default function CardRow(props: {
  card: Card;
  onEdit: (c: Card) => void;
  onRemove: (id: string) => void;
  onToggleReviewPile: (id: string) => void;
  mode: "learn";
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div style={styles.cardRow}>
      {editing ? (
        <CardEditor
          initial={props.card}
          onCancel={() => setEditing(false)}
          onSave={(c) => {
            props.onEdit(c);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.cardFront}>{props.card.front}</div>
              <div style={styles.cardBack}>{props.card.back}</div>
            </div>
            <div style={styles.cardActions}>
              <label style={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={props.card.inReviewPile}
                  onChange={() => props.onToggleReviewPile(props.card.id)}
                />
                Review pile
              </label>
              <button style={styles.btn} onClick={() => setEditing(true)}>
                Edit
              </button>
              <button style={styles.dangerBtn} onClick={() => props.onRemove(props.card.id)}>
                Remove
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}