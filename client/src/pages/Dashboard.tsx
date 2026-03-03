import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [user, loading]);

  if (!user) return null; // Loading or redirecting

  const [courses, setCourses] = useState(
    () => [
      { id: "CSCE120", title: "CSCE 120 — Data Structures" }
    ] as { id: string; title: string }[]
  );

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newId, setNewId] = useState("");

  function addCourse() {
    if (!newId.trim() || !newTitle.trim()) return;
    setCourses((s) => [...s, { id: newId.trim(), title: newTitle.trim() }]);
    setNewId("");
    setNewTitle("");
    setAdding(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 24 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 960, margin: "0 auto" }}>
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
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>Welcome, {user.username}!</h1>
          <div style={{ color: "#6b7280" }}>{user.email}</div>
        </div>

        <div style={{ width: 120, textAlign: "right" }}>
          <button
            onClick={() => setAdding((a) => !a)}
            className="px-4 py-2 bg-white border rounded"
          >
            {adding ? "Cancel" : "Add Course"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "20px auto 60px", background: "transparent" }}>
        {adding ? (
          <div style={{ marginBottom: 12, padding: 12, background: "white", borderRadius: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <input placeholder="Course ID (e.g. CSCE120)" value={newId} onChange={(e) => setNewId(e.target.value)} style={{ padding: 8, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <input placeholder="Course Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ padding: 8, width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <button onClick={addCourse} className="px-4 py-2 bg-indigo-600 text-white rounded">Create</button>
            </div>
          </div>
        ) : null}

        <section>
          <h2 style={{ fontSize: 20, marginBottom: 12, fontWeight: 800 }}>Your Courses</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {courses.map((c) => (
              <div key={c.id} style={{ padding: 16, borderRadius: 12, background: "white", boxShadow: "0 0 0 1px #e5e7eb inset" }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>{c.title}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link to={`/courses/${c.id}`} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition">Open</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}