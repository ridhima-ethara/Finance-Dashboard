import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  ArrowUpRightSquare,
  ChevronRight,
  Circle,
  ClipboardCheck,
  FileText,
  GitPullRequest,
  Search,
} from "lucide-react";

const TYPE_LABELS = {
  Budget: "Budget",
  "Budget Change": "Additional Request",
  "Change Request": "Additional Request",
};

const TYPE_ICONS = {
  Budget: FileText,
  "Budget Change": ArrowUpRightSquare,
  "Change Request": GitPullRequest,
};

const STATUS_CHIP = {
  Pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Returned: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  Rejected: "bg-red-500/15 text-red-300 border-red-500/30",
};

const ROW_TINT = {
  Pending: "bg-amber-500/[0.025] hover:bg-amber-500/[0.055]",
  Returned: "bg-orange-500/[0.025] hover:bg-orange-500/[0.055]",
  Rejected: "hover:bg-red-500/[0.04]",
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const getBudgetStatus = (review = {}) => {
  const status = String(review.status || "").toLowerCase();
  if (status === "approved" || status === "partial") return "Approved";
  if (status === "rejected" || status === "rejected-by-cto") return "Rejected";
  if (status === "returned" || status === "returned-to-tpm") return "Returned";
  return "Pending";
};

const getAdditionalStatus = (request = {}) => {
  const status = String(request.status || "").toLowerCase();
  const stage = String(request.stage || "").toLowerCase();
  if (status === "approved" || stage === "approved") return "Approved";
  if (status === "partial") return "Approved";
  if (status === "rejected" || stage === "rejected") return "Rejected";
  if (status === "returned" || stage === "returned") return "Returned";
  return "Pending";
};

const buildQueue = (budgetReviews, topupRequests, changeRequests) => {
  const budgets = budgetReviews.map((review, index) => ({
    id: review.id,
    href: `/budget-reviews/${review.id}`,
    requestId: review.requestId || `BBR/${String(index + 1).padStart(5, "0")}`,
    category: "budgets",
    type: "Budget",
    title: review.type || `${review.budgetType || "Project"} budget`,
    project: review.projectName || "Unknown project",
    raisedBy: review.tpm || review.requester || "Project team",
    raisedRole: review.requesterRole || (review.teamType === "R&D" ? "R&D" : "TPM"),
    raisedAt: review.submittedAt,
    status: getBudgetStatus(review),
    amount: Number(review.cfoDecision?.amount || review.modifiedTotal || review.requestedBudget || 0),
  }));

  const budgetChanges = topupRequests.map((request, index) => ({
    id: request.id,
    href: `/topup-requests/${request.id}`,
    requestId: request.requestId || `BCR/${String(index + 1).padStart(5, "0")}`,
    category: "additional",
    type: "Budget Change",
    title: request.phaseName ? `${request.phaseName} additional request` : "Additional budget request",
    project: request.projectName || "Unknown project",
    raisedBy: request.requester || "Project team",
    raisedRole: request.requesterRole || "TPM",
    raisedAt: request.requestedAt || request.createdAt,
    status: getAdditionalStatus(request),
    amount: Number(request.ctoDecision?.amount || request.amount || 0),
  }));

  const changes = changeRequests.map((request, index) => ({
    id: request.id,
    href: `/change-requests?request=${encodeURIComponent(request.id)}`,
    requestId: request.requestId || `CRQ/${String(index + 1).padStart(5, "0")}`,
    category: "additional",
    type: "Change Request",
    title: request.type || "Project additional request",
    project: request.projectName || "Unknown project",
    raisedBy: request.requester || "Project team",
    raisedRole: request.requesterRole || "TPM",
    raisedAt: request.createdAt,
    status: getAdditionalStatus(request),
    amount: Number(request.ctoDecision?.amount || request.amount || 0),
  }));

  return [...budgets, ...budgetChanges, ...changes].sort(
    (left, right) => new Date(right.raisedAt || 0).getTime() - new Date(left.raisedAt || 0).getTime()
  );
};

const BudgetReviews = () => {
  const { budgetReviews, topupRequests, changeRequests } = useApp();
  const [category, setCategory] = useState("budgets");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  const queue = useMemo(
    () => buildQueue(budgetReviews, topupRequests, changeRequests),
    [budgetReviews, topupRequests, changeRequests]
  );
  const categoryItems = useMemo(() => queue.filter((item) => item.category === category), [queue, category]);
  const statusCounts = useMemo(() => ({
    All: categoryItems.length,
    Pending: categoryItems.filter((item) => item.status === "Pending").length,
    Approved: categoryItems.filter((item) => item.status === "Approved").length,
    Returned: categoryItems.filter((item) => item.status === "Returned").length,
    Rejected: categoryItems.filter((item) => item.status === "Rejected").length,
  }), [categoryItems]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return categoryItems.filter((item) => {
      if (statusFilter !== "All" && item.status !== statusFilter) return false;
      if (!needle) return true;
      return [item.requestId, item.title, item.project, item.raisedBy, item.type]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [categoryItems, search, statusFilter]);

  const changeCategory = (nextCategory) => {
    setCategory(nextCategory);
    setStatusFilter("All");
  };

  return (
    <div className="space-y-6" data-testid="page-budget-reviews">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
          <ClipboardCheck className="w-3 h-3" /> CTO Portal
        </div>
        <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Budget reviews</h1>
        <p className="mt-1 text-sm text-zinc-400">Review budgets and additional project requests from one approval queue.</p>
      </div>

      <div className="flex items-center gap-7 border-b border-white/5">
        {[
          { id: "budgets", label: "Budgets", count: queue.filter((item) => item.category === "budgets").length },
          { id: "additional", label: "Additional Requests", count: queue.filter((item) => item.category === "additional").length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => changeCategory(tab.id)}
            data-testid={`review-category-${tab.id}`}
            className={`pb-3 -mb-px inline-flex items-center gap-2 border-b-2 text-sm font-medium transition-colors ${
              category === tab.id ? "border-fuchsia-400 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
            <span className="rounded-full bg-fuchsia-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular text-fuchsia-300">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {["All", "Pending", "Approved", "Returned", "Rejected"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              data-testid={`review-status-${status.toLowerCase().replace(/\s+/g, "-")}`}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === status
                  ? "bg-fuchsia-500 text-white border-fuchsia-500"
                  : "bg-transparent text-zinc-400 border-white/15 hover:text-zinc-100 hover:border-white/25"
              }`}
            >
              {status} ({statusCounts[status] || 0})
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by request, project, or requester..."
            data-testid="reviews-search"
            className="w-full h-10 pl-10 pr-3 rounded-lg bg-[#12121A] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
          />
        </div>
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">Request ID</th>
                <th className="text-left py-3 px-4">Request · Project</th>
                <th className="text-left py-3 px-4">Raised by</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="w-9" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const Icon = TYPE_ICONS[item.type] || FileText;
                return (
                  <tr key={`${item.type}-${item.id}`} className={`border-b border-white/5 transition-colors ${ROW_TINT[item.status] || "hover:bg-white/[0.03]"}`} data-testid={`review-row-${item.id}`}>
                    <td className="py-3 px-4">
                      <Link to={item.href} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold bg-fuchsia-500/10 border border-fuchsia-500/25 text-fuchsia-200">
                        <Icon className="w-3 h-3" /> {TYPE_LABELS[item.type]}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-xs tabular text-zinc-300">{item.requestId}</td>
                    <td className="py-3 px-4">
                      <Link to={item.href} className="block hover:text-fuchsia-300">
                        <div className="font-medium text-white">{item.title}</div>
                        <div className="text-[11px] text-zinc-500">{item.project}</div>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-zinc-200">{item.raisedBy}</div>
                      <div className="text-[11px] text-zinc-500">{item.raisedRole} · {formatDate(item.raisedAt)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${STATUS_CHIP[item.status] || STATUS_CHIP.Pending}`}>
                        <Circle className="w-2 h-2 fill-current" /> {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold tabular text-white">${item.amount.toLocaleString()}</td>
                    <td className="py-3 px-2">
                      <Link to={item.href} aria-label={`Open ${item.requestId}`}><ChevronRight className="w-4 h-4 text-zinc-500 hover:text-fuchsia-300" /></Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-sm text-zinc-500">No requests match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BudgetReviews;
