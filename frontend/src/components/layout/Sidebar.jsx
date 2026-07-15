import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  FolderKanban,
  Receipt,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  Calendar,
  ClipboardCheck,
  GitPullRequest,
  FileText,
  Bell,
  Activity,
  Bot,
  ScrollText,
  PackageCheck,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { initials } from "../../lib/format";

const NAV_CTO = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard", end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban, testid: "nav-projects" },
  { to: "/budget-reviews", label: "Budget Reviews", icon: ClipboardCheck, testid: "nav-budget-reviews" },
  { to: "/change-requests", label: "Change Requests", icon: GitPullRequest, testid: "nav-change-requests" },
  { to: "/audit", label: "Audit Log", icon: ScrollText, testid: "nav-audit" },
];

const NAV_CFO = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard", end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban, testid: "nav-projects" },
  { to: "/approval-queue", label: "Approval Queue", icon: ClipboardCheck, testid: "nav-approval-queue" },
  { to: "/financial-monitoring", label: "Financial Monitoring", icon: Activity, testid: "nav-financial-monitoring" },
  { to: "/early-warning", label: "Early Warning", icon: Bell, testid: "nav-early-warning" },
  { to: "/monthly-forecast", label: "Monthly Forecast", icon: Activity, testid: "nav-monthly-forecast" },
  { to: "/buffer", label: "Contingency Buffer", icon: ShieldCheck, testid: "nav-buffer" },
  { to: "/recovery", label: "Client Recovery", icon: Receipt, testid: "nav-recovery" },
  { to: "/batch-deliveries", label: "Batch Deliveries", icon: PackageCheck, testid: "nav-batch-deliveries" },
  { to: "/reports", label: "Reports", icon: FileText, testid: "nav-reports" },
  { to: "/audit", label: "Audit Log", icon: History, testid: "nav-audit" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

const NAV_TPM = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard", end: true },
  { to: "/projects", label: "My Projects", icon: FolderKanban, testid: "nav-projects" },
  { to: "/budget-builder", label: "Budget Builder", icon: ClipboardCheck, testid: "nav-budget-builder" },
  { to: "/consumption", label: "Daily Consumption", icon: Calendar, testid: "nav-consumption" },
  { to: "/approvals", label: "My Requests", icon: ShieldCheck, testid: "nav-approvals" },
];

const NAV_PL = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard", end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban, testid: "nav-projects" },
  { to: "/daily", label: "Daily", icon: Calendar, testid: "nav-daily" },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck, testid: "nav-approvals" },
  { to: "/reimbursements", label: "Reimbursements", icon: Receipt, testid: "nav-reimb" },
  { to: "/reports", label: "Reports", icon: FileText, testid: "nav-reports" },
  { to: "/tasks", label: "Tasks", icon: ListChecks, testid: "nav-tasks" },
];

const NAV_IT = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard", end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban, testid: "nav-projects" },
  { to: "/reports", label: "Reports", icon: FileText, testid: "nav-reports" },
];

const pickNav = (role) => {
  switch (role) {
    case "CTO":
      return NAV_CTO;
    case "CFO":
      return NAV_CFO;
    case "TPM":
    case "R&D":
      return NAV_TPM;
    case "PL":
      return NAV_PL;
    case "IT":
      return NAV_IT;
    default:
      return NAV_PL;
  }
};

const Sidebar = () => {
  const { user, logout } = useApp();
  const nav = useNavigate();
  const NAV = pickNav(user?.role);
  const handleLogout = () => {
    logout();
    nav("/login", { replace: true });
  };
  if (!user) return null;

  return (
    <aside data-testid="app-sidebar" className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-white/5 bg-[#0B0B12] z-30">
      {/* Brand */}
      <div className="h-16 flex items-center gap-2 px-5 border-b border-white/5">
        <img
          src="https://customer-assets.emergentagent.com/job_budget-forge-8/artifacts/lsy7cvxh_images.jpeg"
          alt="Ethara.AI"
          data-testid="sidebar-logo"
          className="w-9 h-9 rounded-full object-contain drop-shadow-[0_0_16px_rgba(232,25,184,0.35)]"
        />
        <span className="font-display font-semibold text-[17px] tracking-tight text-white">
          Ethara<span className="text-fuchsia-400">.AI</span>
        </span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.14em] px-3 mb-2">Navigation</div>
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
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors" data-testid="sidebar-user">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-9 h-9 rounded-full object-cover border border-white/10" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500/40 to-pink-500/30 flex items-center justify-center text-xs font-semibold text-fuchsia-200 border border-white/10">
              {initials(user.name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-zinc-100 truncate">{user.name}</div>
            <div className="text-xs text-zinc-500 truncate">{user.role} · Ethara.AI</div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="btn-logout"
            className="w-8 h-8 rounded-lg hover:bg-red-500/15 text-zinc-500 hover:text-red-300 flex items-center justify-center transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
