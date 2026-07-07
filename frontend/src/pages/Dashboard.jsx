import AmountAtRisk from "../components/dashboard/AmountAtRisk";
import KpiGrid from "../components/dashboard/KpiGrid";
import {
  BudgetActualChart,
  ModelExpensesChart,
  InfraStackedChart,
  MonthlySpendChart,
  CategoryDonut,
  UtilizationBars,
  SubscriptionsPanel,
  WorkflowStrip,
} from "../components/dashboard/Charts";
import ProjectsTable from "../components/dashboard/ProjectsTable";
import { Button } from "../components/ui/button";
import { Download, RefreshCw, Plus, ClipboardCheck, GitPullRequest, AlertTriangle, ChevronRight, ShieldCheck, Receipt, Wallet, ArrowUpRightSquare, Lock } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useState } from "react";
import { Link } from "react-router-dom";
import RequestBudgetDialog from "../components/RequestBudgetDialog";
import TpmDashboard from "./tpm/TpmDashboard";
import { BUDGET_REVIEWS, CHANGE_REQUESTS } from "../data/mockTpm";
import { PROJECTS } from "../data/mockProjects";
import { BUFFER, RECOVERY } from "../data/mockCfo";
import { fmtCurrency, fmtPct } from "../lib/format";

const Dashboard = () => {
  const { role, scope, visibleProjects } = useApp();
  const [requestOpen, setRequestOpen] = useState(false);
  const isPL = role === "PL";
  const isCTO = role === "CTO";
  const isCFO = role === "CFO";

  // TPM gets a dedicated portal dashboard
  if (role === "TPM") return <TpmDashboard />;

  const pendingReviews = BUDGET_REVIEWS.filter((r) => r.stage === "CTO Review").length;
  const pendingCRs = CHANGE_REQUESTS.filter((c) => c.stage === "CTO Review").length;
  const highRisk = PROJECTS.filter((p) => p.utilization >= 90).length;
  const overBudget = PROJECTS.filter((p) => p.utilization >= 100).length;
  const bufferUtil = Math.round((BUFFER.consumed / BUFFER.total) * 100);
  const pendingTopups = 3;


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
            {scope !== "all" && <span className="ml-2 text-fuchsia-300">· scope: {scope}</span>}
            {(role === "TPM" || role === "PL") && (
              <span className="ml-2 text-sky-300">· showing {visibleProjects.length} project{visibleProjects.length === 1 ? "" : "s"} you {role === "TPM" ? "requested" : "lead"}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            className="h-9 rounded-lg gap-2 border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200"
            data-testid="btn-refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg gap-2 border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200"
            data-testid="btn-export"
          >
            <Download className="w-3.5 h-3.5" />
            Export
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
              <div className="text-[10px] uppercase tracking-widest font-semibold text-amber-300">Change requests</div>
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

      {/* CFO alert strip — approval queue, top-ups, recovery, buffer */}
      {isCFO && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="cfo-alert-strip">
          <Link to="/approval-queue" data-testid="cfo-tile-queue" className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.10] transition-colors p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-emerald-300">Approval queue</div>
              <div className="text-white font-display font-semibold text-xl tabular">{pendingReviews} pending</div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-300" />
          </Link>
          <Link to="/topups" data-testid="cfo-tile-topups" className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] hover:bg-amber-500/[0.10] transition-colors p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <ArrowUpRightSquare className="w-4 h-4 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-amber-300">Pending top-ups</div>
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
              <div className="text-white font-display font-semibold text-xl tabular">{fmtCurrency(RECOVERY.outstanding)}</div>
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
        </div>
      )}

      {/* Hero + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up">
        <div className="lg:col-span-1">
          <AmountAtRisk />
        </div>
        <div className="lg:col-span-2">
          <KpiGrid />
        </div>
      </div>

      {/* Workflow strip */}
      <WorkflowStrip />

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BudgetActualChart />
        <ModelExpensesChart />
        <InfraStackedChart />
        <SubscriptionsPanel />
        <MonthlySpendChart />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CategoryDonut />
          <UtilizationBars />
        </div>
      </div>

      {/* Projects table */}
      <ProjectsTable />

      <RequestBudgetDialog open={requestOpen} onOpenChange={setRequestOpen} />
    </div>
  );
};

export default Dashboard;
