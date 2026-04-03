import AppShell from "../components/AppShell"
import { useNavigate, useParams } from "react-router-dom"

export default function BookmarkedView() {
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <AppShell pageTitle={id ? `Bookmarked #${id}` : "Bookmarked"}>
        <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 bg-white border rounded hover:bg-gray-50"
            >
            ← Back to Dashboard
            </button>
        </div>
        </AppShell>
    );
}
