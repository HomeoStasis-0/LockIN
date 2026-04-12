import type { PublicDeckRow } from "../types/CommunityTypes";
import { useNavigate } from "react-router-dom";

type ResultsGridProps = {
  results: PublicDeckRow[];
  loading?: boolean;
  error?: string;
  onSave?: (publicDeckId: number) => void;
  onCopy?: (publicDeckId: number) => void;
};

export default function ResultsGrid({
  results,
  loading = false,
  error = "",
  onSave,
  onCopy,
}: ResultsGridProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="mt-8 text-center text-slate-500">
        Loading results...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 text-center text-red-600">
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="mt-8 text-center text-slate-500">
        No public decks found.
      </div>
    );
  }

  return (
    <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {results.map((deck) => (
        <div
          key={deck.public_deck_id}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800">
              {deck.deck_name}
            </h2>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate(`/community/decks/${deck.public_deck_id}`)}
                className="rounded-xl border border-blue-300 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
              >
                View
              </button>

              <button
                onClick={() => onSave?.(deck.public_deck_id)}
                className="rounded-xl border border-blue-300 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
              >
                Bookmark
              </button>

              <button
                onClick={() => onCopy?.(deck.public_deck_id)}
                className="rounded-xl border border-blue-300 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-700">Subject:</span>{" "}
              {deck.subject ?? "—"}
            </p>

            <p>
              <span className="font-medium text-slate-700">Course Number:</span>{" "}
              {deck.course_number ?? "—"}
            </p>

            <p>
              <span className="font-medium text-slate-700">Instructor:</span>{" "}
              {deck.instructor ?? "—"}
            </p>

            <p>
              <span className="font-medium text-slate-700">Published:</span>{" "}
              {new Date(deck.deck_created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}