import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cpu, Filter, Layers, ListChecks, TrendingDown, TrendingUp } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import {
  buildDeliverableCostMetrics,
  summarizeItProjectActuals,
  summarizeLoggedProject,
} from "../../lib/projectMetrics";

const getRequestedTaskCount = (project, review) => {
  const phaseTaskTotal = Array.isArray(project?.phases)
    ? project.phases.reduce((sum, phase) => sum + Number(phase?.totalTasks || phase?.tasks || 0), 0)
    : 0;

  return Number(project?.totalTasks || phaseTaskTotal || review?.tasks || 0);
};

const CostPerTaskView = ({ projectsOverride = null }) => {
  const { projects, budgetReviews, taskLogs, itMonthlyActuals } = useApp();
  const dashboardProjects = projectsOverride || projects;
  const [sort, setSort] = useState("variance");
  const latestReviewByProject = useMemo(() => (
    budgetReviews.reduce((map, review) => {
      const current = map.get(review.projectId);
      const reviewAt = new Date(
        review?.cfoDecision?.at
        || review?.ctoAt
        || review?.submittedAt
        || 0
      ).getTime();
      const currentAt = current
        ? new Date(
            current?.cfoDecision?.at
            || current?.ctoAt
            || current?.submittedAt
            || 0
          ).getTime()
        : 0;
      if (!current || reviewAt > currentAt) map.set(review.projectId, review);
      return map;
    }, new Map())
  ), [budgetReviews]);

  const rows = useMemo(
    () => dashboardProjects.map((project) => {
      const review = latestReviewByProject.get(project.id);
      const usage = summarizeLoggedProject(project, taskLogs);
      const itActualSummary = summarizeItProjectActuals(itMonthlyActuals[project.id] || {});
      const totalTaskCount = getRequestedTaskCount(project, review);
      const totalBudgetRequested = Number(
        project?.approvedBudget
        || project?.estimatedBudget
        || review?.requestedBudget
        || 0
      );
      const metrics = buildDeliverableCostMetrics({
        totalBudgetRequested,
        totalTaskCount,
        completedDeliverables: usage.loggedTasks,
        totalAmountConsumed: Number(
          itActualSummary.totalActual
          || project?.cfoActualSpend
          || project?.actualSpend
          || 0
        ),
      });

      return {
        projectId: project.id,
        projectName: project.name,
        projectType: project.type || "R&D",
        latestItFile: itActualSummary.updatedAt
          ? new Date(itActualSummary.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "Not filed",
        dailyActualRows: Number(itActualSummary.dailyActuals?.length || 0),
        totalTaskCount,
        totalBudgetRequested,
        ...metrics,
      };
    }).filter((row) => (
      row.totalTaskCount > 0
      || row.completedDeliverables > 0
      || row.totalBudgetRequested > 0
      || row.actualCost > 0
    )),
    [dashboardProjects, latestReviewByProject, taskLogs, itMonthlyActuals]
  );

  const filtered = useMemo(() => {
    const nextRows = [...rows];

    if (sort === "claimedCost") {
      nextRows.sort((left, right) => right.claimedCost - left.claimedCost);
    } else if (sort === "actualCost") {
      nextRows.sort((left, right) => right.actualCost - left.actualCost);
    } else if (sort === "perTaskCost") {
      nextRows.sort((left, right) => right.perTaskCost - left.perTaskCost);
    } else {
      nextRows.sort((left, right) => Math.abs(right.variance) - Math.abs(left.variance));
    }

    return nextRows;
  }, [rows, sort]);

  const totals = useMemo(() => {
    const totalTaskCount = filtered.reduce((sum, row) => sum + row.totalTaskCount, 0);
    const completedDeliverables = filtered.reduce((sum, row) => sum + row.completedDeliverables, 0);
    const claimedCost = filtered.reduce((sum, row) => sum + row.claimedCost, 0);
    const actualCost = filtered.reduce((sum, row) => sum + row.actualCost, 0);
    const variance = actualCost - claimedCost;

    return {
      totalTaskCount,
      completedDeliverables,
      claimedCost,
      actualCost,
      variance,
      perTaskCost: totalTaskCount > 0 ? claimedCost / totalTaskCount : 0,
    };
  }, [filtered]);

  return (
    <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="cfo-cost-per-task-view">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <Cpu className="w-3 h-3" /> Deliverable costing
          </div>
          <div className="font-display font-semibold text-[15px] text-white mt-1">Claimed vs actual cost</div>
          <div className="text-xs text-zinc-500 mt-0.5">
            Per task cost = budget requested / total task count · actuals use IT-filed consumed amounts
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Filter className="w-3 h-3 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              data-testid="cpt-sort"
              className="pl-6 pr-2 h-8 rounded-md bg-white/[0.04] border border-white/10 text-[11px] text-zinc-200 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40"
            >
              <option value="variance">Sort · variance</option>
              <option value="claimedCost">Sort · claimed cost</option>
              <option value="actualCost">Sort · actual cost</option>
              <option value="perTaskCost">Sort · per task cost</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <SummaryCell icon={ListChecks} label="Total tasks" value={totals.totalTaskCount.toLocaleString()} testid="cpt-total-tasks" />
        <SummaryCell icon={Layers} label="Delivered" value={totals.completedDeliverables.toLocaleString()} testid="cpt-total-delivered" />
        <SummaryCell label="Claimed cost" value={fmtCurrency(totals.claimedCost, { compact: false })} accent="text-fuchsia-300" testid="cpt-total-claimed" />
        <SummaryCell label="Actual cost" value={fmtCurrency(totals.actualCost, { compact: false })} accent="text-white" testid="cpt-total-actual" />
        <SummaryCell
          label="Variance"
          value={fmtCurrency(totals.variance, { compact: false })}
          accent={totals.variance > 0 ? "text-red-300" : totals.variance < 0 ? "text-emerald-300" : "text-white"}
          testid="cpt-total-variance"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-xs text-zinc-500">
          No deliverable costing data is available yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">Project</th>
                <th className="text-right py-2 px-3">Budget</th>
                <th className="text-right py-2 px-3">Total tasks</th>
                <th className="text-right py-2 px-3">Delivered</th>
                <th className="text-right py-2 px-3">Per task cost</th>
                <th className="text-right py-2 px-3">Claimed cost</th>
                <th className="text-right py-2 px-3">Actual cost</th>
                <th className="text-right py-2 px-3">Actual / task</th>
                <th className="text-right py-2 px-3">Variance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const varianceUp = row.variance > 0;
                const varianceDown = row.variance < 0;

                return (
                  <tr
                    key={row.projectId}
                    data-testid={`cpt-row-${row.projectId}`}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                  >
                    <td className="py-2.5 px-3">
                      <Link to={`/projects/${row.projectId}`} className="text-white font-medium hover:text-fuchsia-300">
                        {row.projectName}
                      </Link>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {row.projectType} · IT rows {row.dailyActualRows} · {row.latestItFile}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular text-white font-semibold">
                      {fmtCurrency(row.totalBudgetRequested, { compact: false })}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular text-zinc-200">
                      {row.totalTaskCount.toLocaleString() || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular text-fuchsia-300 font-semibold">
                      {row.completedDeliverables.toLocaleString() || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular text-zinc-200">
                      {row.perTaskCost > 0 ? fmtCurrency(row.perTaskCost, { compact: false }) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular text-zinc-200">
                      {row.claimedCost > 0 ? fmtCurrency(row.claimedCost, { compact: false }) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular text-white font-semibold">
                      {row.actualCost > 0 ? fmtCurrency(row.actualCost, { compact: false }) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular text-zinc-200">
                      {row.actualPerTaskCost > 0 ? fmtCurrency(row.actualPerTaskCost, { compact: false }) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular">
                      {varianceUp || varianceDown ? (
                        <span className={`inline-flex items-center gap-1 font-semibold ${varianceUp ? "text-red-300" : "text-emerald-300"}`}>
                          {varianceUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {row.variance > 0 ? "+" : ""}
                          {fmtCurrency(row.variance, { compact: false })}
                        </span>
                      ) : (
                        <span className="text-zinc-500">On target</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const SummaryCell = ({ icon: Icon, label, value, accent = "text-white", testid }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5" data-testid={testid}>
    <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-0.5">
      {Icon && <Icon className="w-3 h-3" />} {label}
    </div>
    <div className={`text-base font-semibold tabular ${accent}`}>{value}</div>
  </div>
);

export default CostPerTaskView;
