import { NavLink } from "react-router-dom";
import { Lock, LockOpen, LayoutDashboard, Search, CircleUserRound } from "lucide-react";
import { useState } from "react";
import logo from "../assets/logo.png";

type NavItemProps = {
  icon: React.ReactNode;
  text: string;
  to: string;
  active?: boolean;
  expanded: boolean;
};

export function NavItem({
  icon,
  text,
  to,
  expanded,
}: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center justify-center rounded-xl px-3 py-2 transition sm:px-2
        ${expanded ? "sm:gap-3 sm:px-3 sm:justify-start" : "sm:justify-center sm:px-2"}
        ${
          isActive
            ? "bg-blue-100 text-blue-700 font-semibold"
            : "text-gray-700 hover:bg-gray-100"
        }`
      }
    >
      <span className="flex items-center justify-center">{icon}</span>
      <span
        className={`overflow-hidden whitespace-nowrap transition-all duration-300 w-0 opacity-0
          ${expanded ? "sm:w-24 sm:opacity-100" : "sm:w-0 sm:opacity-0"}`}
      >
        {text}
      </span>
    </NavLink>
  );
}

export default function SideBar() {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={`sticky top-0 z-20 w-full border-b bg-white p-3 shadow transition-all duration-300 sm:h-screen sm:self-start sm:border-b-0 sm:border-r sm:p-4
        ${expanded ? "sm:w-64" : "sm:w-20"}`}
    >
      <div className="flex h-full flex-row items-center justify-between gap-2 sm:flex-col sm:items-stretch sm:gap-0">
        <div className={`mb-0 flex items-center justify-center sm:mb-6 ${expanded ? "sm:justify-between" : "sm:justify-center"}`}>
          <div
            className={`w-10 overflow-hidden opacity-100 transition-all duration-300
              ${expanded ? "sm:w-24 sm:opacity-100" : "sm:w-0 sm:opacity-0"}`}
          >
            <img src={logo} alt="Logo" />
          </div>

          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="hidden rounded-lg p-2 hover:bg-gray-100 sm:inline-flex"
          >
            {expanded ? <LockOpen size={18} /> : <Lock size={18} />}
          </button>
        </div>

        <div className="flex flex-1 flex-row items-center gap-2 sm:flex-col sm:items-stretch">
          <NavItem
            icon={<LayoutDashboard size={18} />}
            text="Dashboard"
            to="/dashboard"
            expanded={expanded}
          />
          <NavItem
            icon={<Search size={18} />}
            text="Community"
            to="/community"
            expanded={expanded}
          />
        </div>

        <div className="mt-auto border-t pt-4">
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `flex items-center rounded-xl py-2 transition w-full
              ${expanded ? "gap-3 px-3 justify-start" : "justify-center px-2"}
              ${
                isActive
                  ? "bg-blue-100 text-blue-700 font-semibold"
                  : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            <CircleUserRound size={18} />
            <span
              className={`overflow-hidden whitespace-nowrap transition-all duration-300 w-0 opacity-0
                ${expanded ? "sm:w-20 sm:opacity-100" : "sm:w-0 sm:opacity-0"}`}
            >
              Account
            </span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
