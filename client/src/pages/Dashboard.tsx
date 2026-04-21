import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { DeckRow } from "../types/DeckTypes"; 
import type { PublicDeckRow } from "../types/CommunityTypes"
import { publishDeck, unpublishDeck } from "../API/CommunityAPI";
import AppShell from "../components/AppShell";


type CreateDeckBody = {
  deck_name: string;
  subject: string | null;
  course_number: number | null;
  instructor: string | null;
};

type UpdateDeckBody = {
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

function formatCourseId(deck: DeckRow): string {
  if (!deck.subject && deck.course_number == null) return "";
  return `${deck.subject ?? ""}${deck.course_number ?? ""}`;
}

export default function Dashboard() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  // redirect if not logged in
  useEffect(() => {
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);

  const [decks, setDecks] = useState<DeckRow[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [deletingDeckId, setDeletingDeckId] = useState<number | null>(null);

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newId, setNewId] = useState(""); // e.g. CSCE120

  const [editingDeckId, setEditingDeckId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editId, setEditId] = useState("");
  const [savingDeckId, setSavingDeckId] = useState<number | null>(null);

  const [publishingDeckId, setPublishingDeckId] = useState<number | null>(null);
  const [publishedDeckIds, setPublishedDeckIds] = useState<Record<number, boolean>>({});

  const[bkdecks, setbkDecks] = useState<PublicDeckRow[]>([]);
  const [bkdecksLoading, setbkDecksLoading] = useState(false);
  const [bkdecksError, setbkDecksError] = useState<string | null>(null);
  const [unsaveDeckId, setUnsaveDeckId] = useState<number | null>(null);


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

  function startEditDeck(deck: DeckRow) {
    setEditingDeckId(deck.id);
    setEditTitle(deck.deck_name);
    setEditId(formatCourseId(deck));
  }

  function cancelEditDeck() {
    setEditingDeckId(null);
    setEditTitle("");
    setEditId("");
  }

  async function saveDeck(deck: DeckRow) {
    const nextTitle = editTitle.trim();
    const nextId = editId.trim();

    if (!nextTitle) {
      alert("Course title is required");
      return;
    }

    const body: UpdateDeckBody = {
      deck_name: nextTitle,
      subject: parseSubject(nextId),
      course_number: parseCourseNumber(nextId),
      instructor: deck.instructor ?? null,
    };

    try {
      setSavingDeckId(deck.id);
      const updated = normalizeDeck(
        await api<any>(`/api/decks/${deck.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
      );

      setDecks((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      cancelEditDeck();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update deck");
    } finally {
      setSavingDeckId(null);
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
      setUnsaveDeckId(publicDeckId);
      await api<{ saved: boolean; removed_cards: number }>(`/api/saved/${publicDeckId}`, {
        method: "DELETE",
      });

      setbkDecks((prev) =>
        prev.filter((deck) => deck.public_deck_id !== publicDeckId)
      );

      alert("Bookmark removed");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove bookmark");
    } finally {
      setUnsaveDeckId(null);
    }
  }

  if (!user) return null;

  return (
    <AppShell pageTitle="Dashboard">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              Welcome, {user.username}!
            </h1>
            <p className="mt-1 text-sm text-slate-500">{user.email}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setAdding((a) => !a)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {adding ? "Cancel" : "Add Course"}
            </button>

            <button
              onClick={async () => {
                try {
                  await logout();
                } finally {
                  navigate("/");
                }
              }}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              Logout
            </button>
          </div>
        </div>

        {adding ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Course ID (e.g. CSCE120)"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400"
              />
              <input
                placeholder="Course Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400"
              />
            </div>

            <div className="mt-4">
              <button
                onClick={addCourse}
                disabled={!canCreate}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-800">Your Courses</h2>
          </div>

          {decksLoading ? <div className="text-sm text-slate-500">Loading decks…</div> : null}
          {decksError ? <div className="text-sm text-red-600">{decksError}</div> : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {decks.map((d) => (
              <div
                key={d.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:shadow-md"
              >
                {editingDeckId === d.id ? (
                  <div className="mb-3 space-y-2">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Course Title"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400"
                    />
                    <input
                      value={editId}
                      onChange={(e) => setEditId(e.target.value)}
                      placeholder="Course ID (e.g. CSCE120)"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400"
                    />
                  </div>
                ) : (
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-slate-800">{d.deck_name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {d.subject ?? "—"}
                      {d.course_number != null ? ` · ${d.course_number}` : ""}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {editingDeckId === d.id ? (
                    <>
                      <button
                        onClick={() => saveDeck(d)}
                        disabled={savingDeckId === d.id}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {savingDeckId === d.id ? "Saving..." : "Save"}
                      </button>

                      <button
                        onClick={cancelEditDeck}
                        disabled={savingDeckId === d.id}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        to={`/courses/${d.id}`}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                      >
                        Open
                      </Link>

                      <button
                        onClick={() => startEditDeck(d)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    </>
                  )}

                  <button
                    onClick={() =>
                      publishedDeckIds[d.id] ? unpublishCourse(d.id) : publishCourse(d.id)
                    }
                    disabled={publishingDeckId === d.id || editingDeckId === d.id}
                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${
                      publishedDeckIds[d.id]
                        ? "border-orange-300 bg-white text-orange-600 hover:bg-orange-50"
                        : "border-blue-300 bg-white text-blue-600 hover:bg-blue-50"
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
                    disabled={deletingDeckId === d.id || editingDeckId === d.id}
                    className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {deletingDeckId === d.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-800">Bookmarked Courses</h2>
          </div>

          {bkdecksLoading ? <div className="text-sm text-slate-500">Loading bookmarked decks…</div> : null}
          {bkdecksError ? <div className="text-sm text-red-600">{bkdecksError}</div> : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bkdecks.map((d) => (
              <div
                key={d.public_deck_id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-slate-800">{d.deck_name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {d.subject ?? "—"}
                    {d.course_number != null ? ` · ${d.course_number}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/bookmarked/${d.public_deck_id}`}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                  >
                    Open
                  </Link>

                  <button
                    onClick={() => unsaveCourse(d.public_deck_id)}
                    disabled={unsaveDeckId === d.public_deck_id}
                    className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {unsaveDeckId === d.public_deck_id ? "Removing..." : "Remove Bookmark"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
