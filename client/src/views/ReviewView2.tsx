import { useEffect, useMemo, useState } from "react";
import type { PublicDeckCardRow } from "../types/CommunityTypes";
import { styles } from "../styles/DeckStyles";
import RichCardText from "../components/RichCardText";

function isDue(card: PublicDeckCardRow) {
  return card.due_date !== null && new Date(card.due_date).getTime() <= Date.now();
}

export default function ReviewView2(props: {
  cards: PublicDeckCardRow[];
  onRate: (id: number, rating: "again" | "hard" | "good" | "easy") => Promise<void> | void;
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
  const [isRating, setIsRating] = useState(false);

  useEffect(() => {
    setIdx((i) => {
      if (dueCards.length === 0) return 0;
      return Math.min(i, dueCards.length - 1);
    });
  }, [dueCards.length]);

  const current = dueCards[idx] ?? null;

  async function handleRate(rating: "again" | "hard" | "good" | "easy") {
    if (!current || isRating) return;

    setIsRating(true);
    try {
      await props.onRate(current.id, rating);
      setShowBack(false);
    } finally {
      setIsRating(false);
    }
  }

  if (!current) {
    return (
      <section style={styles.section}>
        <div style={styles.h2}>Review</div>
        <div style={styles.empty}>No bookmarked cards are due right now 🎉</div>
        <div style={styles.tip}>
          Bookmarked decks keep their own review progress, so your study schedule stays separate from the
          original author’s deck.
        </div>
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
        <RichCardText text={current.card_front} style={styles.reviewPrompt} />

        {showBack ? (
          <RichCardText text={current.card_back} style={styles.reviewAnswer} />
        ) : (
          <button style={styles.primaryBtn} onClick={() => setShowBack(true)}>
            Show answer
          </button>
        )}

        {showBack ? (
          <div style={styles.ratingRow}>
            <button
              style={styles.btn}
              onClick={() => handleRate("again")}
              disabled={isRating}
            >
              Again
            </button>
            <button
              style={styles.btn}
              onClick={() => handleRate("hard")}
              disabled={isRating}
            >
              Hard
            </button>
            <button
              style={styles.btn}
              onClick={() => handleRate("good")}
              disabled={isRating}
            >
              Good
            </button>
            <button
              style={styles.btn}
              onClick={() => handleRate("easy")}
              disabled={isRating}
            >
              Easy
            </button>
          </div>
        ) : null}

        <div style={styles.reviewFooter}>
          <span style={styles.muted}>
            Interval: {current.interval_days} day(s) · EF: {current.ease_factor.toFixed(2)} · Reps:{" "}
            {current.repetitions}
          </span>
        </div>
      </div>
    </section>
  );
}