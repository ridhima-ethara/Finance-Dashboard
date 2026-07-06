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
      className="sticky top-0 z-20 h-16 bg-[#0B0B12]/85 backdrop-blur border-b border-white/5 flex items-center gap-3 px-6"
    >
      <div className="flex-1 max-w-2xl relative">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          data-testid="topbar-search"
          placeholder="Search projects, expenses, approvals…"
          className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 focus:border-fuchsia-500/40 tabular"
        />
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              data-testid="role-switcher"
              className="h-10 rounded-lg border-white/10 bg-white/[0.04] hover:bg-white/[0.08] gap-2 font-medium"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500/100" />
              <span className="text-zinc-200">Viewing as</span>
              <span className="text-white font-semibold">{role}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs text-zinc-500 uppercase tracking-wider">
              Switch role
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {roles.map((r) => (
              <DropdownMenuItem
                key={r}
                data-testid={`role-option-${r.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => setRole(r)}
                className={`text-sm ${r === role ? "font-semibold text-fuchsia-400" : ""}`}
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
          className="h-10 rounded-lg border-fuchsia-500/30 gap-2 bg-fuchsia-500/[0.06] hover:bg-fuchsia-500/[0.14] text-fuchsia-200"
        >
          <Sparkles className="w-4 h-4 text-fuchsia-400" />
          <span className="font-medium text-zinc-100">Ask AI</span>
        </Button>

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
      </div>
    </header>
  );
};

export default TopBar;
