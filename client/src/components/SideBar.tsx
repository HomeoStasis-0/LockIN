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
        `flex items-center rounded-xl py-2 transition
        ${expanded ? "gap-3 px-3 justify-start" : "justify-center px-2"}
        ${
          isActive
            ? "bg-blue-100 text-blue-700 font-semibold"
            : "text-gray-700 hover:bg-gray-100"
        }`
      }
    >
      <span className="flex items-center justify-center">{icon}</span>
      <span
        className={`overflow-hidden whitespace-nowrap transition-all duration-300
          ${expanded ? "w-24 opacity-100" : "w-0 opacity-0"}`}
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
      className={`h-screen bg-white p-4 shadow transition-all duration-300
        ${expanded ? "w-64 rounded-r-3xl" : "w-20 rounded-r-3xl"}`}
    >
      <div className="flex h-full flex-col">
        <div className={`mb-6 flex items-center ${expanded ? "justify-between" : "justify-center"}`}>
          <div
            className={`overflow-hidden transition-all duration-300
              ${expanded ? "w-24 opacity-100" : "w-0 opacity-0"}`}
          >
            <img src={logo} alt="Logo" />
          </div>

          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            {expanded ? <LockOpen size={18} /> : <Lock size={18} />}
          </button>
        </div>

        <div className="flex flex-col gap-2">
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
              className={`overflow-hidden whitespace-nowrap transition-all duration-300
                ${expanded ? "w-20 opacity-100" : "w-0 opacity-0"}`}
            >
              Account
            </span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
