import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import {
  Calendar,
  Activity,
  ListChecks,
  GitBranch,
  DollarSign,
  CheckCircle2,
} from "lucide-react";
import { buildExecutionProjectView, buildItActualDailyRows, buildLoggedDailyRows, isProjectInRndLane, isProjectInTpmLane } from "../../lib/projectMetrics";

const shiftDate = (anchorDate, days) => {
  const anchor = new Date(anchorDate);
  anchor.setDate(anchor.getDate() + days);
  return anchor.toISOString().slice(0, 10);
};

const buildDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

// Heat intensity helper — % of approved daily budget consumed
const heatColor = (pct) => {
  if (pct === null || pct === undefined) return { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.05)" };
  if (pct >= 120) return { bg: "rgba(239,68,68,0.85)", border: "rgba(239,68,68,0.95)" };
  if (pct >= 100) return { bg: "rgba(239,68,68,0.55)", border: "rgba(239,68,68,0.7)" };
  if (pct >= 80) return { bg: "rgba(245,158,11,0.55)", border: "rgba(245,158,11,0.7)" };
  if (pct >= 60) return { bg: "rgba(230,25,184,0.55)", border: "rgba(230,25,184,0.7)" };
  if (pct >= 40) return { bg: "rgba(230,25,184,0.35)", border: "rgba(230,25,184,0.5)" };
  if (pct >= 20) return { bg: "rgba(16,185,129,0.35)", border: "rgba(16,185,129,0.5)" };
  return { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)" };
};

const Consumption = () => {
  const { user, visibleProjects, taskLogs, budgets, itMonthlyActuals } = useApp();
  const isRnd = user?.role === "R&D";
  const executionLane = isRnd ? "rnd" : "production";
  const usageOptions = useMemo(() => ({ lane: executionLane }), [executionLane]);
  const today = new Date().toISOString().slice(0, 10);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const allDashboardProjects = useMemo(
    () => visibleProjects
      .filter((project) => (isRnd ? isProjectInRndLane(project) : isProjectInTpmLane(project)))
      .map((project) => buildExecutionProjectView(project, budgets, executionLane)),
    [visibleProjects, budgets, executionLane, isRnd]
  );
  const dashboardProjects = useMemo(
    () => (selectedProjectId === "all"
      ? allDashboardProjects
      : allDashboardProjects.filter((project) => project.id === selectedProjectId)),
    [allDashboardProjects, selectedProjectId]
  );
  const dailyRows = useMemo(
    () => buildLoggedDailyRows(dashboardProjects, taskLogs, usageOptions),
    [dashboardProjects, taskLogs, usageOptions]
  );
  const itActualRows = useMemo(
    () => buildItActualDailyRows(dashboardProjects, itMonthlyActuals),
    [dashboardProjects, itMonthlyActuals]
  );
  const latestDate = dailyRows[dailyRows.length - 1]?.date || today;
  useEffect(() => {
    if (!dateTo) setDateTo(latestDate);
    if (!dateFrom) setDateFrom(shiftDate(latestDate, -13));
  }, [dateFrom, dateTo, latestDate]);

  const normalizedRange = useMemo(() => {
    const fallbackTo = dateTo || latestDate;
    const fallbackFrom = dateFrom || shiftDate(fallbackTo, -13);
    return fallbackFrom <= fallbackTo
      ? { from: fallbackFrom, to: fallbackTo }
      : { from: fallbackTo, to: fallbackFrom };
  }, [dateFrom, dateTo, latestDate]);
  const heatDates = useMemo(
    () => buildDateRange(normalizedRange.from, normalizedRange.to),
    [normalizedRange.from, normalizedRange.to]
  );
  const projectIds = dashboardProjects.map((project) => project.id);
  const heatmap = useMemo(() => ({ dates: heatDates, rows: projectIds }), [heatDates, projectIds]);
  const actualMap = useMemo(() => (
    new Map(itActualRows.map((row) => [`${row.projectId}::${row.date}`, row]))
  ), [itActualRows]);
  const scopedDailyRows = useMemo(
    () => dailyRows.filter((row) => row.date >= normalizedRange.from && row.date <= normalizedRange.to),
    [dailyRows, normalizedRange.from, normalizedRange.to]
  );
  const displayDate = scopedDailyRows[scopedDailyRows.length - 1]?.date || normalizedRange.to || latestDate;
  const todayRows = scopedDailyRows.filter((row) => row.date === displayDate);

  const totals = useMemo(() => (
    todayRows.reduce(
      (sum, row) => ({
        tasks: sum.tasks + Number(row.tasks || 0),
        trajectories: sum.trajectories + Number(row.trajectories || 0),
        cost: sum.cost + Number(row.spent || 0),
      }),
      { tasks: 0, trajectories: 0, cost: 0 }
    )
  ), [todayRows]);

  const cellFor = (projectId, date) => {
    const entry = scopedDailyRows.find((row) => row.projectId === projectId && row.date === date);
    if (!entry) return null;
    const pct = entry.approvedDaily ? Math.round((entry.spent / entry.approvedDaily) * 100) : 0;
    const actualEntry = actualMap.get(`${projectId}::${date}`);
    return {
      ...entry,
      pct,
      actualAlert: Boolean(actualEntry && (Number(actualEntry.actual || 0) > Number(entry.spent || 0) || Number(actualEntry.actual || 0) > Number(entry.approvedDaily || 0))),
    };
  };

  const perProject = dashboardProjects.map((project) => {
    const entries = scopedDailyRows.filter((row) => row.projectId === project.id);
    const logged = entries.reduce((sum, row) => sum + Number(row.spent || 0), 0);
    const allocated = entries.reduce((sum, row) => sum + Number(row.approvedDaily || 0), 0);
    return {
      name: project.name,
      allocated,
      logged,
      remaining: Math.max(allocated - logged, 0),
    };
  });

  const recentRows = [...scopedDailyRows]
    .map((row) => ({
      ...row,
      actualAlert: Boolean(
        actualMap.get(`${row.projectId}::${row.date}`)
        && (
          Number(actualMap.get(`${row.projectId}::${row.date}`)?.actual || 0) > Number(row.spent || 0)
          || Number(actualMap.get(`${row.projectId}::${row.date}`)?.actual || 0) > Number(row.approvedDaily || 0)
        )
      ),
    }))
    .slice(-10)
    .reverse();

  return (
    <div className="space-y-6" data-testid="page-consumption">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <Calendar className="w-3 h-3" />
            Daily consumption
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">
            Logged daily consumption
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {new Date(displayDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · task logs roll up here automatically for {isRnd ? "your R&D projects" : "your production projects"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            data-testid="consumption-project-filter"
            className="h-10 px-3 rounded-lg bg-[#12121A] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
          >
            <option value="all">All projects</option>
            {allDashboardProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 flex-wrap" data-testid="consumption-date-filter">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              aria-label="From date"
              className="h-10 px-3 rounded-lg bg-[#12121A] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              aria-label="To date"
              className="h-10 px-3 rounded-lg bg-[#12121A] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Tasks logged" value={String(totals.tasks || 0)} icon={ListChecks} tone="magenta" testid="stat-tasks" />
        <Stat label="Trajectories" value={String(totals.trajectories || 0)} icon={GitBranch} tone="magenta" testid="stat-traj" />
        <Stat label="Logged cost" value={fmtCurrency(totals.cost || 0, { compact: false })} icon={DollarSign} tone="magenta" testid="stat-cost" />
        <Stat label="Projects active" value={String(todayRows.length || 0)} icon={Activity} testid="stat-logged" />
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="heatmap">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">
              Consumption heatmap
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              % of daily budget consumed from logged tasks · project × day · flags appear when IT-filed actuals exceed the claimed day burn
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-zinc-400">
            <LegendChip color="rgba(16,185,129,0.35)" label="&lt; 40%" />
            <LegendChip color="rgba(230,25,184,0.55)" label="40–80%" />
            <LegendChip color="rgba(245,158,11,0.55)" label="80–100%" />
            <LegendChip color="rgba(239,68,68,0.55)" label="&gt; 100%" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest text-left pr-2 pb-1 sticky left-0 bg-[#12121A]">
                  Project
                </th>
                {heatmap.dates.map((date) => (
                  <th key={date} className="text-[9px] text-zinc-500 font-medium tabular pb-1 text-center w-8">
                    {date.slice(-2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.rows.map((projectId) => {
                const project = dashboardProjects.find((entry) => entry.id === projectId);
                if (!project) return null;
                return (
                  <tr key={projectId} data-testid={`heat-row-${projectId}`}>
                    <td className="text-xs text-zinc-200 pr-3 py-0.5 whitespace-nowrap sticky left-0 bg-[#12121A]">
                      <div className="max-w-[220px]" title={project.name}>{project.name}</div>
                    </td>
                    {heatmap.dates.map((date) => {
                      const cell = cellFor(projectId, date);
                      const { bg, border } = heatColor(cell?.pct);
                      return (
                        <td key={date}>
                          <div
                            className="w-7 h-7 rounded-md border cursor-default relative group"
                            style={{ background: bg, borderColor: border }}
                            title={cell ? `${date} · ${cell.pct}% (${fmtCurrency(cell.spent, { compact: false })} of ${fmtCurrency(cell.approvedDaily, { compact: false })}) · ${cell.tasks} tasks / ${cell.trajectories} trajectories${cell.actualAlert ? " · IT actuals are higher than the claimed day burn" : ""}` : date}
                          >
                            {cell && (cell.pct >= 100 || cell.actualAlert) && (
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/90">
                                {cell.actualAlert ? "!" : "!"}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="chart-approved-vs-actual">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">Allocated vs logged (selected range)</div>
            <div className="text-xs text-zinc-500 mt-0.5">Daily budget allocation compared against task-log spend per project for the chosen dates</div>
          </div>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perProject}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} interval={0} height={56} />
              <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`} />
              <Tooltip
                contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }}
                formatter={(value) => fmtCurrency(value, { compact: false })}
              />
              <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="allocated" name="Allocated" fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Bar dataKey="logged" name="Logged" fill="#E619B8" radius={[3, 3, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="recent-submissions">
        <div className="font-display font-semibold text-[15px] text-white mb-3">Recent logged days</div>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-left py-2 px-3">Project</th>
                <th className="text-right py-2 px-3">Tasks</th>
                <th className="text-right py-2 px-3">Trajectories</th>
                <th className="text-right py-2 px-3">Logged</th>
                <th className="text-right py-2 px-3">Allocated / day</th>
                <th className="text-right py-2 px-3">Health</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((row, index) => {
                const pct = row.approvedDaily ? Math.round((row.spent / row.approvedDaily) * 100) : 0;
                return (
                  <tr key={`${row.projectId}-${row.date}-${index}`} data-testid={`sub-${index}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="py-3 px-3 text-white font-medium tabular">
                      {new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="py-3 px-3 text-zinc-200">{row.projectName}</td>
                    <td className="py-3 px-3 text-right text-zinc-200 tabular">{row.tasks}</td>
                    <td className="py-3 px-3 text-right text-zinc-200 tabular">{row.trajectories}</td>
                    <td className="py-3 px-3 text-right text-white font-semibold tabular">{fmtCurrency(row.spent, { compact: false })}</td>
                    <td className="py-3 px-3 text-right text-zinc-400 tabular">{fmtCurrency(row.approvedDaily, { compact: false })}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        row.actualAlert
                          ? "bg-red-500/15 text-red-300"
                          : pct >= 100
                            ? "bg-red-500/15 text-red-300"
                            : pct >= 80
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-emerald-500/15 text-emerald-300"
                      }`}>
                        {row.actualAlert ? <span>Flag</span> : pct >= 100 ? <span>Over</span> : pct >= 80 ? <span>Watch</span> : <><CheckCircle2 className="w-3 h-3" /> OK</>} · {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {recentRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-zinc-500">
                    No task logs yet. Log tasks from the project Batch tab to start daily tracking.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const LegendChip = ({ color, label }) => (
  <span className="inline-flex items-center gap-1">
    <span className="w-3 h-3 rounded-sm border" style={{ background: color, borderColor: color }} />
    {label}
  </span>
);

const Stat = ({ label, value, icon: Icon, tone = "neutral", testid }) => {
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
    </div>
  );
};

export default Consumption;
