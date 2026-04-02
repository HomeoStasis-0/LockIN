import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, LockKeyhole, ShieldAlert, UserRound } from "lucide-react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";

type StatusKind = "idle" | "success" | "error";

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }
  } catch {
    // Ignore JSON parse failures and fall back to the default message.
  }

  return fallback;
}

function StatusBanner({
  kind,
  message,
}: {
  kind: StatusKind;
  message: string | null;
}) {
  if (!message || kind === "idle") return null;

  const styles =
    kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";
  const icon =
    kind === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />;

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${styles}`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

export default function Account() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<StatusKind>("idle");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<StatusKind>("idle");
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, navigate, user]);

  const passwordReady = useMemo(() => {
    return (
      currentPassword.trim().length > 0 &&
      newPassword.trim().length >= 8 &&
      confirmPassword.trim().length >= 8 &&
      newPassword === confirmPassword &&
      !passwordSubmitting
    );
  }, [confirmPassword, currentPassword, newPassword, passwordSubmitting]);

  const deleteReady = useMemo(() => {
    return deleteConfirmation.trim().length > 0 && deleteConfirmation === user?.username && !deleteSubmitting;
  }, [deleteConfirmation, deleteSubmitting, user?.username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-2xl bg-white px-6 py-4 text-slate-600 shadow-sm">
            Loading account...
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;
  const activeUser = user;

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setPasswordStatus("error");
      setPasswordMessage("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus("error");
      setPasswordMessage("New password and confirmation do not match.");
      return;
    }

    setPasswordSubmitting(true);
    setPasswordStatus("idle");
    setPasswordMessage(null);

    try {
      const res = await fetch("/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to update password"));
      }

      setPasswordStatus("success");
      setPasswordMessage("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordStatus("error");
      setPasswordMessage(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function handleDeleteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (deleteConfirmation !== activeUser.username) {
      setDeleteStatus("error");
      setDeleteMessage(`Type ${activeUser.username} exactly to confirm account deletion.`);
      return;
    }

    const confirmed = window.confirm(
      "This permanently deletes your account and all related data. Continue?"
    );
    if (!confirmed) return;

    setDeleteSubmitting(true);
    setDeleteStatus("idle");
    setDeleteMessage(null);

    try {
      const res = await fetch("/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          confirmation: deleteConfirmation,
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to delete account"));
      }

      await logout();
      navigate("/register", { replace: true });
    } catch (error) {
      setDeleteStatus("error");
      setDeleteMessage(error instanceof Error ? error.message : "Failed to delete account");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <AppShell
      pageTitle="Account"
      headerRight={
        <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
          Signed in as {activeUser.username}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-200">
                <UserRound size={14} />
                Profile
              </div>
              <h2 className="text-2xl font-semibold">Manage your account</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
                Review your identity, update credentials, and manage destructive actions from one place.
              </p>
            </div>
            <div className="hidden rounded-2xl border border-white/10 bg-white/5 p-4 md:block">
              <LockKeyhole className="text-slate-100" size={28} />
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-300">Username</div>
              <div className="mt-2 text-lg font-semibold">{activeUser.username}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-300">Email</div>
              <div className="mt-2 break-words text-lg font-semibold">{activeUser.email}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-300">User ID</div>
              <div className="mt-2 text-lg font-semibold">#{activeUser.user_id}</div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Security summary</h2>
              <p className="text-sm text-slate-500">Keep your account access current and secure.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-700">Account status</div>
              <div className="mt-1 text-sm text-slate-600">Authenticated session active</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-700">Password management</div>
              <div className="mt-1 text-sm text-slate-600">
                Update your password without leaving the account page.
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <LockKeyhole size={18} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Change password</h2>
              <p className="text-sm text-slate-500">
                Use your current password to set a new one. New passwords must be at least 8 characters.
              </p>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handlePasswordSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </label>

            <StatusBanner kind={passwordStatus} message={passwordMessage} />

            <button
              type="submit"
              disabled={!passwordReady}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {passwordSubmitting ? "Updating..." : "Update password"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-rose-900">Danger zone</h2>
              <p className="text-sm text-rose-700">
                Deleting your account permanently removes access and related data.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-rose-200 bg-white p-4 text-sm text-rose-800">
            Type <span className="font-semibold">{activeUser.username}</span> below to confirm deletion.
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleDeleteSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-rose-900">Confirmation text</span>
              <input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="w-full rounded-2xl border border-rose-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-rose-500"
                placeholder={activeUser.username}
              />
            </label>

            <StatusBanner kind={deleteStatus} message={deleteMessage} />

            <button
              type="submit"
              disabled={!deleteReady}
              className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteSubmitting ? "Deleting..." : "Delete account"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
