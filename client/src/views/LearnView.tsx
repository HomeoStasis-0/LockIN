import { useEffect, useMemo, useState } from "react";
import type { CardRow } from "../types/DeckTypes";
import { styles } from "../styles/DeckStyles";
import CardRowView from "../components/CardRow";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 3;

export default function LearnView(props: {
  cards: CardRow[];
  onEdit: (c: CardRow) => void;
  onRemove: (id: number) => void;
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

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.h2}>Cards (show all)</div>
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
              <CardRowView
                key={c.id}
                card={c}
                onEdit={props.onEdit}
                onRemove={props.onRemove}
                onToggleReviewPile={props.onToggleReviewPile}
                mode="learn"
              />
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
        Review pile is currently derived from whether <code>due_date</code> is null or not.
      </div>
    </section>
  );
}