import AppShell from "../components/AppShell"
import DeckUI2 from "../components/DeckUI2"
import { useParams } from "react-router-dom"

export default function BookmarkedView() {
    const { id }= useParams();

    const deckId = Number(id);

    return (
        <AppShell pageTitle="Bookmarked">
        {!Number.isFinite(deckId) ? (
            <div style={{ color: "crimson" }}>Invalid course/deck id in URL.</div>
        ) : (
            <DeckUI2 deckId={deckId} />
        )}
        </AppShell>
    );
}