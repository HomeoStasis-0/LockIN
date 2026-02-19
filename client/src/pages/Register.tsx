export default function Register() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-6">
      <div className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-indigo-800">
          Create Account
        </h2>

        <form className="flex flex-col gap-5">
          <input
            type="text"
            placeholder="Full Name"
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
          />
          <input
            type="email"
            placeholder="Email"
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
          />
          <input
            type="password"
            placeholder="Password"
            className="border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
          />

          <button
            type="submit"
            className="mt-4 bg-indigo-600 text-white py-3 font-semibold rounded-xl shadow-lg hover:bg-indigo-700 transform hover:-translate-y-1 transition-all duration-300"
          >
            Sign Up
          </button>
        </form>

        <p className="text-center text-gray-500 mt-6">
          Already have an account?{" "}
          <a href="/" className="text-indigo-600 hover:underline">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
