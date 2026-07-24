import { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { buildLoggedDailyRows, summarizeItProjectActuals, summarizeLoggedProject } from "../../lib/projectMetrics";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Activity, TrendingUp, Wallet, Gauge, AlertTriangle, ShieldCheck } from "lucide-react";

const COLORS = ["#E619B8", "#3B82F6", "#10B981", "#F59E0B", "#F97316", "#8B5CF6"];
const PROJECT_CATEGORIES = ["RL Environment", "Projects", "Tooling"];
const getProjectCategory = (project = {}) => {
  const value = `${project.type || ""} ${project.teamType || ""}`.toLowerCase();
  if (value.includes("tool")) return "Tooling";
  if (value.includes("r&d") || value.includes("rnd") || value.includes("rl env")) return "RL Environment";
  return "Projects";
};

const FinancialMonitoring = () => {
  const { visibleProjects, taskLogs, itMonthlyActuals } = useApp();
  const [projectPage, setProjectPage] = useState(1);
  const [projectSpendSort, setProjectSpendSort] = useState("high-low");

  const projectSpend = useMemo(() => visibleProjects.map((project) => {
    const usage = summarizeLoggedProject(project, taskLogs);
    const itActual = summarizeItProjectActuals(itMonthlyActuals?.[project.id] || {});
    const approved = Number(project.approvedBudget || 0);
    const actual = Number(project.cfoActualSpend || project.actualSpend || itActual.totalActual || usage.loggedSpend || 0);
    const claimed = Number(project.estimatedBudget || approved);
    const bufferAllocated = approved * (Number(project.buffer || 0) / 100);
    return {
      id: project.id,
      name: project.name,
      type: getProjectCategory(project),
      approved,
      claimed,
      actual,
      runRate: Number(project.cfoBurnRate || usage.runRate || 0),
      bufferAllocated,
      bufferConsumed: Math.max(0, actual - approved),
    };
  }).sort((a, b) => b.actual - a.actual), [visibleProjects, taskLogs, itMonthlyActuals]);

  const dailyRows = useMemo(() => buildLoggedDailyRows(visibleProjects, taskLogs).slice(-30), [visibleProjects, taskLogs]);
  const dailyData = useMemo(() => Array.from(dailyRows.reduce((map, row) => {
    const current = map.get(row.date) || { date: row.date, actual: 0, planned: 0 };
    current.actual += Number(row.spent || 0);
    current.planned += Number(row.approvedDaily || 0);
    map.set(row.date, current);
    return map;
  }, new Map()).values()), [dailyRows]);

  const totals = useMemo(() => projectSpend.reduce((sum, row) => ({
    approved: sum.approved + row.approved,
    claimed: sum.claimed + row.claimed,
    actual: sum.actual + row.actual,
    runRate: sum.runRate + row.runRate,
  }), { approved: 0, claimed: 0, actual: 0, runRate: 0 }), [projectSpend]);
  const utilization = totals.approved > 0 ? Math.round((totals.actual / totals.approved) * 100) : 0;
  const remaining = totals.approved - totals.actual;
  const runway = totals.runRate > 0 ? Math.max(0, Math.round(remaining / totals.runRate)) : 0;
  const variance = totals.claimed - totals.actual;
  const today = dailyData[dailyData.length - 1]?.actual || 0;
  const dailyAvg = dailyData.length ? dailyData.reduce((sum, row) => sum + row.actual, 0) / dailyData.length : 0;
  const risk = utilization >= 100 ? "High" : utilization >= 85 ? "Medium" : "Low";

  const typeSpend = useMemo(() => Array.from(projectSpend.reduce((map, row) => {
    const current = map.get(row.type) || { type: row.type, budget: 0, actual: 0 };
    current.budget += row.approved;
    current.actual += row.actual;
    map.set(row.type, current);
    return map;
  }, new Map(PROJECT_CATEGORIES.map((type) => [type, { type, budget: 0, actual: 0 }]))).values()), [projectSpend]);

  const modelSpend = useMemo(() => {
    const map = new Map();
    Object.values(taskLogs || {}).flat().forEach((log) => {
      const usages = Array.isArray(log.modelUsage) && log.modelUsage.length
        ? log.modelUsage
        : [{ modelName: log.modelName || "Unspecified model", cost: log.cost || 0 }];
      usages.forEach((usage) => {
        const name = usage.modelName || "Unspecified model";
        map.set(name, (map.get(name) || 0) + Number(usage.cost || 0));
      });
    });
    return Array.from(map, ([name, value], index) => ({ name, value, color: COLORS[index % COLORS.length] }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [taskLogs]);
  const projectPageSize = 10;
  const sortedProjectSpend = useMemo(() => [...projectSpend].sort((left, right) => {
    const leftUtilization = left.approved > 0 ? (left.actual / left.approved) * 100 : 0;
    const rightUtilization = right.approved > 0 ? (right.actual / right.approved) * 100 : 0;
    return projectSpendSort === "high-low"
      ? rightUtilization - leftUtilization
      : leftUtilization - rightUtilization;
  }), [projectSpend, projectSpendSort]);
  const projectTotalPages = Math.max(1, Math.ceil(sortedProjectSpend.length / projectPageSize));
  const currentProjectPage = Math.min(projectPage, projectTotalPages);
  const projectPageStart = (currentProjectPage - 1) * projectPageSize;
  const paginatedProjectSpend = sortedProjectSpend.slice(projectPageStart, projectPageStart + projectPageSize);

  return (
    <div className="space-y-6" data-testid="page-financial-monitoring">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-400"><Activity className="w-3 h-3" /> CFO Portal</div>
        <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Financial monitoring</h1>
        <p className="text-sm text-zinc-400 mt-1">Current portfolio analysis from saved budgets, actuals, and task consumption</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Actual spend" value={fmtCurrency(totals.actual)} icon={Wallet} tone="magenta" />
        <Stat label="Latest logged day" value={fmtCurrency(today, { compact: false })} icon={Activity} sub={`Observed avg ${fmtCurrency(dailyAvg, { compact: false })}`} />
        <Stat label="Approved budget" value={fmtCurrency(totals.approved)} icon={TrendingUp} />
        <Stat label="Claimed variance" value={fmtCurrency(Math.abs(variance), { compact: false })} sub={variance >= 0 ? "below claimed" : "above claimed"} tone={variance >= 0 ? "positive" : "negative"} />
        <Stat label="Run rate" value={`${fmtCurrency(totals.runRate)}/day`} icon={Gauge} sub={runway ? `${runway} days of approved budget` : "No runway available"} />
        <Stat label="Financial risk" value={risk} tone={risk === "High" ? "negative" : risk === "Medium" ? "warning" : "positive"} icon={AlertTriangle} sub={`${fmtPct(utilization)} utilized`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Daily financial consumption" subtitle="Available task-log dates · actual vs approved daily allocation">
          <div className="h-[280px]">
            {dailyData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={dailyData}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
              <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v, { compact: false })} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke="#E619B8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="planned" name="Approved daily" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </LineChart></ResponsiveContainer> : <Empty text="No dated task consumption is available." />}
          </div>
        </Panel>

        <Panel title="Project-type spend" subtitle="Approved budget vs current actuals">
          <div className="h-[280px]">
            {typeSpend.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={typeSpend}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
              <XAxis dataKey="type" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v)} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="budget" name="Budget" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="#E619B8" radius={[3, 3, 0, 0]} />
            </BarChart></ResponsiveContainer> : <Empty text="No project budget data is available." />}
          </div>
        </Panel>

        <Panel title="Logged model spend" subtitle="Model share from recorded task usage">
          <div className="h-[280px] flex items-center gap-4">
            {modelSpend.length ? <>
              <div className="w-48 h-48"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={modelSpend} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none">{modelSpend.map((row) => <Cell key={row.name} fill={row.color} />)}</Pie></PieChart></ResponsiveContainer></div>
              <div className="flex-1 space-y-1.5">{modelSpend.map((row) => <div key={row.name} className="flex items-center justify-between gap-3 text-xs"><div className="flex items-center gap-2 min-w-0"><span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: row.color }} /><span className="text-zinc-300 truncate">{row.name}</span></div><span className="text-white font-semibold tabular">{fmtCurrency(row.value)}</span></div>)}</div>
            </> : <Empty text="No model-level task cost has been logged." />}
          </div>
        </Panel>
      </div>

      <Panel title="Project-wise spend" subtitle="All values reflect current saved project budgets and actuals">
        <div className="mb-3 flex items-center justify-end">
          <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
            Sort utilization
            <select
              value={projectSpendSort}
              onChange={(event) => {
                setProjectSpendSort(event.target.value);
                setProjectPage(1);
              }}
              className="h-8 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs normal-case tracking-normal font-medium text-zinc-200 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              data-testid="financial-project-spend-sort"
            >
              <option value="high-low">High to low</option>
              <option value="low-high">Low to high</option>
            </select>
          </label>
        </div>
        <div className="space-y-2.5">{paginatedProjectSpend.map((row) => {
          const pct = row.approved > 0 ? Math.round((row.actual / row.approved) * 100) : 0;
          return <div key={row.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
            <span className={`w-1.5 h-9 rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 85 ? "bg-amber-500" : "bg-fuchsia-500"}`} />
            <div className="flex-1 min-w-0"><div className="flex items-center justify-between text-xs mb-1"><span className="font-medium text-white truncate">{row.name}</span><span className="text-zinc-500">{fmtPct(pct)}</span></div><div className="relative h-2 rounded-full bg-white/[0.05] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: pct >= 100 ? "#EF4444" : pct >= 85 ? "#F59E0B" : "#E619B8" }} /></div></div>
            <div className="text-right w-36"><div className="text-sm font-semibold text-white tabular">{fmtCurrency(row.actual)}</div><div className="text-[10px] text-zinc-500">of {fmtCurrency(row.approved)}</div></div>
            {row.bufferAllocated > 0 && <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" title={`Configured buffer ${fmtCurrency(row.bufferAllocated)}`} />}
          </div>;
        })}</div>
        {sortedProjectSpend.length > projectPageSize && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/5 pt-3" data-testid="financial-project-pagination">
            <div className="text-xs text-zinc-500 tabular">
              Showing {projectPageStart + 1}–{Math.min(projectPageStart + projectPageSize, sortedProjectSpend.length)} of {sortedProjectSpend.length} projects
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentProjectPage === 1}
                onClick={() => setProjectPage(Math.max(1, currentProjectPage - 1))}
                className="h-8 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="min-w-[76px] text-center text-xs text-zinc-400 tabular">
                Page {currentProjectPage} of {projectTotalPages}
              </span>
              <button
                type="button"
                disabled={currentProjectPage === projectTotalPages}
                onClick={() => setProjectPage(Math.min(projectTotalPages, currentProjectPage + 1))}
                className="h-8 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
};

const Empty = ({ text }) => <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">{text}</div>;
const Panel = ({ title, subtitle, children }) => <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5"><div className="mb-3"><div className="font-display font-semibold text-[15px] text-white">{title}</div><div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div></div>{children}</div>;
const Stat = ({ label, value, sub, icon: Icon, tone = "neutral" }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white", magenta: "text-fuchsia-300" };
  return <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4"><div className="flex items-center justify-between"><div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>{Icon && <Icon className={`w-3.5 h-3.5 ${tones[tone]}`} />}</div><div className={`mt-2 font-display font-semibold text-lg tabular ${tones[tone]}`}>{value}</div>{sub && <div className="mt-1 text-[10px] text-zinc-500 tabular">{sub}</div>}</div>;
};

export default FinancialMonitoring;
