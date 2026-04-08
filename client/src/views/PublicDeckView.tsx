import { useEffect, useState } from "react";
import type { PublicDeckWithCards } from "../types/CommunityTypes";
import {
  getPublicDeckWithCards,
  savePublicDeck,
  copyPublicDeck,
} from "../API/CommunityAPI";
import PreviewDeckView from "./PreviewDeckView";

export default function PublicDeckView({ deckId }: { deckId: number }) {
  const [deck, setDeck] = useState<PublicDeckWithCards | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const data = await getPublicDeckWithCards(deckId);

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

  async function handleSave(publicDeckId: number) {
    try {
      await savePublicDeck(publicDeckId);
      alert("Deck bookmarked");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to bookmark deck");
    }
  }

  async function handleCopy(publicDeckId: number) {
    try {
      await copyPublicDeck(publicDeckId);
      alert("Deck copied");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to copy deck");
    }
  }

  if (loading) {
    return <div>Loading deck...</div>;
  }

  if (error) {
    return <div style={{ color: "crimson" }}>{error}</div>;
  }

  if (!deck) {
    return <div>Deck not found.</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2>{deck.deck_name}</h2>
        <div>
          {deck.subject ?? "—"}
          {deck.course_number != null ? ` · ${deck.course_number}` : ""}
        </div>
      </div>

      <PreviewDeckView
        cards={deck.cards}
        onSave={() => handleSave(deck.public_deck_id)}
        onCopy={() => handleCopy(deck.public_deck_id)}
      />
    </div>
  );
}