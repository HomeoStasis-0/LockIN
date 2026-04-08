import { useParams } from "react-router-dom";
import DeckUI from "./CardDeck";
import AppShell from "../components/AppShell"

export default function CourseView() {
  const { id } = useParams();

  const deckId = Number(id);

  return (
    <AppShell pageTitle="Your Courses">
      {!Number.isFinite(deckId) ? (
        <div style={{ color: "crimson" }}>Invalid course/deck id in URL.</div>
      ) : (
        <DeckUI deckId={deckId} />
      )}
    </AppShell>
  );
}