import { Search, Bell, LogOut, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { NOTIFICATIONS } from "../../data/mockData";
import { initials } from "../../lib/format";

const TopBar = () => {
  const { user, setNotifOpen, logout } = useApp();
  const nav = useNavigate();
  const unread = NOTIFICATIONS.filter((n) => !n.read).length;
  if (!user) return null;

  return (
    <header data-testid="app-topbar" className="sticky top-0 z-20 h-16 bg-[#0B0B12]/85 backdrop-blur border-b border-white/5 flex items-center gap-3 px-6">
      <div className="flex-1 max-w-xl relative">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          data-testid="topbar-search"
          placeholder="Search projects, expenses, approvals…"
          className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 focus:border-fuchsia-500/40 tabular"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          data-testid="btn-notifications"
          onClick={() => setNotifOpen(true)}
          className="relative w-10 h-10 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
        >
          <Bell className="w-[18px] h-[18px] text-zinc-300" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-fuchsia-500 text-[10px] font-semibold text-white flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button data-testid="user-menu" className="h-10 pl-1 pr-2.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] flex items-center gap-2 transition-colors">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-7 h-7 rounded-md object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-fuchsia-500/40 to-pink-500/30 flex items-center justify-center text-[10px] font-semibold text-fuchsia-200">
                  {initials(user.name)}
                </div>
              )}
              <div className="hidden md:block text-left">
                <div className="text-[11px] text-zinc-500 leading-none">Signed in as</div>
                <div className="text-xs font-semibold text-zinc-100 mt-0.5">{user.role}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">
              <div className="font-semibold">{user.name}</div>
              <div className="text-zinc-500 text-[11px] mt-0.5">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="menu-logout"
              onClick={() => {
                logout();
                nav("/login", { replace: true });
              }}
              className="text-sm gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default TopBar;
