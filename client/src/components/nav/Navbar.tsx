import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block h-8 w-8 rounded-lg bg-slate-900" />
          <span>LockIN</span>
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          <NavItem to="/dashboard" label="Dashboard" />
          <NavItem to="/community" label="Community" />
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-slate-600 sm:inline">
                {user.username}
              </span>
              <button
                onClick={() => void logout()}
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      <nav className="border-t bg-white sm:hidden">
        <div className="mx-auto flex max-w-6xl gap-2 px-4 py-2">
          <MobileNavItem to="/dashboard" label="Dashboard" />
          <MobileNavItem to="/community" label="Community" />
        </div>
      </nav>
    </header>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `text-sm ${
          isActive ? "font-semibold text-slate-900" : "text-slate-600 hover:text-slate-900"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function MobileNavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex-1 rounded-lg px-3 py-2 text-center text-sm ${
          isActive ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
        }`
      }
    >
      {label}
    </NavLink>
  );
}