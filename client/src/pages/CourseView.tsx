import { useNavigate, useParams } from "react-router-dom";
import DeckUI from "../../../frontEnd/src/CardDeck/CardDeck";

export default function CourseView() {
  const navigate = useNavigate();
  const { id } = useParams();

  const deckId = Number(id);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 bg-white border rounded hover:bg-gray-50"
        >
          ← Back to Dashboard
        </button>
      </div>

      {!Number.isFinite(deckId) ? (
        <div style={{ color: "crimson" }}>Invalid course/deck id in URL.</div>
      ) : (
        <DeckUI deckId={deckId} />
      )}
    </div>
  );
}