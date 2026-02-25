import { useMemo, useState } from "react";
import { styles } from "./Styles";
import type { Card, Deck } from "./Types";
import LearnView from "./Views/LearnView";
import ReviewView from "./Views/ReviewView";
import AddView from "./Views/AddView";
import { uid, now } from "./Utils";
import TabButton from "./Components/TabButton";


function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function computeNextInterval(
  currentDays: number,
  rating: "again" | "hard" | "good" | "easy"
): number {
  // intentionally simple + predictable
  // you can swap this for SM-2 later
  if (rating === "again") return 0;
  if (rating === "hard") return clamp(Math.max(1, Math.round(currentDays * 1.2)), 1, 365);
  if (rating === "good") return clamp(Math.max(2, Math.round(currentDays * 2)), 2, 365);
  return clamp(Math.max(4, Math.round(currentDays * 3)), 4, 365);
}

function computeDueAt(intervalDays: number) {
  const ms = intervalDays * 24 * 60 * 60 * 1000;
  return now() + ms;
}

export default function DeckUI() {
  const [deck, setDeck] = useState<Deck>(() => ({
    id: "deck_" + uid(),
    name: "CSCE 120",
    subject: "Data Structures",
    course: "CSCE 120",
    prof: "",
    cards: [
      {
        id: "c_" + uid(),
        front: "What is a pointer?",
        back: "A pointer stores the memory address of another value.",
        tags: ["basics"],
        inReviewPile: true,
        dueAt: now(),
        intervalDays: 0,
      },
      {
        id: "c_" + uid(),
        front: "Stack vs Heap?",
        back: "Stack: automatic storage (LIFO frames). Heap: dynamic allocation, manual/free/GC.",
        tags: ["memory"],
        inReviewPile: false,
        dueAt: now(),
        intervalDays: 0,
      },
    ],
  }));

  const [tab, setTab] = useState<"learn" | "review" | "add">("learn");

  // derived stats
  const stats = useMemo(() => {
    const total = deck.cards.length;
    const inReview = deck.cards.filter((c) => c.inReviewPile).length;
    const due = deck.cards.filter((c) => c.inReviewPile && c.dueAt <= now()).length;
    return { total, inReview, due };
  }, [deck.cards]);

  // CRUD actions
  function upsertCard(card: Card) {
    setDeck((d) => ({
      ...d,
      cards: d.cards.some((c) => c.id === card.id)
        ? d.cards.map((c) => (c.id === card.id ? card : c))
        : [card, ...d.cards],
    }));
  }

  function removeCard(id: string) {
    setDeck((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== id) }));
  }

  function toggleReviewPile(id: string) {
    setDeck((d) => ({
      ...d,
      cards: d.cards.map((c) =>
        c.id === id
          ? {
              ...c,
              inReviewPile: !c.inReviewPile,
              // if newly added to review, make due now for immediate practice
              dueAt: !c.inReviewPile ? now() : c.dueAt,
            }
          : c
      ),
    }));
  }

  function rateCard(id: string, rating: "again" | "hard" | "good" | "easy") {
    setDeck((d) => ({
      ...d,
      cards: d.cards.map((c) => {
        if (c.id !== id) return c;
        const next = computeNextInterval(c.intervalDays, rating);
        return {
          ...c,
          intervalDays: next,
          dueAt: rating === "again" ? now() : computeDueAt(next),
          inReviewPile: true,
        };
      }),
    }));
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.deckTitle}>{deck.name}</div>
          <div style={styles.deckMeta}>
            {deck.subject ? <span>{deck.subject}</span> : null}
            {deck.subject && deck.course ? <span style={{ opacity: 0.6 }}> · </span> : null}
            {deck.course ? <span>{deck.course}</span> : null}
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

        {tab === "add" ? <AddView onCreate={upsertCard} /> : null}
      </main>
    </div>
  );
}

// ---------- UI Bits ----------
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

