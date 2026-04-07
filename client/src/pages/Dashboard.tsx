import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { DeckRow } from "../types/DeckTypes"; 
import type { PublicDeckRow } from "../types/CommunityTypes"
import { publishDeck, unpublishDeck } from "../API/CommunityAPI";


type CreateDeckBody = {
  deck_name: string;
  subject: string | null;
  course_number: number | null;
  instructor: string | null;
};

type DeleteDeckResponse = {
  ok: true;
  deletedDeckId: number;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include", // IMPORTANT for your cookie auth
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  return text ? (JSON.parse(text) as T) : (null as T);
}

// pg sometimes returns ids as strings depending on setup; normalize to match DB-first types
function normalizeDeck(d: any): DeckRow {
  return {
    ...d,
    id: Number(d.id),
    user_id: Number(d.user_id),
    course_number: d.course_number == null ? null : Number(d.course_number),
    is_published: Boolean(d.is_published),
  };
}

function parseCourseNumber(courseId: string): number | null {
  const m = courseId.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseSubject(courseId: string): string | null {
  const m = courseId.match(/^([A-Za-z]+)/);
  return m ? m[1].toUpperCase() : null;
}

export default function Dashboard() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  // redirect if not logged in
  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading, navigate]);

  const [decks, setDecks] = useState<DeckRow[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [deletingDeckId, setDeletingDeckId] = useState<number | null>(null);

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newId, setNewId] = useState(""); // e.g. CSCE120

  const [publishingDeckId, setPublishingDeckId] = useState<number | null>(null);
  const [publishedDeckIds, setPublishedDeckIds] = useState<Record<number, boolean>>({});

  const[bkdecks, setbkDecks] = useState<PublicDeckRow[]>([]);
  const [bkdecksLoading, setbkDecksLoading] = useState(false);
  const [bkdecksError, setbkDecksError] = useState<string | null>(null);


  // load decks once user is known
  useEffect(() => {
    if (!user) return;

    async function loadDecks() {
      try {
        setDecksLoading(true);
        setDecksError(null);

        const data = await api<any[]>(`/api/decks`);
        const normalized = (data ?? []).map(normalizeDeck);

        setDecks(normalized);
        setPublishedDeckIds(
          Object.fromEntries(
            normalized.map((deck) => [deck.id, deck.is_published])
          )
        );
      } catch (e) {
        setDecksError(e instanceof Error ? e.message : "Failed to load decks");
      } finally {
        setDecksLoading(false);
      }
    }

    async function loadbkDecks() {
      try {
        setbkDecksLoading(true);
        setbkDecksError(null);

        const data = await api<PublicDeckRow[]>("/api/saved");
        setbkDecks(data);
      } catch (e) {
        setbkDecksError(e instanceof Error ? e.message : "Failed to load bookmarked decks");
      } finally {
        setbkDecksLoading(false);
      }
    }

    loadDecks();
    loadbkDecks();
  }, [user]);

  const canCreate = useMemo(() => newId.trim() && newTitle.trim(), [newId, newTitle]);

  async function addCourse() {
    if (!user) return;
    if (!newId.trim() || !newTitle.trim()) return;

    const body: CreateDeckBody = {
      deck_name: newTitle.trim(),
      subject: parseSubject(newId.trim()),
      course_number: parseCourseNumber(newId.trim()),
      instructor: null,
    };

    try {
      const created = normalizeDeck(
        await api<any>(`/api/decks`, {
          method: "POST",
          body: JSON.stringify(body),
        })
      );

      setDecks((prev) => [created, ...prev]);
      setPublishedDeckIds((prev) => ({
        ...prev,
        [created.id]: Boolean(created.is_published),
      }));
      setNewId("");
      setNewTitle("");
      setAdding(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create deck");
    }
  }

  async function deleteCourse(deckId: number, deckName: string) {
    const confirmed = window.confirm(`Delete course \"${deckName}\" and all its cards?`);
    if (!confirmed) return;

    try {
      setDeletingDeckId(deckId);
      await api<DeleteDeckResponse>(`/api/decks/${deckId}`, {
        method: "DELETE",
      });
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
      setPublishedDeckIds((prev) => {
      const next = { ...prev };
      delete next[deckId];
      return next;
    });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete deck");
    } finally {
      setDeletingDeckId(null);
    }
  }

  async function publishCourse(deckId: number) {
    try {
      setPublishingDeckId(deckId);
      await publishDeck(deckId);
      setPublishedDeckIds((prev) => ({ ...prev, [deckId]: true }));
      alert("Deck published");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to publish deck");
    } finally {
      setPublishingDeckId(null);
    }
  }

  async function unpublishCourse(deckId: number) {
    try {
      setPublishingDeckId(deckId);
      await unpublishDeck(deckId);
      setPublishedDeckIds((prev) => ({ ...prev, [deckId]: false }));
      alert("Deck unpublished");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to unpublish deck");
    } finally {
      setPublishingDeckId(null);
    }
  }

  async function unsaveCourse(publicDeckId: number) {
    try {
      await api<{ saved: boolean; removed_cards: number }>(`/api/saved/${publicDeckId}`, {
        method: "DELETE",
      });

      setbkDecks((prev) =>
        prev.filter((deck) => deck.public_deck_id !== publicDeckId)
      );

      alert("Bookmark removed");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove bookmark");
    }
  }

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 24 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
        <div>
          <button
            onClick={async () => {
              try {
                await logout();
              } finally {
                navigate("/login");
              }
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
          >
            Logout
          </button>
        </div>

        <div style={{ textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>
            Welcome, {user.username}!
          </h1>
          <div style={{ color: "#6b7280" }}>{user.email}</div>
        </div>

        <div style={{ width: 120, textAlign: "right" }}>
          <button onClick={() => setAdding((a) => !a)} className="px-4 py-2 bg-white border rounded">
            {adding ? "Cancel" : "Add Course"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "20px auto 60px", background: "transparent" }}>
        {adding ? (
          <div style={{ marginBottom: 12, padding: 12, background: "white", borderRadius: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="Course ID (e.g. CSCE120)"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                style={{ padding: 8, width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="Course Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ padding: 8, width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <button
                onClick={addCourse}
                disabled={!canCreate}
                className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        ) : null}

        <section>
          <h2 style={{ fontSize: 20, marginBottom: 12, fontWeight: 800 }}>Your Courses</h2>

          {decksLoading ? <div>Loading decks…</div> : null}
          {decksError ? <div style={{ color: "crimson" }}>{decksError}</div> : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {decks.map((d) => (
              <div
                key={d.id}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: "white",
                  boxShadow: "0 0 0 1px #e5e7eb inset",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>{d.deck_name}</div>
                <div style={{ color: "#6b7280", marginBottom: 10 }}>
                  {d.subject ?? "—"}
                  {d.course_number != null ? ` · ${d.course_number}` : ""}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Link
                    to={`/courses/${d.id}`}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() =>
                      publishedDeckIds[d.id] ? unpublishCourse(d.id) : publishCourse(d.id)
                    }
                    disabled={publishingDeckId === d.id}
                    className={`px-4 py-2 bg-white border rounded transition disabled:opacity-60 ${
                      publishedDeckIds[d.id]
                        ? "text-orange-600 border-orange-300 hover:bg-orange-50"
                        : "text-blue-600 border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {publishingDeckId === d.id
                      ? publishedDeckIds[d.id]
                        ? "Unpublishing..."
                        : "Publishing..."
                      : publishedDeckIds[d.id]
                      ? "Unpublish"
                      : "Publish"}
                  </button>
                  <button
                    onClick={() => deleteCourse(d.id, d.deck_name)}
                    disabled={deletingDeckId === d.id}
                    className="px-4 py-2 bg-white border rounded text-red-600 border-red-300 hover:bg-red-50 transition disabled:opacity-60"
                  >
                    {deletingDeckId === d.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 12, fontWeight: 800 }}>
            Bookmarked Courses
          </h2>

          {bkdecksLoading ? <div>Loading bookmarked decks…</div> : null}
          {bkdecksError ? <div style={{ color: "crimson" }}>{bkdecksError}</div> : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {bkdecks.map((d) => (
              <div
                key={d.deck_id}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: "white",
                  boxShadow: "0 0 0 1px #e5e7eb inset",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 6 }}>{d.deck_name}</div>
                <div style={{ color: "#6b7280", marginBottom: 10 }}>
                  {d.subject ?? "—"}
                  {d.course_number != null ? ` · ${d.course_number}` : ""}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Link
                    to={`/bookmarked/${d.public_deck_id}`}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => unsaveCourse(d.public_deck_id)}
                    className="px-4 py-2 bg-white border rounded text-red-600 border-red-300 hover:bg-red-50 transition"
                  >
                    Remove Bookmark
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}