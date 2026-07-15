import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { fmtCurrency } from "../../lib/format";
import { useApp } from "../../context/AppContext";
import {
  ClipboardCheck,
  Clock3,
  User,
  AlertTriangle,
  ChevronRight,
  Filter,
  Search,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

const urgencyColor = {
  High: { bg: "bg-red-500/10", text: "text-red-300", border: "border-red-500/30" },
  Normal: { bg: "bg-sky-500/10", text: "text-sky-300", border: "border-sky-500/30" },
  Low: { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/30" },
};

const statusTabs = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "sent-to-cfo", label: "Sent to CFO" },
  { id: "action-required", label: "Action Required" },
  { id: "rejected", label: "Rejected" },
];

const statusMeta = {
  pending: { label: "Pending", chip: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  "sent-to-cfo": { label: "Sent to CFO", chip: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
  "action-required": { label: "Action Required", chip: "bg-orange-500/10 text-orange-300 border-orange-500/30" },
  rejected: { label: "Rejected", chip: "bg-red-500/10 text-red-300 border-red-500/30" },
};

const BudgetReviews = () => {
  const { budgetReviews } = useApp();
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const records = useMemo(
    () => [...budgetReviews].sort((left, right) => getReviewTimestamp(right) - getReviewTimestamp(left)),
    [budgetReviews]
  );

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const statusGroup = getStatusGroup(r);
      if (statusFilter !== "all" && statusGroup !== statusFilter) return false;
      if (urgencyFilter !== "all" && r.urgency !== urgencyFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!r.projectName.toLowerCase().includes(s) && !r.tpm.toLowerCase().includes(s) && !r.client.toLowerCase().includes(s))
          return false;
      }
      return true;
    });
  }, [records, search, urgencyFilter, statusFilter]);

  const totalRequested = records.reduce((s, r) => s + Number(r.requestedBudget || 0), 0);
  const statusCounts = useMemo(() => records.reduce((acc, review) => {
    const key = getStatusGroup(review);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { pending: 0, "sent-to-cfo": 0, "action-required": 0, rejected: 0 }), [records]);
  const highUrgency = records.filter((r) => r.urgency === "High").length;

  return (
    <div className="space-y-6" data-testid="page-budget-reviews">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ClipboardCheck className="w-3 h-3" />
            CTO Portal
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Budget reviews</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {records.length} budget record{records.length === 1 ? "" : "s"} across pending, sent-to-CFO, action-required, and rejected states · {highUrgency} high urgency
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Pending" value={String(statusCounts.pending)} icon={Clock3} tone="warning" testid="stat-pending" />
        <StatCard label="Sent to CFO" value={String(statusCounts["sent-to-cfo"])} icon={ClipboardCheck} tone="magenta" testid="stat-sent-cfo" />
        <StatCard label="Action required" value={String(statusCounts["action-required"])} icon={AlertTriangle} tone="neutral" testid="stat-action-required" />
        <StatCard label="Rejected" value={String(statusCounts.rejected)} icon={CheckCircle2} tone={statusCounts.rejected > 0 ? "negative" : "neutral"} testid="stat-rejected" sub={fmtCurrency(totalRequested)} />
      </div>

      {/* Filters */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              data-testid={`filter-status-${tab.id}`}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                statusFilter === tab.id
                  ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
                  : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {tab.label} ({tab.id === "all" ? records.length : statusCounts[tab.id] || 0})
            </button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project, TPM, or client..."
              data-testid="reviews-search"
              className="w-full h-10 pl-10 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            {["all", "High", "Normal", "Low"].map((u) => (
              <button
                key={u}
                onClick={() => setUrgencyFilter(u)}
                data-testid={`filter-urgency-${u}`}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize ${
                  urgencyFilter === u
                    ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {u === "all" ? `All urgency (${records.length})` : u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {filtered.map((r) => {
          const uc = urgencyColor[r.urgency] || urgencyColor.Normal;
          const requesterLabel = r.requesterRole === "R&D" || ["Testing", "RnD", "Rework"].includes(r.budgetType) ? "R&D" : "TPM";
          const status = statusMeta[getStatusGroup(r)];
          return (
            <Link
              to={`/budget-reviews/${r.id}`}
              key={r.id}
              data-testid={`review-${r.id}`}
              className="bg-[#12121A] rounded-2xl border border-white/5 hover:border-fuchsia-500/30 p-5 block card-hover transition-all"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${uc.bg} ${uc.text} ${uc.border}`}>
                      <AlertTriangle className="w-3 h-3" />
                      {r.urgency}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${status.chip}`}>
                      {status.label}
                    </span>
                    {getStatusGroup(r) === "action-required" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-orange-500/10 text-orange-200 border-orange-500/30">
                        Action Required
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300">
                      {String(r.type || "").replace(/\bSampling\b/g, "Sample").replace(/\bR&D\b/g, "Sample")}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-sky-500/30 bg-sky-500/10 text-sky-200">
                      Raised from {requesterLabel}
                    </span>
                    {r.teamType && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300">
                        {r.teamType} team
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                      <Clock3 className="w-3 h-3" />
                      {new Date(r.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <div className="mt-2 font-display font-semibold text-lg text-white">{r.projectName}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3 h-3" /> {requesterLabel}: {r.tpm}
                    </span>
                    <span>·</span>
                    <span>{r.client}</span>
                    <span>·</span>
                    <span>{["Testing"].includes(r.budgetType) ? `${r.phases} phase${r.phases === 1 ? "" : "s"}` : `${r.tasks} tasks · ${r.phases} phases`}</span>
                    {r.linesFlagged > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-amber-300 font-semibold">{r.linesFlagged} lines flagged</span>
                      </>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-zinc-300 leading-relaxed line-clamp-2">{r.justification}</div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Requested</div>
                  <div className="font-display text-2xl font-semibold text-white tabular">{fmtCurrency(r.requestedBudget, { compact: false })}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5 tabular">
                    vs current {fmtCurrency(r.currentBudget, { compact: false })}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/30 px-2 py-1">
                    <Sparkles className="w-3 h-3 text-fuchsia-300" />
                    <span className="text-[10px] uppercase tracking-widest text-fuchsia-300 font-semibold">
                      {getStatusGroup(r) === "sent-to-cfo" ? "Forwarded amount" : "Submitted amount"}
                    </span>
                    <span className="text-xs font-semibold text-fuchsia-200 tabular">
                      {fmtCurrency(Number(r.modifiedTotal || r.cfoDecision?.amount || r.recommendedBudget || r.requestedBudget || 0), { compact: false })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4 text-[11px] text-zinc-400">
                  <span>AI cost <span className="text-white font-semibold tabular">{fmtCurrency(r.aiCost, { compact: false })}</span></span>
                  <span>Infra <span className="text-white font-semibold tabular">{fmtCurrency(r.infraCost, { compact: false })}</span></span>
                  <span>Subs <span className="text-white font-semibold tabular">{fmtCurrency(r.subsCost, { compact: false })}</span></span>
                  <span>General <span className="text-white font-semibold tabular">{fmtCurrency(r.miscCost, { compact: false })}</span></span>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] text-fuchsia-300 font-medium">
                  Open review workspace <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </Link>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-sm text-zinc-400">No budget records match your filters</div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub, icon: Icon, tone = "neutral", testid }) => {
  const tones = {
    positive: "text-emerald-300",
    negative: "text-red-300",
    warning: "text-amber-300",
    neutral: "text-white",
    magenta: "text-fuchsia-300",
  };
  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4" data-testid={testid}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
            <Icon className={`w-3.5 h-3.5 ${tones[tone]}`} />
          </div>
        )}
      </div>
      <div className={`mt-2 font-display font-semibold text-xl tabular ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>}
    </div>
  );
};

export default BudgetReviews;

const getReviewTimestamp = (review) => new Date(
  review?.cfoDecision?.at
  || review?.ctoAt
  || review?.submittedAt
  || 0
).getTime();

const getStatusGroup = (review = {}) => {
  const status = String(review.status || "").trim().toLowerCase();
  if (status === "rejected-by-cto" || status === "rejected") return "rejected";
  if (status === "returned-to-tpm") return "action-required";
  if (status === "forwarded-cfo" || status === "pending-cfo" || status === "approved" || status === "partial") return "sent-to-cfo";
  return "pending";
};
