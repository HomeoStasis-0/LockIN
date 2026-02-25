import { useState } from "react";
import type { CardRow as CardRowType } from "../Types";
import { styles } from "../Styles";
import CardEditor from "./CardEditor";

function isInReviewPile(card: CardRowType) {
  return card.due_date !== null;
}

export default function CardRow(props: {
  card: CardRowType;
  onEdit: (c: CardRowType) => void;
  onRemove: (id: number) => void;
  onToggleReviewPile: (id: number) => void;
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.cardFront}>{props.card.card_front}</div>
            <div style={styles.cardBack}>{props.card.card_back}</div>
            <div style={styles.muted}>
              Interval: {props.card.interval_days} day(s) · Reps: {props.card.repetitions}
            </div>
          </div>

          <div style={styles.cardActions}>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={isInReviewPile(props.card)}
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
      )}
    </div>
  );
}