import AmountAtRisk from "../components/dashboard/AmountAtRisk";
import KpiGrid from "../components/dashboard/KpiGrid";
import {
  BudgetActualChart,
  InfraStackedChart,
  MonthlySpendChart,
  MonthEndActualChart,
  CategoryDonut,
  UtilizationBars,
} from "../components/dashboard/Charts";
import ProjectsTable from "../components/dashboard/ProjectsTable";
import CostPerTaskView from "../components/dashboard/CostPerTaskView";
import { Button } from "../components/ui/button";
import { Download, RefreshCw, Plus, ClipboardCheck, GitPullRequest, AlertTriangle, ChevronRight, ShieldCheck, Receipt, Wallet, ArrowUpRightSquare, Lock, PackageCheck } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useState, useMemo } from "react";
import { isTpmView } from "../lib/roles";
import { Link } from "react-router-dom";
import RequestBudgetDialog from "../components/RequestBudgetDialog";
import TpmDashboard from "./tpm/TpmDashboard";
import CtoDashboard from "./cto/CtoDashboard";
import { fmtCurrency, fmtPct } from "../lib/format";
import { summarizeLoggedProject } from "../lib/projectMetrics";
import ItDashboard from "./it/ItDashboard";
import { toast } from "sonner";

const escapeCsv = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const downloadCsv = (filename, rows) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCsv(row[header])).join(","));
  });
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const Dashboard = () => {
  const {
    role,
    visibleProjects,
    batchDeliveries,
    topupRequests,
    budgetReviews,
    changeRequests,
    bufferOverview,
    projects,
    taskLogs,
    itMonthlyActuals,
    refreshAppData,
  } = useApp();
  const [requestOpen, setRequestOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const isPL = role === "PL";
  const isCTO = role === "CTO";
  const isCFO = role === "CFO";

  // TPM gets a dedicated portal dashboard
  if (isTpmView(role)) return <TpmDashboard />;
  // CTO gets a project-focused ops dashboard (no CFO-style whole-budget views)
  if (role === "CTO") return <CtoDashboard />;
  if (role === "IT") return <ItDashboard />;
  if (!isCFO) return <LeadDashboardView />;

  const cfoProjects = selectedProjectId === "all"
    ? visibleProjects
    : visibleProjects.filter((project) => project.id === selectedProjectId);
  const selectedProjectIds = new Set(cfoProjects.map((project) => project.id));
  const pendingBatchDeliveries = batchDeliveries.filter(
    (delivery) => delivery.status === "pending-cfo" && selectedProjectIds.has(delivery.projectId)
  ).length;

  const pendingBudgetApprovals = budgetReviews.filter((review) => review.status === "forwarded-cfo" && selectedProjectIds.has(review.projectId)).length;
  const pendingCRs = changeRequests.filter((request) => request.stage === "CFO Review" && selectedProjectIds.has(request.projectId)).length;
  const highRisk = cfoProjects.filter((project) => project.utilization >= 90).length;
  const overBudget = cfoProjects.filter((project) => project.utilization >= 100).length;
  const bufferUtil = bufferOverview.total > 0 ? Math.round((bufferOverview.consumed / bufferOverview.total) * 100) : 0;
  const pendingTopups = topupRequests.filter((request) => request.status === "pending-cfo" && selectedProjectIds.has(request.projectId)).length;
  const pendingReviews = pendingBudgetApprovals + pendingTopups + pendingCRs;
  const outstandingRecovery = cfoProjects
    .filter((project) => project.recoverableFromClient)
    .reduce((sum, project) => sum + Math.max(0, Number(project.cfoActualSpend || project.actualSpend || 0) - Number(project.recoveredAmount || 0)), 0);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshAppData();
    toast.success("Dashboard refreshed", {
      description: "Latest saved finance data has been reloaded.",
    });
    setTimeout(() => setIsRefreshing(false), 250);
  };

  const handleExport = () => {
    setIsExporting(true);
    const rows = cfoProjects.map((project) => {
      const usage = summarizeLoggedProject(project, taskLogs);
      const actualSpend = Number(project.cfoActualSpend || project.actualSpend || usage.loggedSpend || 0);
      const approvedBudget = Number(project.approvedBudget || 0);
      const remaining = Number(project.cfoRemaining ?? (approvedBudget - actualSpend));
      const utilization = Number(project.cfoUtilization ?? (approvedBudget > 0 ? Math.round((actualSpend / approvedBudget) * 100) : 0));
      const modelActual = Number(project.itActuals?.modelActual || itMonthlyActuals?.[project.id]?.modelActual || 0);
      const infraActual = Number(project.itActuals?.infraActual || itMonthlyActuals?.[project.id]?.infraActual || 0);
      const subsActual = Number(project.itActuals?.subsActual || itMonthlyActuals?.[project.id]?.subsActual || 0);
      return {
        Project: project.name,
        Client: project.client || project.clientProjectName || "",
        Type: project.type || "",
        Status: project.status || "",
        ApprovedBudget: approvedBudget,
        ActualSpend: actualSpend,
        Remaining: remaining,
        UtilizationPct: utilization,
        BufferPct: Number(project.buffer || 0),
        RecoveredAmount: Number(project.recoveredAmount || 0),
        TopModel: project.cfoTopModel || project.topModel || "",
        ModelActual: modelActual,
        InfraActual: infraActual,
        SubsActual: subsActual,
      };
    });

    if (!rows.length) {
      toast.error("Nothing to export", {
        description: "No visible CFO projects are available in the current view.",
      });
      setIsExporting(false);
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`cfo_dashboard_${stamp}.csv`, rows);
    toast.success("Dashboard exported", {
      description: `${rows.length} project row${rows.length === 1 ? "" : "s"} downloaded as CSV.`,
    });
    setTimeout(() => setIsExporting(false), 250);
  };

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <span className="w-6 h-px bg-fuchsia-400" />
            Portfolio Overview
          </div>
          <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">
            Financial Command Center
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time budget, forecast &amp; burn across all AI engagements · June 2026
            {(isTpmView(role) || role === "PL") && (
              <span className="ml-2 text-sky-300">· showing {visibleProjects.length} project{visibleProjects.length === 1 ? "" : "s"} you {isTpmView(role) ? "requested" : "lead"}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative" data-testid="cfo-project-filter">
            <span className="sr-only">Filter dashboard by project</span>
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="h-9 min-w-[220px] max-w-[300px] rounded-lg border border-white/10 bg-[#12121A] px-3 text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              data-testid="cfo-project-filter-select"
            >
              <option value="all">All projects ({visibleProjects.length})</option>
              {visibleProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          {isPL && (
            <Button
              size="sm"
              onClick={() => setRequestOpen(true)}
              className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-2 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]"
              data-testid="btn-request-budget"
            >
              <Plus className="w-3.5 h-3.5" />
              Request Budget
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 rounded-lg gap-2 border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200"
            data-testid="btn-refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="h-9 rounded-lg gap-2 border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200"
            data-testid="btn-export"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </div>
      </div>

      {/* CTO alert strip — pending reviews, CRs, high-risk projects */}
      {isCTO && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="cto-alert-strip">
          <Link
            to="/budget-reviews"
            data-testid="cto-tile-reviews"
            className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] hover:bg-fuchsia-500/[0.10] transition-colors p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300">Budget reviews</div>
              <div className="text-white font-display font-semibold text-xl tabular">{pendingReviews} pending</div>
            </div>
            <ChevronRight className="w-4 h-4 text-fuchsia-300" />
          </Link>
          <Link
            to="/change-requests"
            data-testid="cto-tile-crs"
            className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] hover:bg-amber-500/[0.10] transition-colors p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <GitPullRequest className="w-4 h-4 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-amber-300">Additional requests</div>
              <div className="text-white font-display font-semibold text-xl tabular">{pendingCRs} pending</div>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-300" />
          </Link>
          <Link
            to="/monitoring"
            data-testid="cto-tile-highrisk"
            className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] hover:bg-red-500/[0.10] transition-colors p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-red-300">High-risk projects</div>
              <div className="text-white font-display font-semibold text-xl tabular">{highRisk}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-red-300" />
          </Link>
          <Link
            to="/projects"
            data-testid="cto-tile-overbudget"
            className="rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition-colors p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-zinc-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-400">Over budget</div>
              <div className="text-white font-display font-semibold text-xl tabular">{overBudget}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </Link>
        </div>
      )}

      {/* CFO alert strip — approval queue, budget changes, recovery, buffer, batch deliveries */}
      {isCFO && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3" data-testid="cfo-alert-strip">
          <Link to="/approval-queue?status=Pending" data-testid="cfo-tile-queue" className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.10] transition-colors p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-emerald-300">Approval queue</div>
              <div className="text-white font-display font-semibold text-xl tabular">{pendingReviews} pending</div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-300" />
          </Link>
          <Link to="/approval-queue?type=Top-up&status=Pending" data-testid="cfo-tile-topups" className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] hover:bg-amber-500/[0.10] transition-colors p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <ArrowUpRightSquare className="w-4 h-4 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-amber-300">Pending additional requests</div>
              <div className="text-white font-display font-semibold text-xl tabular">{pendingTopups}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-300" />
          </Link>
          <Link to="/recovery" data-testid="cfo-tile-recovery" className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.06] hover:bg-fuchsia-500/[0.10] transition-colors p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300">Outstanding recovery</div>
              <div className="text-white font-display font-semibold text-xl tabular">{fmtCurrency(outstandingRecovery)}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-fuchsia-300" />
          </Link>
          <Link to="/buffer" data-testid="cfo-tile-buffer" className="rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition-colors p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              <Lock className="w-4 h-4 text-zinc-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-400">Buffer utilization</div>
              <div className="text-white font-display font-semibold text-xl tabular">{fmtPct(bufferUtil)}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </Link>
          <Link to="/batch-deliveries?filter=pending" data-testid="cfo-tile-batches" className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.06] hover:bg-sky-500/[0.10] transition-colors p-4 flex items-center gap-3 relative">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
              <PackageCheck className="w-4 h-4 text-sky-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-sky-300">Batch deliveries</div>
              <div className="text-white font-display font-semibold text-xl tabular">{pendingBatchDeliveries} awaiting</div>
            </div>
            {pendingBatchDeliveries > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-400 animate-pulse" title="New pending" />
            )}
            <ChevronRight className="w-4 h-4 text-sky-300" />
          </Link>
        </div>
      )}

      {/* Hero + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch animate-fade-up">
        <div className="lg:col-span-1">
          <AmountAtRisk projectsOverride={cfoProjects} />
        </div>
        <div className="lg:col-span-2 h-full">
          <KpiGrid projectsOverride={cfoProjects} />
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-fr">
        <BudgetActualChart projectsOverride={cfoProjects} />
        <UtilizationBars projectsOverride={cfoProjects} />
        <InfraStackedChart projectsOverride={cfoProjects} />
        <MonthlySpendChart projectsOverride={cfoProjects} />
        <MonthEndActualChart projectsOverride={cfoProjects} />
        <CategoryDonut projectsOverride={cfoProjects} />
      </div>

      {/* Projects table */}
      <ProjectsTable projectsOverride={cfoProjects} />

      {/* CFO — cost per task/trajectory breakdown */}
      {isCFO && <CostPerTaskView projectsOverride={cfoProjects} />}

      <RequestBudgetDialog open={requestOpen} onOpenChange={setRequestOpen} />
    </div>
  );
};

const LeadDashboardView = () => {
  const { visibleProjects, taskLogs, role } = useApp();
  const summaries = useMemo(
    () => visibleProjects.map((project) => summarizeLoggedProject(project, taskLogs)),
    [visibleProjects, taskLogs]
  );
  const approved = visibleProjects.reduce((sum, project) => sum + Number(project.approvedBudget || 0), 0);
  const logged = summaries.reduce((sum, summary) => sum + summary.loggedSpend, 0);
  const targetTasks = summaries.reduce((sum, summary) => sum + summary.targetTasks, 0);
  const doneTasks = summaries.reduce((sum, summary) => sum + summary.loggedTasks, 0);
  const inputTokens = summaries.reduce((sum, summary) => sum + summary.inputTokens, 0);
  const outputTokens = summaries.reduce((sum, summary) => sum + summary.outputTokens, 0);

  return (
    <div className="space-y-6" data-testid="page-lead-dashboard">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-amber-300">
          <span className="w-6 h-px bg-amber-400" />
          {role} Portal
        </div>
        <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">Owned delivery dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Logged spend, task progress, and token consumption only. Actual financial comparisons remain CFO-only.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <LeadStat label="Active projects" value={String(visibleProjects.length)} />
        <LeadStat label="Logged spend" value={fmtCurrency(logged, { compact: false })} />
        <LeadStat label="Target progress" value={targetTasks > 0 ? `${doneTasks}/${targetTasks}` : `${doneTasks}`} />
        <LeadStat label="Budget coverage" value={approved > 0 ? fmtPct(Math.round((logged / approved) * 100)) : "0%"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LeadPanel title="Token usage">
          <div className="grid grid-cols-2 gap-3">
            <LeadMini label="Input tokens" value={inputTokens.toLocaleString()} />
            <LeadMini label="Output tokens" value={outputTokens.toLocaleString()} />
          </div>
        </LeadPanel>
        <LeadPanel title="Logged spend vs approved">
          <div className="grid grid-cols-2 gap-3">
            <LeadMini label="Approved" value={fmtCurrency(approved, { compact: false })} />
            <LeadMini label="Logged" value={fmtCurrency(logged, { compact: false })} />
          </div>
        </LeadPanel>
      </div>

      <ProjectsTable />
    </div>
  );
};

const LeadStat = ({ label, value }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4">
    <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
    <div className="mt-2 font-display font-semibold text-2xl text-white tabular">{value}</div>
  </div>
);

const LeadPanel = ({ title, children }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
    <div className="font-display font-semibold text-[15px] text-white mb-3">{title}</div>
    {children}
  </div>
);

const LeadMini = ({ label, value }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="mt-1 text-sm font-semibold text-white tabular">{value}</div>
  </div>
);

export default Dashboard;
