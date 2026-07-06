import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  FolderKanban,
  Wallet,
  Receipt,
  ShieldCheck,
  ArrowUpRightSquare,
  History,
  Settings,
  Sparkles,
} from "lucide-react";
import { CURRENT_USER } from "../../data/mockData";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard", end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban, testid: "nav-projects" },
  { to: "/budget", label: "Budget Consolidation", icon: Wallet, testid: "nav-budget", active: true },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck, testid: "nav-approvals" },
  { to: "/topups", label: "Top-ups", icon: ArrowUpRightSquare, testid: "nav-topups" },
  { to: "/reimbursements", label: "Reimbursements", icon: Receipt, testid: "nav-reimb" },
  { to: "/audit", label: "Audit Log", icon: History, testid: "nav-audit" },
  { to: "/team", label: "Team Overview", icon: Users, testid: "nav-team" },
  { to: "/tasks", label: "All Tasks", icon: ListChecks, testid: "nav-tasks" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

const Sidebar = () => {
  return (
    <aside
      data-testid="app-sidebar"
      className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-slate-200 bg-white z-30"
    >
      {/* Brand */}
      <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-sm">
          <Sparkles className="w-4 h-4 text-white" strokeWidth={2.4} />
        </div>
        <span className="font-display font-semibold text-[17px] tracking-tight text-slate-900">
          Ethara.AI
        </span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.14em] px-3 mb-2">
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
                    ? "bg-violet-50 text-violet-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-[18px] h-[18px] ${isActive ? "text-violet-600" : "text-slate-500 group-hover:text-slate-700"}`} strokeWidth={2} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer" data-testid="sidebar-user">
          <img
            src={CURRENT_USER.avatarUrl}
            alt={CURRENT_USER.name}
            className="w-9 h-9 rounded-full object-cover border border-slate-200"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{CURRENT_USER.name}</div>
            <div className="text-xs text-slate-500 truncate">{CURRENT_USER.title}</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
