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
import { Download, RefreshCw } from "lucide-react";

const Dashboard = () => {
  return (
    <div className="space-y-6" data-testid="page-dashboard">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-semibold text-3xl tracking-tight text-slate-900">
            Budget Consolidation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Token spend across all projects &amp; models · June 2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg gap-2 border-slate-200"
            data-testid="btn-refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg gap-2 border-slate-200"
            data-testid="btn-export"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Hero + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-fade-up">
        <div className="lg:col-span-2">
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
    </div>
  );
};

export default Dashboard;
