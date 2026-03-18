import { useMemo, useState, useEffect } from "react";
import { styles } from "./Styles";
import type { CardRow, DeckWithCards } from "./Types";
import LearnView from "./Views/LearnView";
import ReviewView from "./Views/ReviewView";
import AddView from "./Views/AddView";
import TabButton from "./Components/TabButton";
import {
  getDeckWithCards,
  createCard,
  updateCard,
  deleteCard,
  rateCard as apiRateCard,
} from "./API/DeckAPI";

function isInReviewPile(card: CardRow) {
  return card.due_date !== null;
}
function isDue(card: CardRow) {
  return card.due_date !== null && new Date(card.due_date).getTime() <= Date.now();
}

export default function DeckUI({ deckId }: { deckId: number }) {

  const [deck, setDeck] = useState<DeckWithCards | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"learn" | "review" | "add">("learn");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        if (!Number.isFinite(deckId)) {
          console.log("Invalid deck id in URL:", deckId);
          throw new Error("Invalid deck id in URL");
        }

        const data = await getDeckWithCards(deckId);
        if (!cancelled) setDeck(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load deck");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const cards = deck?.cards ?? [];
  const stats = useMemo(() => {
    const total = cards.length;
    const inReview = cards.filter(isInReviewPile).length;
    const due = cards.filter(isDue).length;
    return { total, inReview, due };
  }, [cards]);

  async function handleCreateCard(front: string, back: string) {
    if (!deck) return;

    const created = await createCard({
      deck_id: deck.id,
      card_front: front,
      card_back: back,
    });

    setDeck((d) => (d ? { ...d, cards: [created, ...d.cards] } : d));
  }

  async function upsertCard(card: CardRow) {
    const saved = await updateCard(card);
    setDeck((d) => (d ? { ...d, cards: d.cards.map((c) => (c.id === saved.id ? saved : c)) } : d));
  }

  async function removeCard(id: number) {
    await deleteCard(id);
    setDeck((d) => (d ? { ...d, cards: d.cards.filter((c) => c.id !== id) } : d));
  }

  async function toggleReviewPile(id: number) {
    if (!deck) return;
    const card = deck.cards.find((c) => c.id === id);
    if (!card) return;

    const updated: CardRow = {
      ...card,
      due_date: card.due_date ? null : new Date().toISOString(),
    };

    await upsertCard(updated);
  }

  async function handleRateCard(id: number, rating: "again" | "hard" | "good" | "easy") {
    const updated = await apiRateCard({ card_id: id, rating });
    setDeck((d) => (d ? { ...d, cards: d.cards.map((c) => (c.id === updated.id ? updated : c)) } : d));
  }

  if (loading) return <div style={styles.page}>Loading...</div>;
  if (error) return <div style={styles.page}>Error: {error}</div>;
  if (!deck) return <div style={styles.page}>No deck found.</div>;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.deckTitle}>{deck.deck_name}</div>
          <div style={styles.deckMeta}>
            {deck.subject ? <span>{deck.subject}</span> : null}
            {deck.subject && deck.course_number != null ? <span style={{ opacity: 0.6 }}> · </span> : null}
            {deck.course_number != null ? <span>CSCE {deck.course_number}</span> : null}
            {deck.instructor ? <span style={{ opacity: 0.6 }}> · {deck.instructor}</span> : null}
          </div>
        </div>

        <div style={styles.statsRow}>
          <Stat label="Cards" value={stats.total} />
          <Stat label="In review" value={stats.inReview} />
          <Stat label="Due" value={stats.due} />
        </div>
      </header>

      <nav style={styles.tabs}>
        <TabButton active={tab === "learn"} onClick={() => setTab("learn")}>Learn</TabButton>
        <TabButton active={tab === "review"} onClick={() => setTab("review")}>Review ({stats.due})</TabButton>
        <TabButton active={tab === "add"} onClick={() => setTab("add")}>Add</TabButton>
      </nav>

      <main style={styles.main}>
        {tab === "learn" ? (
          <LearnView
            cards={deck.cards}
            onEdit={upsertCard}
            onRemove={removeCard}
            onToggleReviewPile={toggleReviewPile}
          />
        ) : null}

        {tab === "review" ? (
          <ReviewView cards={deck.cards} onRate={handleRateCard} onEdit={upsertCard} />
        ) : null}

        {tab === "add" ? <AddView deckId={deck.id} onCreate={handleCreateCard} /> : null}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}