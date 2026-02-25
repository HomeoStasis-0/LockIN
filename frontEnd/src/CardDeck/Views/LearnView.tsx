import { useMemo, useState } from "react";
import type { CardRow } from "../Types";
import { styles } from "../Styles";
import CardRowView from "../Components/CardRow";

export default function LearnView(props: {
  cards: CardRow[];
  onEdit: (c: CardRow) => void;
  onRemove: (id: number) => void;
  onToggleReviewPile: (id: number) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.cards;

    return props.cards.filter(
      (c) =>
        c.card_front.toLowerCase().includes(q) ||
        c.card_back.toLowerCase().includes(q)
    );
  }, [props.cards, query]);

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

      <div style={styles.cardGrid}>
        {filtered.map((c) => (
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

      <div style={styles.tip}>
        Review pile is currently derived from whether <code>due_date</code> is null or not.
      </div>
    </section>
  );
}