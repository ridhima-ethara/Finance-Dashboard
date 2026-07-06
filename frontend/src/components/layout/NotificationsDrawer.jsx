import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { useApp } from "../../context/AppContext";
import { NOTIFICATIONS } from "../../data/mockData";
import { fmtDate } from "../../lib/format";
import { AlertTriangle, Info, CheckCircle2, TriangleAlert } from "lucide-react";

const iconFor = (type) => {
  const cls = "w-4 h-4";
  if (type === "danger") return <AlertTriangle className={`${cls} text-red-500`} />;
  if (type === "warning") return <TriangleAlert className={`${cls} text-amber-500`} />;
  if (type === "success") return <CheckCircle2 className={`${cls} text-emerald-500`} />;
  return <Info className={`${cls} text-blue-500`} />;
};

const bgFor = (type) => {
  if (type === "danger") return "bg-red-50 border-red-100";
  if (type === "warning") return "bg-amber-50 border-amber-100";
  if (type === "success") return "bg-emerald-50 border-emerald-100";
  return "bg-blue-50 border-blue-100";
};

const NotificationsDrawer = () => {
  const { notifOpen, setNotifOpen } = useApp();
  return (
    <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0" data-testid="notifications-drawer">
        <SheetHeader className="px-6 py-5 border-b border-slate-100">
          <SheetTitle className="font-display text-xl">Notifications</SheetTitle>
          <p className="text-sm text-slate-500">Portfolio alerts across all projects</p>
        </SheetHeader>
        <div className="px-4 py-4 space-y-2 overflow-y-auto">
          {NOTIFICATIONS.map((n) => (
            <div
              key={n.id}
              data-testid={`notif-${n.id}`}
              className={`flex gap-3 p-4 rounded-xl border ${bgFor(n.type)} ${n.read ? "opacity-70" : ""}`}
            >
              <div className="mt-0.5">{iconFor(n.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                <div className="text-xs text-slate-600 mt-0.5">{n.detail}</div>
                <div className="text-[11px] text-slate-400 mt-2 tabular">{fmtDate(n.ts)}</div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NotificationsDrawer;
