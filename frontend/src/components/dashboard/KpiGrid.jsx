import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Activity,
  Gauge,
  Flame,
  Clock3,
  CheckSquare,
} from "lucide-react";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { useApp } from "../../context/AppContext";
import { summarizeLoggedProject } from "../../lib/projectMetrics";

// Individual KPI card - finance-grade
const KpiCard = ({ label, value, sublabel, delta, tone = "neutral", icon: Icon, testid }) => {
  const toneMap = {
    positive: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    negative: "text-red-400 bg-red-500/10 border-red-500/20",
    warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    neutral: "text-zinc-400 bg-white/5 border-white/10",
    magenta: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20",
  };
  return (
    <div
      data-testid={testid}
      className="h-full bg-[#12121A] rounded-2xl border border-white/5 p-5 card-hover cursor-pointer relative overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {label}
        </div>
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-zinc-400" />
          </div>
        )}
      </div>
      <div className="mt-3 font-display font-semibold text-3xl tabular text-white">
        {value}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-500 tabular">{sublabel}</div>
        {delta && (
          <div className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${toneMap[tone]}`}>
            {tone === "positive" ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : tone === "negative" ? (
              <ArrowDownRight className="w-3 h-3" />
            ) : null}
            {delta}
          </div>
        )}
      </div>
    </div>
  );
};

const KpiGrid = ({ projectsOverride = null }) => {
  const { role, visibleProjects, budgetReviews, topupRequests, changeRequests, taskLogs } = useApp();
  const dashboardProjects = projectsOverride || visibleProjects;
  const dashboardProjectIds = new Set(dashboardProjects.map((project) => project.id));
  const summary = dashboardProjects.reduce((acc, project) => {
    const usage = summarizeLoggedProject(project, taskLogs);
    const spend = Number(project.cfoActualSpend || project.actualSpend || usage.loggedSpend || 0);
    acc.approvedBudget += Number(project.approvedBudget || 0);
    acc.actualSpend += spend;
    acc.remaining += Math.max(0, Number(project.approvedBudget || 0) - spend);
    acc.activeProjects += 1;
    acc.burnRate += Number(project.cfoBurnRate || usage.runRate || 0);
    return acc;
  }, {
    approvedBudget: 0,
    actualSpend: 0,
    remaining: 0,
    activeProjects: 0,
    burnRate: 0,
  });
  const utilization = summary.approvedBudget > 0 ? Math.round((summary.actualSpend / summary.approvedBudget) * 100) : 0;
  const cpi = summary.actualSpend > 0 ? Number((summary.approvedBudget / summary.actualSpend).toFixed(2)) : 0;
  const cashRunwayDays = summary.burnRate > 0 ? Math.round(summary.remaining / summary.burnRate) : 0;
  const scopedBudgetReviews = budgetReviews.filter((review) => dashboardProjectIds.has(review.projectId));
  const scopedTopups = topupRequests.filter((request) => dashboardProjectIds.has(request.projectId));
  const scopedChangeRequests = changeRequests.filter((request) => dashboardProjectIds.has(request.projectId));
  const pendingApprovals = scopedBudgetReviews.filter((review) => ["pending-cto", "forwarded-cfo", "returned"].includes(review.status) || review.stage === "CTO Review" || review.stage === "CFO Review").length
    + scopedTopups.filter((request) => request.status === "pending-cto" || request.status === "pending-cfo").length
    + scopedChangeRequests.filter((request) => request.stage === "CTO Review" || request.stage === "CFO Review").length;
  const pendingApprovalValue = scopedBudgetReviews.reduce((sum, review) => sum + Number(review.modifiedTotal || review.requestedBudget || 0), 0)
    + scopedTopups.reduce((sum, request) => sum + Number(request.amount || 0), 0)
    + scopedChangeRequests.reduce((sum, request) => sum + Number(request.amount || 0), 0);
  const cpiTone = cpi >= 1 ? "positive" : "negative";
  const runwayTone = cashRunwayDays >= 30 ? "positive" : cashRunwayDays >= 14 ? "warning" : "negative";
  const hideCfoCards = role === "CFO";

  const cards = [
    {
      testid: "kpi-approved-budget",
      label: "Approved Budget",
      icon: Wallet,
      value: fmtCurrency(summary.approvedBudget),
      sublabel: `${summary.activeProjects} active projects · locked`,
    },
    {
      testid: "kpi-actual-spend",
      label: "Actual Spend",
      icon: Activity,
      value: fmtCurrency(summary.actualSpend),
      sublabel: `${fmtPct(utilization)} of approved`,
      delta: `${fmtPct(utilization)} util`,
      tone: utilization >= 100 ? "negative" : utilization >= 85 ? "warning" : "positive",
    },
    {
      testid: "kpi-cpi",
      label: "Cost Performance (CPI)",
      icon: Gauge,
      value: cpi.toFixed(2),
      sublabel: cpi >= 1 ? "Under budget · efficient" : "Over budget · investigate",
      delta: cpi >= 1 ? "Efficient" : "Overrun",
      tone: cpiTone,
    },
    {
      testid: "kpi-burn-rate",
      label: "Burn Rate",
      icon: Flame,
      value: `${fmtCurrency(summary.burnRate, { compact: false })}/day`,
      sublabel: "Live logged daily run rate",
    },
    {
      testid: "kpi-runway",
      label: "Cash Runway",
      icon: Clock3,
      value: cashRunwayDays ? `${cashRunwayDays} days` : "—",
      sublabel: "At current burn rate",
      delta: cashRunwayDays >= 30 ? "Comfortable" : cashRunwayDays >= 14 ? "Monitor" : "Critical",
      tone: runwayTone,
      hidden: hideCfoCards,
    },
    {
      testid: "kpi-pending-approvals",
      label: "Pending Approvals",
      icon: CheckSquare,
      value: `${pendingApprovals}`,
      sublabel: `${fmtCurrency(pendingApprovalValue)} awaiting decision`,
      delta: "Action needed",
      tone: "magenta",
      hidden: hideCfoCards,
    },
  ];

  return (
    <div
      className={`grid gap-4 auto-rows-fr ${role === "CFO" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}
      data-testid="kpi-grid"
    >
      {cards
        .filter((card) => !card.hidden)
        .map((card) => (
          <KpiCard key={card.testid} {...card} />
        ))}
    </div>
  );
};

export default KpiGrid;
