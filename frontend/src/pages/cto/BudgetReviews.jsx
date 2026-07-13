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

const BudgetReviews = () => {
  const { budgetReviews } = useApp();
  const [search, setSearch] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const queue = useMemo(
    () => budgetReviews.filter((review) => ["pending-cto", "returned", "resubmitted", "returned-to-tpm"].includes(review.status) || review.stage === "CTO Review"),
    [budgetReviews]
  );

  const filtered = useMemo(() => {
    return queue.filter((r) => {
      if (urgencyFilter !== "all" && r.urgency !== urgencyFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!r.projectName.toLowerCase().includes(s) && !r.tpm.toLowerCase().includes(s) && !r.client.toLowerCase().includes(s))
          return false;
      }
      return true;
    });
  }, [queue, search, urgencyFilter]);

  const totalRequested = queue.reduce((s, r) => s + Number(r.requestedBudget || 0), 0);
  const totalRecommended = queue.reduce((s, r) => s + Number(r.recommendedBudget || r.requestedBudget || 0), 0);
  const highUrgency = queue.filter((r) => r.urgency === "High").length;

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
            {queue.length} budget{queue.length === 1 ? "" : "s"} awaiting your review · {highUrgency} high urgency
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="In queue" value={String(queue.length)} icon={ClipboardCheck} tone="magenta" testid="stat-in-queue" />
        <StatCard label="High urgency" value={String(highUrgency)} icon={AlertTriangle} tone={highUrgency > 0 ? "negative" : "neutral"} testid="stat-high" />
        <StatCard label="Total requested" value={fmtCurrency(totalRequested)} testid="stat-total-req" />
        <StatCard label="Total recommended" value={fmtCurrency(totalRecommended)} tone="positive" testid="stat-total-rec" sub={fmtCurrency(totalRequested - totalRecommended) + " saved"} />
      </div>

      {/* Filters */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4 flex flex-col md:flex-row gap-3">
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
              {u === "all" ? `All (${queue.length})` : u}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {filtered.map((r) => {
          const uc = urgencyColor[r.urgency] || urgencyColor.Normal;
          const delta = r.recommendedBudget - r.requestedBudget;
          const requesterLabel = r.requesterRole === "R&D" || ["Testing", "RnD", "Rework"].includes(r.budgetType) ? "R&D" : "TPM";
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300">
                      {r.type}
                    </span>
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
                    <span>{r.recoveryType}</span>
                    <span>·</span>
                    <span>{r.tasks} tasks · {r.phases} phases</span>
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
                    <span className="text-[10px] uppercase tracking-widest text-fuchsia-300 font-semibold">AI recommends</span>
                    <span className="text-xs font-semibold text-fuchsia-200 tabular">{fmtCurrency(r.recommendedBudget, { compact: false })}</span>
                    {delta !== 0 && (
                      <span className={`text-[10px] font-semibold tabular ml-1 ${delta > 0 ? "text-emerald-300" : "text-red-300"}`}>
                        ({delta > 0 ? "+" : ""}{fmtCurrency(delta, { compact: false })})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4 text-[11px] text-zinc-400">
                  <span>AI cost <span className="text-white font-semibold tabular">{fmtCurrency(r.aiCost, { compact: false })}</span></span>
                  <span>Infra <span className="text-white font-semibold tabular">{fmtCurrency(r.infraCost, { compact: false })}</span></span>
                  <span>Subs <span className="text-white font-semibold tabular">{fmtCurrency(r.subsCost, { compact: false })}</span></span>
                  <span>Misc <span className="text-white font-semibold tabular">{fmtCurrency(r.miscCost, { compact: false })}</span></span>
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
            <div className="text-sm text-zinc-400">No pending reviews match your filters</div>
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
