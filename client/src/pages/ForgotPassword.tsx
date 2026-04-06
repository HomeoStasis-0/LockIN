import { useState } from "react";
import { Link } from "react-router-dom";

type Step = "request" | "verify" | "done";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("request");
  const [login, setLogin] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await fetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login }),
      });
      // Always move forward regardless — prevents user enumeration
      setStep("verify");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed.");
        return;
      }
      setStep("done");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-indigo-100 p-6">
      <form
        onSubmit={step === "request" ? handleRequest : handleReset}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-md"
      >
        {step === "done" ? (
          <>
            <h2 className="text-2xl font-bold mb-2">Password Updated!</h2>
            <p className="text-gray-600 text-sm mb-6">
              Your password has been reset successfully.
            </p>
            <Link
              to="/login"
              className="block w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 transition text-center"
            >
              Back to Login
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-1">
              {step === "request" ? "Forgot Password" : "Enter Reset Code"}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {step === "request"
                ? "Enter your username or email and we'll send you a 6-digit code."
                : `Check the email on file for "${login}" and enter the code below.`}
            </p>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            {step === "request" ? (
              <input
                type="text"
                placeholder="Username or Email"
                value={login}
                onChange={e => setLogin(e.target.value)}
                className="w-full p-3 mb-3 border rounded"
                required
                autoFocus
              />
            ) : (
              <>
                <input
                  type="text"
                  placeholder="6-digit code"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full p-3 mb-3 border rounded text-center tracking-widest text-lg font-mono"
                  maxLength={6}
                  required
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full p-3 mb-3 border rounded"
                  required
                />
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full p-3 mb-3 border rounded"
                  required
                />
              </>
            )}

            <button
              type="submit"
              disabled={loading || (step === "verify" && code.length !== 6)}
              className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading
                ? step === "request" ? "Sending..." : "Resetting..."
                : step === "request" ? "Send Code" : "Reset Password"}
            </button>

            {step === "verify" && (
              <button
                type="button"
                onClick={() => { setStep("request"); setError(""); setCode(""); }}
                className="w-full mt-2 text-sm text-gray-500 hover:text-indigo-600 transition"
              >
                ← Try a different account
              </button>
            )}

            <p className="mt-4 text-sm text-gray-600">
              Remember your password?{" "}
              <Link to="/login" className="text-indigo-600 hover:underline">
                Log in
              </Link>
            </p>
          </>
        )}
      </form>
    </div>
  );
}