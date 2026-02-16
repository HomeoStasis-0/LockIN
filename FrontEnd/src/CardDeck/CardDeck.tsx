import React, { useMemo, useRef, useState } from "react";

/**
 * Deck + Card UI inspired by your sketch.
 * - Learn: browse all cards, toggle in/out of review pile, edit/remove
 * - Review: spaced-repetition style prompt -> show answer -> rate
 * - Add: manual create + (optional) import placeholder
 *
 * Drop into a React + TypeScript app.
 */

// ---------- Types ----------
export type Card = {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  inReviewPile: boolean;
  // simple SRS fields
  dueAt: number; // unix ms
  intervalDays: number;
};

export type Deck = {
  id: string;
  name: string;
  subject?: string;
  course?: string;
  prof?: string;
  cards: Card[];
};

// ---------- Helpers ----------
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();

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

// ---------- Main Component ----------
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

// ---------- Subviews ----------
function LearnView(props: {
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

function ReviewView(props: {
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

function AddView(props: { onCreate: (c: Card) => void }) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  function submit() {
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) return;
    props.onCreate({
      id: "c_" + uid(),
      front: f,
      back: b,
      inReviewPile: true,
      dueAt: now(),
      intervalDays: 0,
    });
    setFront("");
    setBack("");
  }

  return (
    <section style={styles.section}>
      <div style={styles.h2}>Add</div>

      <div style={styles.addGrid}>
        <div style={styles.panel}>
          <div style={styles.h3}>Manual</div>
          <label style={styles.label}>Front</label>
          <textarea value={front} onChange={(e) => setFront(e.target.value)} style={styles.textarea} />
          <label style={styles.label}>Back</label>
          <textarea value={back} onChange={(e) => setBack(e.target.value)} style={styles.textarea} />
          <button style={styles.primaryBtn} onClick={submit}>
            Add
          </button>
        </div>

        <div style={styles.panel}>
          <div style={styles.h3}>Import notes (placeholder)</div>
          <div style={styles.muted}>
            Your sketch: upload file → AI → JSON → split processing. Hook your backend here.
          </div>
          <input ref={fileRef} type="file" style={{ display: "none" }} />
          <button style={styles.btn} onClick={() => fileRef.current?.click()}>
            Upload file
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------- Card Row + Editor ----------
function CardRow(props: {
  card: Card;
  onEdit: (c: Card) => void;
  onRemove: (id: string) => void;
  onToggleReviewPile: (id: string) => void;
  mode: "learn";
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div style={styles.cardRow}>
      {editing ? (
        <CardEditor
          initial={props.card}
          onCancel={() => setEditing(false)}
          onSave={(c) => {
            props.onEdit(c);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.cardFront}>{props.card.front}</div>
              <div style={styles.cardBack}>{props.card.back}</div>
            </div>
            <div style={styles.cardActions}>
              <label style={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={props.card.inReviewPile}
                  onChange={() => props.onToggleReviewPile(props.card.id)}
                />
                Review pile
              </label>
              <button style={styles.btn} onClick={() => setEditing(true)}>
                Edit
              </button>
              <button style={styles.dangerBtn} onClick={() => props.onRemove(props.card.id)}>
                Remove
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CardEditor(props: {
  initial: Card;
  onCancel: () => void;
  onSave: (c: Card) => void;
}) {
  const [front, setFront] = useState(props.initial.front);
  const [back, setBack] = useState(props.initial.back);

  return (
    <div>
      <div style={styles.h3}>Edit card</div>
      <label style={styles.label}>Front</label>
      <textarea value={front} onChange={(e) => setFront(e.target.value)} style={styles.textarea} />
      <label style={styles.label}>Back</label>
      <textarea value={back} onChange={(e) => setBack(e.target.value)} style={styles.textarea} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button style={styles.primaryBtn} onClick={() => props.onSave({ ...props.initial, front, back })}>
          Save
        </button>
        <button style={styles.btn} onClick={props.onCancel}>
          Cancel
        </button>
      </div>
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

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.tab,
        ...(active ? styles.tabActive : null),
      }}
    >
      {children}
    </button>
  );
}

// ---------- Styles (simple inline to keep it self-contained) ----------
const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    padding: 20,
    maxWidth: 1000,
    margin: "0 auto",
    color: "#111",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    paddingBottom: 12,
    borderBottom: "1px solid #e5e7eb",
  },
  deckTitle: { fontSize: 28, fontWeight: 800, letterSpacing: -0.3 },
  deckMeta: { fontSize: 14, opacity: 0.7, marginTop: 2 },
  statsRow: { display: "flex", gap: 10 },
  stat: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "10px 12px",
    minWidth: 88,
    textAlign: "center",
  },
  statValue: { fontSize: 18, fontWeight: 800 },
  statLabel: { fontSize: 12, opacity: 0.7 },

  tabs: { display: "flex", gap: 8, marginTop: 14 },
  tab: {
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "8px 12px",
    background: "white",
    cursor: "pointer",
    fontWeight: 600,
  },
  tabActive: {
    borderColor: "#111",
  },

  main: { marginTop: 16 },
  section: { display: "flex", flexDirection: "column", gap: 12 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  h2: { fontSize: 18, fontWeight: 800 },
  h3: { fontSize: 14, fontWeight: 800, marginBottom: 8 },
  muted: { fontSize: 12, opacity: 0.7 },

  search: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "8px 10px",
    minWidth: 240,
  },

  cardGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 10 },
  cardRow: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
  },
  cardFront: { fontSize: 14, fontWeight: 800, marginBottom: 4 },
  cardBack: { fontSize: 13, opacity: 0.85, whiteSpace: "pre-wrap" },
  cardActions: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 },
  checkbox: { fontSize: 12, display: "flex", gap: 6, alignItems: "center" },

  reviewBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  reviewPrompt: { fontSize: 20, fontWeight: 900 },
  reviewAnswer: {
    borderTop: "1px dashed #e5e7eb",
    paddingTop: 12,
    fontSize: 14,
    whiteSpace: "pre-wrap",
  },
  ratingRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  reviewFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },

  addGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  panel: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 12, background: "#fff" },
  label: { fontSize: 12, fontWeight: 700, opacity: 0.8, display: "block", marginTop: 8 },
  textarea: {
    width: "100%",
    minHeight: 72,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    resize: "vertical",
    marginTop: 6,
    fontFamily: "inherit",
  },

  btn: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "8px 10px",
    background: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  primaryBtn: {
    border: "1px solid #111",
    borderRadius: 10,
    padding: "10px 12px",
    background: "#111",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
  },
  dangerBtn: {
    border: "1px solid #ef4444",
    borderRadius: 10,
    padding: "8px 10px",
    background: "white",
    color: "#ef4444",
    cursor: "pointer",
    fontWeight: 800,
  },
  linkBtn: {
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
    fontWeight: 800,
    textDecoration: "underline",
  },

  empty: {
    border: "1px dashed #e5e7eb",
    borderRadius: 14,
    padding: 16,
    background: "#fafafa",
    fontWeight: 700,
  },
  tip: { fontSize: 12, opacity: 0.7 },
};
