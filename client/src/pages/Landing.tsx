import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-200 to-indigo-300 p-6">
      <div className="text-center max-w-xl">
        <h1 className="text-7xl font-extrabold text-indigo-900 mb-4 drop-shadow-lg">
          LockIN
        </h1>
        <p className="text-xl text-indigo-800 italic mb-10">
          "insert motivational quote here"
        </p>

        <Link
          to="/register"
          className="inline-block px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-700 transform hover:-translate-y-1 transition-all duration-300"
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
}
