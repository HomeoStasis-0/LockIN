import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200 p-4">
      <h1 className="text-6xl font-bold text-blue-800 mb-6">LockIN</h1>
      <p className="text-xl text-gray-700 mb-8 italic">
        "insert motivational quote here"
      </p>
      <Link
        to="/register"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
      >
        Sign Up
      </Link>
    </div>
  );
}
