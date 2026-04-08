import { useEffect, useMemo, useState } from "react";
import type { PublicDeckCardRow } from "../types/CommunityTypes";
import { styles } from "../styles/DeckStyles";
import RichCardText from "../components/RichCardText";
import { ChevronLeft, ChevronRight } from "lucide-react";

function isInReviewPile(card: PublicDeckCardRow) {
  return card.due_date !== null;
}

const PAGE_SIZE = 3;

export default function LearnView2(props: {
  cards: PublicDeckCardRow[];
  onToggleReviewPile: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.cards;

    return props.cards.filter(
      (c) =>
        c.card_front.toLowerCase().includes(q) ||
        c.card_back.toLowerCase().includes(q)
    );
  }, [props.cards, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedCards = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filtered.slice(start, end);
  }, [filtered, page]);

  function goPrev() {
    setPage((prev) => Math.max(1, prev - 1));
  }

  function goNext() {
    setPage((prev) => Math.min(totalPages, prev + 1));
  }

  if (props.cards.length === 0) {
    return (
      <section style={styles.section}>
        <div style={styles.h2}>Learn</div>
        <div style={styles.empty}>This deck has no cards yet.</div>
      </section>
    );
  }

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.h2}>Cards</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cards…"
          style={styles.search}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={styles.empty}>No cards match your search.</div>
      ) : (
        <>
          <div style={{ ...styles.muted, marginBottom: 4 }}>
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </div>

          <div style={styles.cardGrid}>
            {paginatedCards.map((c) => (
              <div key={c.id} style={styles.cardRow}>
                <div style={styles.cardFront}>
                  <RichCardText text={c.card_front} style={styles.richText} />
                </div>

                <div style={{ height: 10 }} />

                <div style={styles.cardBack}>
                  <RichCardText text={c.card_back} style={styles.richText} />
                </div>

                <div style={{ marginTop: 10, ...styles.muted }}>
                  Interval: {c.interval_days} day(s) · EF: {c.ease_factor.toFixed(2)} · Reps:{" "}
                  {c.repetitions}
                </div>

                <div style={{ marginTop: 10 }}>
                  <button
                    style={styles.btn}
                    onClick={() => props.onToggleReviewPile(c.id)}
                  >
                    {isInReviewPile(c) ? "Remove from review" : "Add to review"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <button
              style={styles.btn}
              onClick={goPrev}
              disabled={page === 1}
            >
              <ChevronLeft />
            </button>

            <div style={styles.muted}>
              Page {page} of {totalPages}
            </div>

            <button
              style={styles.btn}
              onClick={goNext}
              disabled={page === totalPages}
            >
              <ChevronRight />
            </button>
          </div>
        </>
      )}

      <div style={styles.tip}>
        Bookmarked decks are read-only here. You can study and review them without editing the
        original author’s cards.
      </div>
    </section>
  );
}