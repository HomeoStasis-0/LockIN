import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import DeckUI from "./pages/CardDeck";
import CourseView from "./pages/CourseView";
import Community from "./pages/Community";
import Account from "./pages/Account";
import Bookmarked from "./views/BookmarkedView";
import PublicDeck from "./pages/PublicDeck";
import ForgotPassword from "./pages/ForgotPassword";
import { useAuth } from "./context/AuthContext";

function App() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#374151" }}>Loading…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/community" element={user ? <Community /> : <Navigate to="/login" replace />} />
      <Route path="/account" element={user ? <Account /> : <Navigate to="/login" replace />} />
      <Route path="/bookmarked/:id" element={user ? <Bookmarked /> : <Navigate to="/login" replace />} />
      <Route path="/community/decks/:id" element={user ? <PublicDeck /> : <Navigate to="/login" replace />} />
      <Route path="/cards/" element={user ? <DeckUI deckId={1}/> : <Navigate to="/login" replace />} />
      <Route path="/courses/:id" element={user ? <CourseView /> : <Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
    </Routes>
  );
}

export default App;
