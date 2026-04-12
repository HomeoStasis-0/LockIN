import { useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import PublicDeckView from "../views/PublicDeckView";

export default function PublicDeck() {
  const { id } = useParams();
  const deckId = Number(id);

  return (
    <AppShell pageTitle="Community">
      {!Number.isFinite(deckId) ? (
        <div style={{ color: "crimson" }}>Invalid course/deck id in URL.</div>
      ) : (
        <PublicDeckView deckId={deckId} />
      )}
    </AppShell>
  );
}