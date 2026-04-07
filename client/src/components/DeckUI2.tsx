import { useState, useEffect } from 'react'
import type { PublicDeckRow, PublicDeckCardRow , PublicDeckWithCards } from "../types/CommunityTypes"
import LearnView2 from "../views/LearnView2"
//import ReviewView2 from "../views/ReviewView2"
import { getPublicDeckWithCards } from "../API/CommunityAPI"
import { styles } from "../styles/DeckStyles"
import Stat from "../pages/CardDeck"
import TabButton from "../components/TabButton"

export default function DeckUI2({ deckId } : { deckId : number }) {

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
            console.log("Invalid deck id in URL:", deckId);
            throw new Error("Invalid deck id in URL");
        }

        const data = await getPublicDeckWithCards(deckId);
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
        </nav>
        <main style={styles.main}>
            <div style={{ display: tab === "learn" ? "block" : "none" }} aria-hidden={tab !== "learn"}>
            <LearnView2
                cards={deck.cards}
                onEdit={upsertCard}
                onRemove={removeCard}
                onToggleReviewPile={toggleReviewPile}
            />
            </div>

            <div style={{ display: tab === "review" ? "block" : "none" }} aria-hidden={tab !== "review"}>
            </div>
        </main>
        </div>
    );
}   