import type { DeckRow, CardRow, DeckWithCards } from "../../../frontEnd/src/CardDeck/Types"; // probably should move this type to a more shared location

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include", // cookie auth
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text}`);
  return text ? (JSON.parse(text) as T) : (null as T);
}

function normalizeDeck(d: any): DeckRow {
  return {
    ...d,
    id: Number(d.id),
    user_id: Number(d.user_id),
    course_number: d.course_number == null ? null : Number(d.course_number),
  };
}

function normalizeCard(c: any): CardRow {
  return {
    ...c,
    id: Number(c.id),
    deck_id: Number(c.deck_id),
    ease_factor: Number(c.ease_factor),
    interval_days: Number(c.interval_days),
    repetitions: Number(c.repetitions),
    due_date: c.due_date == null || c.due_date === "" || c.due_date === "null" ? null : String(c.due_date),
    last_reviewed: c.last_reviewed == null || c.last_reviewed === "" || c.last_reviewed === "null" ? null : String(c.last_reviewed),
  };
}

// ---------- DECKS ----------
export async function listDecks(): Promise<DeckRow[]> {
  const rows = await api<any[]>(`/api/decks`);
  return (rows ?? []).map(normalizeDeck);
}

export async function createDeck(input: {
  deck_name: string;
  subject?: string | null;
  course_number?: number | null;
  instructor?: string | null;
}): Promise<DeckRow> {
  const row = await api<any>(`/api/decks`, {
    method: "POST",
    body: JSON.stringify({
      deck_name: input.deck_name,
      subject: input.subject ?? null,
      course_number: input.course_number ?? null,
      instructor: input.instructor ?? null,
    }),
  });
  return normalizeDeck(row);
}

// ---------- DECK + CARDS ----------
export async function getDeckWithCards(deckId: number): Promise<DeckWithCards> {
  const data = await api<any>(`/api/decks/${deckId}`);
  return {
    ...normalizeDeck(data.deck),
    cards: (data.cards ?? []).map(normalizeCard),
  };
}

// ---------- CARDS ----------
export async function createCard(input: {
  deck_id: number;
  card_front: string;
  card_back: string;
}): Promise<CardRow> {
  const row = await api<any>(`/api/cards`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return normalizeCard(row);
}

export async function updateCard(card: CardRow): Promise<CardRow> {
  const row = await api<any>(`/api/cards/${card.id}`, {
    method: "PATCH",
    body: JSON.stringify(card),
  });
  return normalizeCard(row);
}

export async function deleteCard(cardId: number): Promise<{ ok: true }> {
  return api<{ ok: true }>(`/api/cards/${cardId}`, { method: "DELETE" });
}

export async function rateCard(input: {
  card_id: number;
  rating: "again" | "hard" | "good" | "easy";
}): Promise<CardRow> {
  const row = await api<any>(`/api/cards/${input.card_id}/rate`, {
    method: "POST",
    body: JSON.stringify({ rating: input.rating }),
  });
  return normalizeCard(row);
}