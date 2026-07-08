import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { BUDGET_REVIEWS } from "../../data/mockTpm";
import { useApp } from "../../context/AppContext";
import {
  ChevronRight,
  FileText,
  ArrowUpRightSquare,
  Cpu,
  HardDrive,
  Circle,
} from "lucide-react";

const topupStatusLabel = (status) => {
  switch (status) {
    case "pending-cto": return "CTO Review";
    case "pending-cfo": return "Pending";
    case "approved": return "Approved";
    case "partial": return "Partially Approved";
    case "rejected": return "Rejected";
    default: return "Pending";
  }
};

// Merge budget reviews + top-up requests into one unified queue
const buildQueue = (topupRequests) => {
  const items = [];
  let seq = 100;
  // Budget requests
  BUDGET_REVIEWS.forEach((r) => {
    seq += 1;
    items.push({
      id: r.id,
      href: `/approval-queue/${r.id}`,
      requestId: `BBR/2026/00${seq}`,
      type: "Budget",
      title: r.type,
      project: r.projectName,
      subLabel: r.type,
      raisedBy: r.tpm,
      raisedRole: "CTO",
      raisedDate: new Date(r.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      status: r.stage === "CTO Review" ? "Pending" : r.stage === "COO Approval" ? "CTO Review" : r.stage,
      amount: r.requestedBudget,
      raw: r,
    });
  });
  // Real top-up requests from context
  topupRequests.forEach((r) => {
    seq += 1;
    items.push({
      id: r.id,
      href: `/topup-requests/${r.id}`,
      requestId: `TUR/2026/00${seq}`,
      type: "Top-up",
      title: `${r.phaseName} top-up`,
      project: r.projectName,
      subLabel: r.phaseName,
      raisedBy: r.requester,
      raisedRole: r.requesterRole,
      raisedDate: new Date(r.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      status: topupStatusLabel(r.status),
      amount: r.amount,
      raw: r,
    });
  });
  // New Model
  seq += 1;
  items.push({
    id: "nm-1",
    requestId: `BBR/2026/00${seq}`,
    type: "New Model",
    title: "New model onboarding",
    project: "Add Grok-3 to model catalog",
    subLabel: "AI · Provider",
    raisedBy: "Arjun Mehta",
    raisedRole: "TPM",
    raisedDate: "Jul 6, 2026",
    status: "Pending",
    amount: 1200,
  });
  seq += 1;
  items.push({
    id: "nm-2",
    requestId: `BBR/2026/00${seq}`,
    type: "New Model",
    title: "New model onboarding",
    project: "Add Claude Opus 4.9 to catalog",
    subLabel: "AI · Provider",
    raisedBy: "Vikram Kumar",
    raisedRole: "CTO",
    raisedDate: "Jul 5, 2026",
    status: "Approved",
    amount: 800,
  });
  // Device
  seq += 1;
  items.push({
    id: "dv-1",
    requestId: `BBR/2026/00${seq}`,
    type: "Device",
    title: "Hardware provisioning",
    project: "MacBook Pro M4 · 4 units",
    subLabel: "IT",
    raisedBy: "Priya Kapoor",
    raisedRole: "Finance",
    raisedDate: "Jul 5, 2026",
    status: "Approved",
    amount: 9600,
  });
  return items;
};

const typeIcons = { Budget: FileText, "Top-up": ArrowUpRightSquare, "New Model": Cpu, Device: HardDrive };
const typeChip = {
  Budget: "bg-indigo-100 text-indigo-800 dark:bg-fuchsia-500/15 dark:text-fuchsia-200",
  "Top-up": "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
  "New Model": "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  Device: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
};
const statusChip = {
  Pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "CTO Review": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "Partially Approved": "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  Rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  "Changes Required": "bg-red-500/10 text-red-300 border-red-500/25",
};

const rowTint = {
  Pending: "hover:bg-fuchsia-500/[0.04]",
  "CTO Review": "bg-amber-500/[0.03] hover:bg-amber-500/[0.06]",
  "Changes Required": "hover:bg-red-500/[0.04]",
};

const ApprovalQueue = () => {
  const { topupRequests } = useApp();
  const queue = useMemo(() => buildQueue(topupRequests), [topupRequests]);
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const typeCounts = useMemo(() => {
    return {
      All: queue.length,
      Budget: queue.filter((q) => q.type === "Budget").length,
      "Top-up": queue.filter((q) => q.type === "Top-up").length,
      "New Model": queue.filter((q) => q.type === "New Model").length,
      Device: queue.filter((q) => q.type === "Device").length,
    };
  }, [queue]);

  const filtered = queue.filter((q) => {
    if (typeFilter !== "All" && q.type !== typeFilter) return false;
    if (statusFilter !== "All") {
      if (statusFilter === "Pending" && !["Pending", "CTO Review"].includes(q.status)) return false;
      if (statusFilter === "Approved" && !["Approved", "Partially Approved"].includes(q.status)) return false;
      if (statusFilter === "Rejected" && !["Rejected", "Changes Required"].includes(q.status)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6" data-testid="page-approval-queue">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
          <FileText className="w-3 h-3" /> CFO Portal
        </div>
        <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Budget approvals</h1>
      </div>

      {/* Type tabs */}
      <div className="flex items-center gap-6 border-b border-white/5">
        {["All", "Budget", "Top-up", "New Model", "Device"].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            data-testid={`type-tab-${t.toLowerCase().replace(/\s+/g, "-")}`}
            className={`pb-3 -mb-px text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              typeFilter === t ? "border-fuchsia-400 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t}
            {t === "All" && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-[10px] font-semibold tabular">
                {typeCounts.All}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {["All", "Pending", "Approved", "Rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            data-testid={`status-pill-${s.toLowerCase()}`}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s
                ? "bg-fuchsia-500 text-white border-fuchsia-500"
                : "bg-transparent text-zinc-400 border-white/15 hover:text-zinc-100 hover:border-white/25"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">Request ID</th>
                <th className="text-left py-3 px-4">Request · Project</th>
                <th className="text-left py-3 px-4">Raised by</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const Icon = typeIcons[q.type] || FileText;
                return (
                  <tr
                    key={q.id}
                    data-testid={`row-${q.id}`}
                    className={`border-b border-white/5 transition-colors ${rowTint[q.status] || "hover:bg-white/[0.03]"}`}
                  >
                    <td className="py-3 px-4">
                      <Link to={q.href} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold bg-fuchsia-500/10 border border-fuchsia-500/25 text-fuchsia-200">
                        <Icon className="w-3 h-3" />
                        {q.type}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-zinc-300 tabular text-xs">{q.requestId}</td>
                    <td className="py-3 px-4">
                      <Link to={q.href} className="block hover:text-fuchsia-300">
                        <div className="text-white font-medium">{q.title}</div>
                        <div className="text-[11px] text-zinc-500">{q.project}</div>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-zinc-200 text-sm">{q.raisedBy}</div>
                      <div className="text-[11px] text-zinc-500">
                        {q.raisedRole} · {q.raisedDate}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${statusChip[q.status] || statusChip.Pending}`}>
                        <Circle className="w-2 h-2 fill-current" />
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-white font-semibold tabular">${q.amount.toLocaleString()}</td>
                    <td className="py-3 px-2">
                      <Link to={q.href} data-testid={`open-${q.id}`}>
                        <ChevronRight className="w-4 h-4 text-zinc-500 hover:text-fuchsia-300" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-zinc-500">
                    No requests match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ApprovalQueue;
