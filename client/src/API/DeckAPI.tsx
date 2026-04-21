import type { PublicDeckRow } from "../types/CommunityTypes";
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

export type ImportPdfProgressHandlers = {
  onProgress?: (progress: number) => void;
  onPhase?: (phase: string) => void;
  onUploadComplete?: () => void;
};

type ImportJobStatusResponse = {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress?: number;
  phase?: string;
  result?: ImportPdfResponse;
  error?: {
    status?: number;
    error?: string;
    message?: string;
  };
};

function normalizeImportResponse(json: ImportPdfResponse): ImportPdfResponse {
  return {
    ...json,
    insertedCards: (json.insertedCards ?? []).map(normalizeCard),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function pollImportJob(jobId: string, handlers: ImportPdfProgressHandlers = {}): Promise<ImportPdfResponse> {
  const maxAttempts = 120;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const res = await fetch(`/api/decks/import-jobs/${jobId}`, {
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }

    const job = (await res.json()) as ImportJobStatusResponse;
    if (typeof job.progress === "number") {
      handlers.onProgress?.(Math.max(0, Math.min(100, Math.round(job.progress))));
    }
    if (typeof job.phase === "string" && job.phase.trim()) {
      handlers.onPhase?.(job.phase);
    }

    if (job.status === "succeeded" && job.result) {
      handlers.onProgress?.(100);
      handlers.onPhase?.("Completed");
      return normalizeImportResponse(job.result);
    }

    if (job.status === "failed") {
      throw new Error(job.error?.message || job.error?.error || "Import job failed.");
    }

    await delay(1500);
  }

  throw new Error("Import is taking longer than expected. Please try again in a moment.");
}

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

export async function importPdfToDeck(
  deckId: number,
  file: File,
  handlers: ImportPdfProgressHandlers = {}
): Promise<ImportPdfResponse> {
  const data = new FormData();
  data.append("pdf", file);

  return new Promise<ImportPdfResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/decks/${deckId}/import-pdf?async=1`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("x-import-async", "1");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      const uploadShare = Math.round((event.loaded / event.total) * 10);
      handlers.onProgress?.(uploadShare);
      handlers.onPhase?.("Uploading file");
    };

    xhr.upload.onload = () => {
      handlers.onProgress?.(10);
      handlers.onPhase?.("Upload complete");
      handlers.onUploadComplete?.();
    };

    xhr.onerror = () => {
      reject(new Error("Network error while uploading file."));
    };

    xhr.onabort = () => {
      reject(new Error("File upload was cancelled."));
    };

    xhr.onload = () => {
      const text = xhr.responseText ?? "";
      if (xhr.status < 200 || xhr.status >= 300) {
        console.error("API error", `/api/decks/${deckId}/import-pdf`, xhr.status, text);
        reject(new Error(`${xhr.status} ${xhr.statusText}: ${text}`));
        return;
      }

      try {
        if (xhr.status === 202) {
          const queued = JSON.parse(text) as { jobId?: string };
          if (!queued.jobId) {
            reject(new Error("Import job was queued but no job ID was returned."));
            return;
          }

          void pollImportJob(queued.jobId, handlers)
            .then(resolve)
            .catch(reject);
          return;
        }

        const json = JSON.parse(text) as ImportPdfResponse;
        resolve(normalizeImportResponse(json));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Failed to parse upload response."));
      }
    };

    xhr.send(data);
  });
}

export async function getSavedPublicDecks(): Promise<PublicDeckRow[]> {
  return api<PublicDeckRow[]>("/api/saved");
}
