import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  FolderKanban,
  Receipt,
  ShieldCheck,
  ArrowUpRightSquare,
  History,
  Settings,
} from "lucide-react";
import { CURRENT_USER } from "../../data/mockData";
import { useApp } from "../../context/AppContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard", end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban, testid: "nav-projects" },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck, testid: "nav-approvals" },
  { to: "/topups", label: "Top-ups", icon: ArrowUpRightSquare, testid: "nav-topups" },
  { to: "/reimbursements", label: "Reimbursements", icon: Receipt, testid: "nav-reimb" },
  { to: "/audit", label: "Audit Log", icon: History, testid: "nav-audit" },
  { to: "/team", label: "Team", icon: Users, testid: "nav-team" },
  { to: "/tasks", label: "Tasks", icon: ListChecks, testid: "nav-tasks" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

const Sidebar = () => {
  const { role } = useApp();
  return (
    <aside
      data-testid="app-sidebar"
      className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-white/5 bg-[#0B0B12] z-30"
    >
      {/* Brand */}
      <div className="h-16 flex items-center gap-2 px-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-[0_0_20px_rgba(232,25,184,0.4)]">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3 v18 M3 12 h18 M6.3 6.3 l11.4 11.4 M17.7 6.3 L6.3 17.7" opacity="0.5" />
          </svg>
        </div>
        <span className="font-display font-semibold text-[17px] tracking-tight text-white">
          Ethara<span className="text-fuchsia-400">.AI</span>
        </span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.14em] px-3 mb-2">
          Navigation
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, testid, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={testid}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-fuchsia-500/10 text-fuchsia-300 font-medium"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-[18px] h-[18px] ${isActive ? "text-fuchsia-400" : "text-zinc-500 group-hover:text-zinc-300"}`} strokeWidth={2} />
                  <span>{label}</span>
                  {isActive && <span className="ml-auto w-1 h-4 rounded-full bg-fuchsia-400" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors" data-testid="sidebar-user">
          <img
            src={CURRENT_USER.avatarUrl}
            alt={CURRENT_USER.name}
            className="w-9 h-9 rounded-full object-cover border border-white/10"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-zinc-100 truncate">{CURRENT_USER.name}</div>
            <div className="text-xs text-zinc-500 truncate">{role} · Ethara.AI</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
