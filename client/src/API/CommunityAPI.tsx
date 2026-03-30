import type { PublicDeckRow, PublicDeckWithCards } from "../types/CommunityTypes"


async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function getPublicDecks(search = ""): Promise<PublicDeckRow[]> {
  const params = new URLSearchParams();

  if (search.trim()) {
    params.set("search", search.trim());
  }

  const query = params.toString();
  const path = query ? `/api/community/decks?${query}` : `/api/community/decks`;

  return api<PublicDeckRow[]>(path);
}

export async function getPublicDeckWithCards(
  publicDeckId: number
): Promise<PublicDeckWithCards> {
  return api<PublicDeckWithCards>(`/api/community/decks/${publicDeckId}`);
}

export async function savePublicDeck(
  publicDeckId: number
): Promise<{ saved: boolean }> {
  return api<{ saved: boolean }>(`/api/community/decks/${publicDeckId}/save`, {
    method: "POST",
  });
}


export async function unsavePublicDeck(
  publicDeckId: number
): Promise<{ saved: boolean }> {
  return api<{ saved: boolean }>(`/api/community/decks/${publicDeckId}/save`, {
    method: "DELETE",
  });
}

export async function publishDeck(
  deckId: number
): Promise<{
  message: string;
  public_deck: PublicDeckRow;
  linked_cards: number;
}> {
  return api(`/api/decks/${deckId}/publish`, {
    method: "POST",
  });
}


export async function unpublishDeck(
  deckId: number
): Promise<{ unpublished: boolean }> {
  return api<{ unpublished: boolean }>(`/api/decks/${deckId}/publish`, {
    method: "DELETE",
  });
}