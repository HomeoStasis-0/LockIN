import { useMemo, useState } from "react";
import type { CardRow } from "../Types";
import { styles } from "../Styles";

function isDue(card: CardRow) {
  return card.due_date !== null && new Date(card.due_date).getTime() <= Date.now();
}

export default function ReviewView(props: {
  cards: CardRow[];
  onRate: (id: number, rating: "again" | "hard" | "good" | "easy") => void;
  onEdit: (c: CardRow) => void;
}) {
  const dueCards = useMemo(() => {
    return props.cards
      .filter(isDue)
      .sort((a, b) => {
        const ta = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY;
        const tb = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY;
        return ta - tb;
      });
  }, [props.cards]);

  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);

  const current = dueCards[idx] ?? null;

  function next() {
    setShowBack(false);
    setIdx((i) => {
      const n = i + 1;
      return n >= dueCards.length ? 0 : n;
    });
  }

  if (!current) {
    return (
      <section style={styles.section}>
        <div style={styles.h2}>Review</div>
        <div style={styles.empty}>No cards due 🎉</div>
        <div style={styles.tip}>Add cards to the review pile in Learn view to practice.</div>
      </section>
    );
  }

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.h2}>Review</div>
        <div style={styles.muted}>
          {idx + 1} / {dueCards.length} due
        </div>
      </div>

      <div style={styles.reviewBox}>
        <div style={styles.reviewPrompt}>{current.card_front}</div>

        {showBack ? (
          <div style={styles.reviewAnswer}>{current.card_back}</div>
        ) : (
          <button style={styles.primaryBtn} onClick={() => setShowBack(true)}>
            Show answer
          </button>
        )}

        {showBack ? (
          <div style={styles.ratingRow}>
            <button
              style={styles.btn}
              onClick={() => {
                props.onRate(current.id, "again");
                next();
              }}
            >
              Again
            </button>
            <button
              style={styles.btn}
              onClick={() => {
                props.onRate(current.id, "hard");
                next();
              }}
            >
              Hard
            </button>
            <button
              style={styles.btn}
              onClick={() => {
                props.onRate(current.id, "good");
                next();
              }}
            >
              Good
            </button>
            <button
              style={styles.btn}
              onClick={() => {
                props.onRate(current.id, "easy");
                next();
              }}
            >
              Easy
            </button>
          </div>
        ) : null}

        <div style={styles.reviewFooter}>
          <button
            style={styles.linkBtn}
            onClick={() => props.onEdit(current)}
            title="Quick edit hook"
          >
            Edit
          </button>
          <span style={styles.muted}>
            Interval: {current.interval_days} day(s) · EF: {current.ease_factor.toFixed(2)} · Reps:{" "}
            {current.repetitions}
          </span>
        </div>
      </div>
    </section>
  );
}