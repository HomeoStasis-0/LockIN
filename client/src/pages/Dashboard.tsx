import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user]);

  if (!user) return null; // Loading or redirecting

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-200 p-6">
      <h1 className="text-4xl font-bold mb-4">Welcome, {user.username}!</h1>
      <p className="mb-6">Email: {user.email}</p>
      <button
        onClick={logout}
        className="px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
      >
        Logout
      </button>
    </div>
  );
}