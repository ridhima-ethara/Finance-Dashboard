import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fmtCurrency, fmtPct, healthColor, utilColor, varianceColor } from "../lib/format";
import { Search, Filter, Plus, ChevronRight, ArrowUpRightSquare, Lock } from "lucide-react";
import { Button } from "../components/ui/button";
import { useApp } from "../context/AppContext";
import { isTpmView } from "../lib/roles";
import RequestBudgetDialog from "../components/RequestBudgetDialog";
import NewProjectDialog from "../components/NewProjectDialog";
import TopupRequestDialog from "../components/TopupRequestDialog";

const Projects = () => {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [requestOpen, setRequestOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const { role, visibleProjects, budgetReviews } = useApp();
  const isPL = role === "PL";
  const isCTO = role === "CTO";
  const isTPM = isTpmView(role);
  const isCFO = role === "CFO";
  const canCreateProject = isCTO || isTPM || role === "R&D";
  const latestBudgetReviewByProject = useMemo(() => {
    const reviewTime = (review) => new Date(
      review?.cfoDecision?.at
      || review?.ctoAt
      || review?.submittedAt
      || 0
    ).getTime();
    return budgetReviews.reduce((map, review) => {
      const current = map.get(review.projectId);
      if (!current || reviewTime(review) > reviewTime(current)) map.set(review.projectId, review);
      return map;
    }, new Map());
  }, [budgetReviews]);

  const filtered = visibleProjects.filter((p) => {
    if (filter === "over" && p.utilization < 100) return false;
    if (filter === "watch" && !(p.utilization >= 85 && p.utilization < 100)) return false;
    if (filter === "healthy" && p.utilization >= 85) return false;
    return (
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.client.toLowerCase().includes(q.toLowerCase()) ||
      p.pl.toLowerCase().includes(q.toLowerCase())
    );
  });

  return (
    <div className="space-y-6" data-testid="page-projects">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-semibold text-3xl tracking-tight text-white">Projects</h1>
          <p className="text-sm text-zinc-500 mt-1">
            All active engagements · click a project to drill in
            {isCFO && <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-400"><Lock className="w-2.5 h-2.5" /> Read-only</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPL && (
            <Button
              onClick={() => setRequestOpen(true)}
              className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-2 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]"
              data-testid="btn-request-budget-projects"
            >
              <Plus className="w-4 h-4" />
              Request Budget
            </Button>
          )}
          {canCreateProject && (
            <Button
              onClick={() => setNewProjectOpen(true)}
              className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-2 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]"
              data-testid="btn-new-project"
            >
              <Plus className="w-4 h-4" />
              New project
            </Button>
          )}
          {/* Raise top-up removed from Projects list — available inside each project's detail page */}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            data-testid="projects-search"
            placeholder="Search project, client, PL…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#12121A] border border-white/10 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
          />
        </div>
        {["all", "healthy", "watch", "over"].map((f) => (
          <button
            key={f}
            data-testid={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={`h-10 px-3 rounded-lg border text-xs font-medium capitalize transition-colors ${
              filter === f
                ? "bg-fuchsia-500/10 border-fuchsia-500/40 text-fuchsia-400"
                : "bg-[#12121A] border-white/10 text-zinc-400 hover:bg-white/5"
            }`}
          >
            {f === "all" ? "All projects" : f}
          </button>
        ))}
        <button className="h-10 px-3 rounded-lg border border-white/10 bg-[#12121A] text-zinc-400 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-white/5">
          <Filter className="w-3.5 h-3.5" />
          More filters
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const c = healthColor(p.health);
          const latestReview = latestBudgetReviewByProject.get(p.id);
          const budgetState = getProjectBudgetCardState(p, latestReview);
          const isLocked = Boolean(p.pendingBudgetSubmission);
          const displayActual = isCFO ? Number(p.cfoActualSpend || p.actualSpend || 0) : Number(p.actualSpend || 0);
          const displayVariance = isCFO ? Number(p.cfoVariance || p.variance || 0) : Number(p.variance || 0);
          const displayUtilization = isCFO ? Number(p.cfoUtilization || p.utilization || 0) : Number(p.utilization || 0);
          const displayExceeded = Math.max(Number(-displayVariance || 0), 0);
          return (
            <Link
              to={`/projects/${p.id}`}
              key={p.id}
              data-testid={`project-card-${p.id}`}
              className={`group bg-[#12121A] rounded-2xl border border-white/10 p-5 card-hover ${isLocked ? "opacity-70" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-zinc-500">{p.client}</div>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                      p.type === "R&D" ? "bg-violet-500/10 border-violet-500/30 text-violet-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    }`}>
                      {p.type}
                    </span>
                    {budgetState.actionRequired && isCTO && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-orange-500/10 border-orange-500/30 text-orange-200">
                        Action Required
                      </span>
                    )}
                    {isLocked && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-amber-500/10 border-amber-500/30 text-amber-300">
                        Pending approval
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 font-display font-semibold text-lg text-white truncate">
                    {p.name}
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.bg} ${c.border} ${c.text}`}>
                  {c.label}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] uppercase text-zinc-500 font-semibold tracking-widest">{budgetState.label}</div>
                  <div className={`text-sm font-semibold tabular ${budgetState.valueClass}`}>{fmtCurrency(budgetState.amount)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-zinc-500 font-semibold tracking-widest">{isCFO ? "Actual" : "Exceeded"}</div>
                  <div className={`text-sm font-semibold tabular ${isCFO ? "text-white" : displayExceeded > 0 ? "text-red-300" : "text-zinc-400"}`}>
                    {fmtCurrency(isCFO ? displayActual : displayExceeded)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-zinc-500 font-semibold tracking-widest">Variance</div>
                  <div className={`text-sm font-semibold tabular ${varianceColor(displayVariance)}`}>
                    {displayVariance > 0 ? "+" : ""}
                    {fmtCurrency(displayVariance)}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-zinc-400">Utilization</span>
                  <span className={`font-semibold ${utilColor(displayUtilization)}`}>{fmtPct(displayUtilization)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(displayUtilization, 100)}%`,
                      background: displayUtilization >= 100 ? "#EF4444" : displayUtilization >= 85 ? "#F59E0B" : "#10B981",
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-zinc-500">PL · {p.pl}</span>
                <span className="text-fuchsia-400 font-medium inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                  Open <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <RequestBudgetDialog open={requestOpen} onOpenChange={setRequestOpen} />
      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
      <TopupRequestDialog open={topupOpen} onOpenChange={setTopupOpen} />
    </div>
  );
};

const getProjectBudgetCardState = (project, review) => {
  if (!review) {
    return Number(project.approvedBudget || 0) > 0
      ? { label: "Approved", amount: Number(project.approvedBudget || 0), valueClass: "text-white" }
      : { label: "Pending", amount: 0, valueClass: "text-amber-300" };
  }

  if (["approved", "partial"].includes(review.status)) {
    return {
      label: "Approved",
      amount: Number(project.approvedBudget || review.cfoDecision?.amount || review.modifiedTotal || review.requestedBudget || 0),
      valueClass: "text-white",
    };
  }

  if (review.status === "returned-to-tpm") {
    return {
      label: "Returned",
      amount: Number(review.requestedBudget || review.modifiedTotal || 0),
      valueClass: "text-amber-300",
      actionRequired: true,
    };
  }

  if (review.status === "rejected" || review.status === "rejected-by-cto") {
    return {
      label: "Rejected",
      amount: Number(project.approvedBudget || 0),
      valueClass: "text-red-300",
    };
  }

  return {
    label: "Pending",
    amount: Number(review.modifiedTotal || review.requestedBudget || 0),
    valueClass: "text-amber-300",
  };
};

export default Projects;
