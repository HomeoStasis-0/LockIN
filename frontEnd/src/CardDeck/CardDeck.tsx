import { useMemo, useState } from "react";
import { styles } from "./Styles";
import type { CardRow, DeckWithCards } from "./Types";
import LearnView from "./Views/LearnView";
import ReviewView from "./Views/ReviewView";
import AddView from "./Views/AddView";
import TabButton from "./Components/TabButton";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function computeNextInterval(
  currentDays: number,
  rating: "again" | "hard" | "good" | "easy"
): number {
  // simple + predictable for now; can swap to SM-2 later
  if (rating === "again") return 0;
  if (rating === "hard") return clamp(Math.max(1, Math.round(currentDays * 1.2)), 1, 365);
  if (rating === "good") return clamp(Math.max(2, Math.round(currentDays * 2)), 2, 365);
  return clamp(Math.max(4, Math.round(currentDays * 3)), 4, 365);
}

function toIsoNow() {
  return new Date().toISOString();
}

function toIsoFromNow(intervalDays: number) {
  const ms = intervalDays * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

function isInReviewPile(card: CardRow) {
  return card.due_date !== null;
}

function isDue(card: CardRow) {
  return card.due_date !== null && new Date(card.due_date).getTime() <= Date.now();
}

export default function DeckUI() {
  // Temporary local IDs for new cards before backend exists
  const [nextTempCardId, setNextTempCardId] = useState(-1);

  const [deck, setDeck] = useState<DeckWithCards>(() => ({
    id: 1,
    user_id: 1,
    deck_name: "CSCE 120",
    subject: "Data Structures",
    course_number: 120,
    instructor: "",
    created_at: toIsoNow(),
    cards: [
      {
        id: 1,
        deck_id: 1,
        card_front: "What is a pointer?",
        card_back: "A pointer stores the memory address of another value.",
        created_at: toIsoNow(),
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        due_date: toIsoNow(), // in review + due now
        last_reviewed: null,
      },
      {
        id: 2,
        deck_id: 1,
        card_front: "Stack vs Heap?",
        card_back: "Stack: automatic storage (LIFO frames). Heap: dynamic allocation, manual/free/GC.",
        created_at: toIsoNow(),
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        due_date: null, // not in review pile
        last_reviewed: null,
      },
    ],
  }));

  const [tab, setTab] = useState<"learn" | "review" | "add">("learn");

  const stats = useMemo(() => {
    const total = deck.cards.length;
    const inReview = deck.cards.filter(isInReviewPile).length;
    const due = deck.cards.filter(isDue).length;
    return { total, inReview, due };
  }, [deck.cards]);

  function upsertCard(card: CardRow) {
    setDeck((d) => ({
      ...d,
      cards: d.cards.some((c) => c.id === card.id)
        ? d.cards.map((c) => (c.id === card.id ? card : c))
        : [card, ...d.cards],
    }));
  }

  function removeCard(id: number) {
    setDeck((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== id) }));
  }

  function toggleReviewPile(id: number) {
    setDeck((d) => ({
      ...d,
      cards: d.cards.map((c) => {
        if (c.id !== id) return c;

        const currentlyInReview = isInReviewPile(c);
        return {
          ...c,
          // If adding to review pile, make due now for immediate practice.
          // If removing, set due_date null (our DB-truth representation for not in review pile).
          due_date: currentlyInReview ? null : (c.due_date ?? toIsoNow()),
        };
      }),
    }));
  }

  function rateCard(id: number, rating: "again" | "hard" | "good" | "easy") {
    setDeck((d) => ({
      ...d,
      cards: d.cards.map((c) => {
        if (c.id !== id) return c;

        const next = computeNextInterval(c.interval_days, rating);
        const currentEF = c.ease_factor ?? 2.5;

        const nextEF =
          rating === "again"
            ? Math.max(1.3, currentEF - 0.2)
            : rating === "hard"
            ? Math.max(1.3, currentEF - 0.05)
            : rating === "easy"
            ? currentEF + 0.1
            : currentEF;

        return {
          ...c,
          interval_days: next,
          due_date: rating === "again" ? toIsoNow() : toIsoFromNow(next),
          repetitions: c.repetitions + 1,
          last_reviewed: toIsoNow(),
          ease_factor: nextEF,
        };
      }),
    }));
  }

  function createLocalCard(front: string, back: string): CardRow {
    const id = nextTempCardId;
    setNextTempCardId((x) => x - 1);

    return {
      id,
      deck_id: deck.id,
      card_front: front,
      card_back: back,
      created_at: toIsoNow(),
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      due_date: toIsoNow(), // add into review by default (same behavior as before)
      last_reviewed: null,
    };
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
        <TabButton active={tab === "learn"} onClick={() => setTab("learn")}>
          Learn
        </TabButton>
        <TabButton active={tab === "review"} onClick={() => setTab("review")}>
          Review ({stats.due})
        </TabButton>
        <TabButton active={tab === "add"} onClick={() => setTab("add")}>
          Add
        </TabButton>
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
          <ReviewView cards={deck.cards} onRate={rateCard} onEdit={upsertCard} />
        ) : null}

        {tab === "add" ? (
          <AddView
            deckId={deck.id}
            makeCard={createLocalCard}
            onCreate={upsertCard}
          />
        ) : null}
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