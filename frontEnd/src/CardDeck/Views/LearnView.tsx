import { useMemo, useState } from "react";
import type { Card } from "../Types";
import { styles } from "../Styles";
import CardRow from "../Components/CardRow";

export default function LearnView(props: {
  cards: Card[];
  onEdit: (c: Card) => void;
  onRemove: (id: string) => void;
  onToggleReviewPile: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return props.cards;
    return props.cards.filter(
      (c) => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)
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
          <CardRow
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
        Tip: toggling “Review pile” matches your sketch’s add/remove behavior.
      </div>
    </section>
  );
}