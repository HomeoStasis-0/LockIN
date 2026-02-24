import { useMemo, useState } from "react";
import type { Card } from "../Types";
import { styles } from "../Styles";
import { now } from "../Utils";

export default function ReviewView(props: {
  cards: Card[];
  onRate: (id: string, rating: "again" | "hard" | "good" | "easy") => void;
  onEdit: (c: Card) => void;
}) {
  const dueCards = useMemo(() => {
    return props.cards
      .filter((c) => c.inReviewPile && c.dueAt <= now())
      .sort((a, b) => a.dueAt - b.dueAt);
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
        <div style={styles.muted}>{idx + 1} / {dueCards.length} due</div>
      </div>

      <div style={styles.reviewBox}>
        <div style={styles.reviewPrompt}>{current.front}</div>

        {showBack ? (
          <div style={styles.reviewAnswer}>{current.back}</div>
        ) : (
          <button style={styles.primaryBtn} onClick={() => setShowBack(true)}>
            Show answer
          </button>
        )}

        {showBack ? (
          <div style={styles.ratingRow}>
            <button style={styles.btn} onClick={() => { props.onRate(current.id, "again"); next(); }}>
              Again
            </button>
            <button style={styles.btn} onClick={() => { props.onRate(current.id, "hard"); next(); }}>
              Hard
            </button>
            <button style={styles.btn} onClick={() => { props.onRate(current.id, "good"); next(); }}>
              Good
            </button>
            <button style={styles.btn} onClick={() => { props.onRate(current.id, "easy"); next(); }}>
              Easy
            </button>
          </div>
        ) : null}

        <div style={styles.reviewFooter}>
          <button
            style={styles.linkBtn}
            onClick={() => props.onEdit({ ...current, front: current.front, back: current.back })}
            title="Edit from Learn view for better UX; placeholder hook here"
          >
            Edit
          </button>
          <span style={styles.muted}>Interval: {current.intervalDays} day(s)</span>
        </div>
      </div>
    </section>
  );
}