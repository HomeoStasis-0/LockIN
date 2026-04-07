import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await login(loginValue, password);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("oauth");
    if (oauthError) {
      setError("Google sign in failed. Please try again.");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-indigo-100 p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-md"
      >
        <h2 className="text-2xl font-bold mb-4">Login</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <input
          type="text"
          placeholder="Username or Email"
          value={loginValue}
          onChange={e => setLoginValue(e.target.value)}
          className="w-full p-3 mb-3 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-3 mb-3 border rounded"
          required
        />
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 transition"
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/auth/google";
          }}
          className="w-full mt-3 bg-white border border-gray-300 text-gray-700 py-3 rounded hover:bg-gray-50 transition shadow-sm flex items-center justify-center gap-3 font-medium"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            width="20"
            height="20"
            aria-hidden="true"
          >
            <path fill="#FFC107" d="M43.6 20.4H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 8 3L37.7 9.3C34.1 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.6z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15 18.9 12 24 12c3 0 5.8 1.1 8 3l5.7-5.7C34.1 6 29.3 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.3-11.4-8l-6.6 5.1C9.3 39.7 16 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.4H42V20H24v8h11.3c-1 2.8-2.9 4.8-5 6.1l.1-.1 6.3 5.3C36.2 39.6 44 34 44 24c0-1.3-.1-2.4-.4-3.6z"/>
          </svg>
          Continue with Google
        </button>
        <p className="mt-3 text-sm text-gray-600">
          <Link to="/forgot-password" className="text-indigo-600 hover:underline">
            Forgot password?
          </Link>
        </p>
        <p className="mt-4 text-sm text-gray-600">
          Don't have an account?{" "}
          <Link to="/register" className="text-indigo-600 hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}