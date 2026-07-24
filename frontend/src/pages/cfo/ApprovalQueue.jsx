import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BUDGET_REVIEWS, CHANGE_REQUESTS } from "../../data/mockTpm";
import { useApp } from "../../context/AppContext";
import {
  ChevronRight,
  FileText,
  ArrowUpRightSquare,
  GitPullRequest,
  Circle,
} from "lucide-react";

const topupStatusLabel = (status) => {
  switch (status) {
    case "approved": return "Approved";
    case "partial": return "Approved";
    case "rejected": return "Rejected";
    default: return "Pending";
  }
};

const budgetStatusLabel = (review) => {
  if (review.status === "approved" || review.status === "partial") return "Approved";
  if (review.status === "rejected" || review.status === "rejected-by-cto") return "Rejected";
  if (review.status === "returned" || review.status === "returned-to-tpm") return "Returned";
  return "Pending";
};

const changeRequestStatusLabel = (request) => {
  if (request.status === "approved" || request.stage === "Approved") return "Approved";
  if (request.status === "partial") return "Approved";
  if (request.status === "rejected" || request.stage === "Rejected") return "Rejected";
  if (request.status === "returned") return "Returned";
  return "Pending";
};

// Merge budget reviews + budget change requests + change requests into one unified queue
const buildQueue = (budgetReviews, topupRequests, changeRequests) => {
  const items = [];
  let seq = 100;
  const mergedBudgetReviews = BUDGET_REVIEWS.map((seed) => {
    const live = budgetReviews.find((review) => review.id === seed.id);
    return live ? { ...seed, ...live } : seed;
  });
  budgetReviews
    .filter((review) => !mergedBudgetReviews.some((entry) => entry.id === review.id))
    .forEach((review) => mergedBudgetReviews.push(review));

  mergedBudgetReviews.forEach((r) => {
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
      status: budgetStatusLabel(r),
      amount: r.requestedBudget,
      raw: r,
    });
  });
  // Real budget change requests from context
  topupRequests.forEach((r) => {
    seq += 1;
    items.push({
      id: r.id,
      href: `/topup-requests/${r.id}`,
      requestId: `TUR/2026/00${seq}`,
      type: "Top-up",
      title: `${r.phaseName} additional request`,
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
  const mergedChangeRequests = CHANGE_REQUESTS.map((seed) => {
    const live = changeRequests.find((request) => request.id === seed.id);
    return live ? { ...seed, ...live } : seed;
  });
  changeRequests
    .filter((request) => !mergedChangeRequests.some((entry) => entry.id === request.id))
    .forEach((request) => mergedChangeRequests.push(request));

  mergedChangeRequests.forEach((request) => {
    seq += 1;
    items.push({
      id: request.id,
      href: `/approval-queue/change-request/${request.id}`,
      requestId: `CRQ/2026/00${seq}`,
      type: "Change Request",
      title: request.type,
      project: request.projectName,
      subLabel: request.affectedPhase || request.expectedTasks,
      raisedBy: request.requester,
      raisedRole: "TPM",
      raisedDate: new Date(request.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      status: changeRequestStatusLabel(request),
      amount: request.amount,
      raw: request,
    });
  });
  return items;
};

const typeIcons = { Budget: FileText, "Top-up": ArrowUpRightSquare, "Change Request": GitPullRequest };
const typeLabels = {
  Budget: "Budget",
  "Top-up": "Additional Request",
  "Change Request": "Additional Request",
  "Additional Request": "Additional Request",
  All: "All",
};
const statusChip = {
  Pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  Returned: "bg-amber-500/10 text-amber-300 border-amber-500/25",
};

const rowTint = {
  Pending: "hover:bg-fuchsia-500/[0.04]",
  Returned: "hover:bg-amber-500/[0.04]",
};

const ApprovalQueue = () => {
  const { topupRequests, budgetReviews, changeRequests } = useApp();
  const [searchParams] = useSearchParams();
  const queue = useMemo(() => buildQueue(budgetReviews, topupRequests, changeRequests), [budgetReviews, topupRequests, changeRequests]);
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    setTypeFilter(type === "Top-up" || type === "Change Request" ? "Additional Request" : type === "Budget" ? "Budget" : "All");
    setStatusFilter(status && ["Pending", "Approved", "Rejected"].includes(status) ? status : "All");
  }, [searchParams]);

  const typeCounts = useMemo(() => {
    return {
      All: queue.length,
      Budget: queue.filter((q) => q.type === "Budget").length,
      "Additional Request": queue.filter((q) => q.type === "Top-up" || q.type === "Change Request").length,
    };
  }, [queue]);

  const filtered = queue.filter((q) => {
    if (typeFilter === "Budget" && q.type !== "Budget") return false;
    if (typeFilter === "Additional Request" && q.type !== "Top-up" && q.type !== "Change Request") return false;
    if (statusFilter !== "All") {
      if (statusFilter === "Pending" && q.status !== "Pending") return false;
      if (statusFilter === "Approved" && q.status !== "Approved") return false;
      if (statusFilter === "Rejected" && q.status !== "Rejected") return false;
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
        {["All", "Budget", "Additional Request"].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            data-testid={`type-tab-${t.toLowerCase().replace(/\s+/g, "-")}`}
            className={`pb-3 -mb-px text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              typeFilter === t ? "border-fuchsia-400 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {typeLabels[t] || t}
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
                        {typeLabels[q.type] || q.type}
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
