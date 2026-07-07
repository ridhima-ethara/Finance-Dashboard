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
import { Download, RefreshCw, Plus } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useState } from "react";
import RequestBudgetDialog from "../components/RequestBudgetDialog";
import TpmDashboard from "./tpm/TpmDashboard";

const Dashboard = () => {
  const { role, scope, visibleProjects } = useApp();
  const [requestOpen, setRequestOpen] = useState(false);
  const isPL = role === "PL";

  // TPM gets a dedicated portal dashboard
  if (role === "TPM") return <TpmDashboard />;


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
