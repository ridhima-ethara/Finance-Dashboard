import { Search, Bell, Sparkles, ChevronDown } from "lucide-react";
import { useApp } from "../../context/AppContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { NOTIFICATIONS } from "../../data/mockData";

const TopBar = () => {
  const { role, setRole, roles, setAiOpen, setNotifOpen } = useApp();
  const unread = NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <header
      data-testid="app-topbar"
      className="sticky top-0 z-20 h-16 bg-white/85 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-6"
    >
      <div className="flex-1 max-w-2xl relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          data-testid="topbar-search"
          placeholder="Search projects, expenses, approvals…"
          className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-300 tabular"
        />
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              data-testid="role-switcher"
              className="h-10 rounded-lg border-slate-200 gap-2 font-medium"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              <span className="text-slate-700">Viewing as</span>
              <span className="text-slate-900 font-semibold">{role}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs text-slate-500 uppercase tracking-wider">
              Switch role
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {roles.map((r) => (
              <DropdownMenuItem
                key={r}
                data-testid={`role-option-${r.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => setRole(r)}
                className={`text-sm ${r === role ? "font-semibold text-violet-700" : ""}`}
              >
                {r}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          data-testid="btn-ai-panel"
          onClick={() => setAiOpen(true)}
          className="h-10 rounded-lg border-slate-200 gap-2 bg-gradient-to-br from-violet-50 to-white hover:from-violet-100"
        >
          <Sparkles className="w-4 h-4 text-violet-600" />
          <span className="font-medium text-slate-800">Ask AI</span>
        </Button>

        <button
          data-testid="btn-notifications"
          onClick={() => setNotifOpen(true)}
          className="relative w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center transition-colors"
        >
          <Bell className="w-[18px] h-[18px] text-slate-600" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] font-semibold text-white flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

export default TopBar;
