import type { CardRow, DeckRow, DeckWithCards } from "../types/DeckTypes";

function normalizeCard(c: any) {
  return {
    ...c,
    id: Number(c.id),
    deck_id: Number(c.deck_id),
    ease_factor: Number(c.ease_factor),
    interval_days: Number(c.interval_days),
    repetitions: Number(c.repetitions),
  };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include", // needed if you use cookies
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("API error", path, res.status, text);
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// Example response shape from backend
export type DeckWithCardsResponse = {
  deck: DeckRow;
  cards: CardRow[];
};

export type ImportPdfResponse = {
  flashcards: { inserted: number; skippedDuplicates?: number };
  insertedCards: CardRow[];
  quiz: Array<{
    question: string;
    options: string[];
    correct_answer: string;
  }>;
};

export async function getDeckWithCards(deckId: number): Promise<DeckWithCards> {
  const data = await api<any>(`/api/decks/${deckId}`);

  const deck: DeckRow = {
    ...data.deck,
    id: Number(data.deck.id),
    user_id: Number(data.deck.user_id),
    course_number:
      data.deck.course_number == null ? null : Number(data.deck.course_number),
  };

  const cards: CardRow[] = (data.cards ?? []).map((c: any) => ({
    ...c,
    id: Number(c.id),
    deck_id: Number(c.deck_id),
    ease_factor: Number(c.ease_factor),
    interval_days: Number(c.interval_days),
    repetitions: Number(c.repetitions),
  }));

  return { ...deck, cards };
}

export async function createCard(input: {
  deck_id: number;
  card_front: string;
  card_back: string;
}): Promise<CardRow> {
  const c = await api<CardRow>(`/api/cards`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return normalizeCard(c);
}

export async function updateCard(card: CardRow): Promise<CardRow> {
  const c = await api<CardRow>(`/api/cards/${card.id}`, {
    method: "PATCH",
    body: JSON.stringify(card),
  });
  return normalizeCard(c);
}

export async function deleteCard(cardId: number): Promise<{ ok: true }> {
  const c = await api<{ ok: true }>(`/api/cards/${cardId}`, {
    method: "DELETE",
  });
  return c;
}

export async function rateCard(input: {
  card_id: number;
  rating: "again" | "hard" | "good" | "easy";
}): Promise<CardRow> {
  const c = await api<CardRow>(`/api/cards/${input.card_id}/rate`, {
    method: "POST",
    body: JSON.stringify({ rating: input.rating }),
  });
  return normalizeCard(c);
}

export async function importPdfToDeck(deckId: number, file: File): Promise<ImportPdfResponse> {
  const data = new FormData();
  data.append("pdf", file);

  const res = await fetch(`/api/decks/${deckId}/import-pdf`, {
    method: "POST",
    credentials: "include",
    body: data,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("API error", `/api/decks/${deckId}/import-pdf`, res.status, text);
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  const json = (await res.json()) as ImportPdfResponse;
  return {
    ...json,
    insertedCards: (json.insertedCards ?? []).map(normalizeCard),
  };
}
  export async function getSavedPublicDecks(): Promise<PublicDeckRow[]> {
    return api<PublicDeckRow[]>("/api/community/saved");
  }