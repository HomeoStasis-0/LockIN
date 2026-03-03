import { useNavigate, useParams } from "react-router-dom";
import DeckUI from "../../../frontEnd/src/CardDeck/CardDeck";

export default function CourseView() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div style={{ padding: 20 }}>
      <DeckUI onBack={() => navigate("/dashboard")} />
    </div>
  );
}
