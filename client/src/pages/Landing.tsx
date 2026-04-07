import { Link } from "react-router-dom";
import lockinLogo from "../assets/logo.png";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-200 to-indigo-300 p-6">
      <div className="text-center max-w-xl">
        <img
          src={lockinLogo}
          alt="LockIN"
          className="w-full max-w-[540px] mx-auto mb-4 drop-shadow-lg"
        />
        <p className="text-xl text-indigo-800 italic mb-10">
          Powered by Spaced Repetition and AI.
        </p>

        <Link
          to="/register"
          className="inline-block px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-700 transform hover:-translate-y-1 transition-all duration-300"
        >
          Join now
        </Link>
      </div>
    </div>
  );
}
