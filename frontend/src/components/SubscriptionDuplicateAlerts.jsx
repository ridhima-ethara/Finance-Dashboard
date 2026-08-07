import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { fmtDate } from "../lib/format";

// Statuses that represent a subscription that is in-force or on its way to being in-force.
// A member holding two of these for the same plan on the same project, with overlapping
// periods, means the previous subscription has not finished yet — which we flag.
const IN_FORCE_STATUSES = new Set(["cto-review", "cfo-review", "fulfilment-pending", "active", "expiring"]);
const memberKey = (member) => String(member?.email || member?.id || member?.name || "").trim().toLowerCase();
const dateVal = (value) => { const parsed = new Date(String(value || "").slice(0, 10)); return Number.isNaN(parsed.getTime()) ? null : parsed; };
const overlaps = (aStart, aEnd, bStart, bEnd) => {
  const as = dateVal(aStart); const ae = dateVal(aEnd); const bs = dateVal(bStart); const be = dateVal(bEnd);
  if (!as || !ae || !bs || !be) return false;
  return as <= be && bs <= ae; // ranges intersect → previous not finished before the next begins
};

const buildConflicts = (requests) => {
  const allocations = [];
  (requests || []).forEach((request) => {
    if (!IN_FORCE_STATUSES.has(request.status)) return;
    (request.lines || []).forEach((line) => {
      (line.members || []).forEach((member) => allocations.push({
        projectId: request.project_id,
        projectName: request.project_name,
        planId: line.plan_id,
        subscription: line.subscription,
        model: line.model,
        memberKey: memberKey(member),
        memberName: member.name || member.email || "Member",
        start: line.start_date,
        end: line.end_date,
        requestId: request.id,
        requestNumber: request.request_number,
        status: request.status,
      }));
    });
  });

  const groups = new Map();
  allocations.forEach((allocation) => {
    if (!allocation.memberKey || !allocation.planId) return;
    const key = `${allocation.projectId}|${allocation.memberKey}|${allocation.planId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(allocation);
  });

  const conflicts = [];
  groups.forEach((items) => {
    if (items.length < 2) return;
    const sorted = [...items].sort((a, b) => (dateVal(a.start)?.getTime() || 0) - (dateVal(b.start)?.getTime() || 0));
    const hasOverlap = sorted.some((a, index) => sorted.slice(index + 1).some((b) => overlaps(a.start, a.end, b.start, b.end)));
    if (hasOverlap) conflicts.push({ ...sorted[0], items: sorted });
  });
  return conflicts;
};

const statusLabels = {
  "cto-review": "CTO review", "cfo-review": "CFO review", "fulfilment-pending": "Fulfilment pending", active: "Active", expiring: "Expiring",
};

const SubscriptionDuplicateAlerts = ({ requests = [] }) => {
  const [collapsed, setCollapsed] = useState(false);
  const conflicts = useMemo(() => buildConflicts(requests), [requests]);
  if (!conflicts.length) return null;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4" data-testid="subscription-duplicate-alerts">
      <button type="button" onClick={() => setCollapsed((value) => !value)} className="flex w-full items-center gap-3 text-left">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300"><AlertTriangle className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-amber-100">{conflicts.length} duplicate subscription {conflicts.length === 1 ? "alert" : "alerts"}</div>
          <div className="mt-0.5 text-xs text-amber-200/70">A member holds the same subscription more than once on a project while the previous one has not finished (overlapping periods).</div>
        </div>
        {collapsed ? <ChevronRight className="h-4 w-4 text-amber-300" /> : <ChevronDown className="h-4 w-4 text-amber-300" />}
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-2">
          {conflicts.map((conflict) => (
            <div key={`${conflict.projectId}-${conflict.memberKey}-${conflict.planId}`} className="rounded-xl border border-amber-500/20 bg-black/20 p-3" data-testid={`duplicate-alert-${conflict.requestId}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="font-semibold text-white">{conflict.memberName}</span>
                <span className="text-zinc-500">·</span>
                <span className="text-amber-200">{conflict.subscription}</span>
                {conflict.model ? <span className="text-zinc-500">· {conflict.model}</span> : null}
                <span className="text-zinc-500">·</span>
                <span className="text-zinc-400">{conflict.projectName}</span>
                <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">{conflict.items.length} overlapping</span>
              </div>
              <div className="mt-2 grid gap-1.5">
                {conflict.items.map((item) => (
                  <div key={`${item.requestId}-${item.start}`} className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                    <span className="font-medium text-zinc-300">{item.requestNumber}</span>
                    <span className="text-zinc-600">{fmtDate(item.start)} → {fmtDate(item.end)}</span>
                    <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[9px] text-zinc-400">{statusLabels[item.status] || item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SubscriptionDuplicateAlerts;
