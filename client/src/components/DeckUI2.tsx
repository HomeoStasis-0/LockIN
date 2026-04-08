import { useEffect, useMemo, useState } from "react";
import type { PublicDeckCardRow, PublicDeckWithCards } from "../types/CommunityTypes";
import LearnView2 from "../views/LearnView2";
import ReviewView2 from "../views/ReviewView2";
import { getBookmarkedDeckWithCards, ratePublicCard, togglePublicCardReviewPile } from "../API/CommunityAPI";
import { styles } from "../styles/DeckStyles";
import TabButton from "../components/TabButton";

function isInReviewPile(card: PublicDeckCardRow) {
  return card.due_date !== null;
}

function isDue(card: PublicDeckCardRow) {
  return card.due_date !== null && new Date(card.due_date).getTime() <= Date.now();
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

export default function DeckUI2({ deckId }: { deckId: number }) {
  const [deck, setDeck] = useState<PublicDeckWithCards | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"learn" | "review">("learn");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        if (!Number.isFinite(deckId)) {
          throw new Error("Invalid deck id in URL");
        }

        const data = await getBookmarkedDeckWithCards(deckId);

        if (!cancelled) {
          setDeck(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load deck");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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

  async function handleRateCard(
    id: number,
    rating: "again" | "hard" | "good" | "easy"
    ) {
    const updated = await ratePublicCard(id, rating);

    setDeck((prev) =>
        prev
        ? {
            ...prev,
            cards: prev.cards.map((card) =>
                card.id === updated.id
                ? {
                    ...card,
                    ease_factor: updated.ease_factor,
                    interval_days: updated.interval_days,
                    repetitions: updated.repetitions,
                    due_date: updated.due_date,
                    last_reviewed: updated.last_reviewed,
                    }
                : card
            ),
            }
        : prev
    );
    }

  async function handleToggleReviewPile(id: number) {
    const updated = await togglePublicCardReviewPile(id);

    setDeck((prev) =>
        prev
        ? {
            ...prev,
            cards: prev.cards.map((card) =>
                card.id === updated.id
                ? {
                    ...card,
                    due_date: updated.due_date,
                    last_reviewed: updated.last_reviewed,
                    }
                : card
            ),
            }
        : prev
    );
    }

  if (loading) {
    return <div style={styles.page}>Loading deck...</div>;
  }

  if (error) {
    return <div style={styles.page}>Error: {error}</div>;
  }

  if (!deck) {
    return <div style={styles.page}>Deck not found.</div>;
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.deckTitle}>{deck.deck_name}</div>
          <div style={styles.deckMeta}>
            {deck.subject ? <span>{deck.subject}</span> : null}
            {deck.subject && deck.course_number != null ? (
              <span style={{ opacity: 0.6 }}> · </span>
            ) : null}
            {deck.course_number != null ? <span>{deck.course_number}</span> : null}
            {deck.instructor ? (
              <span style={{ opacity: 0.6 }}> · {deck.instructor}</span>
            ) : null}
          </div>
        </div>

        <div style={styles.statsRow}>
          <Stat label="Cards" value={stats.total} />
          <Stat label="In review" value={stats.inReview} />
          <Stat label="Due" value={stats.due} />
        </div>
      </header>

      <nav style={styles.tabs}>
        <TabButton active={tab === "learn"} onClick={() => setTab("learn")}>
          Learn
        </TabButton>
        <TabButton active={tab === "review"} onClick={() => setTab("review")}>
          Review ({stats.due})
        </TabButton>
      </nav>

      <main style={styles.main}>
            {tab === "learn" ? (
            <LearnView2 cards={deck.cards} onToggleReviewPile={handleToggleReviewPile} />
            ) : (
            <ReviewView2 cards={deck.cards} onRate={handleRateCard} />
            )}
      </main>
    </div>
  );
}