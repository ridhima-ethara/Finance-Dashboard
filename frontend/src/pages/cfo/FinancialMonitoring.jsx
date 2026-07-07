import { useMemo } from "react";
import { PROJECTS, PORTFOLIO } from "../../data/mockProjects";
import { DAILY_ACTIVITY } from "../../data/mockAi";
import { MONTHLY_SPEND } from "../../data/mockFinance";
import { AI_COST_BY_PROVIDER } from "../../data/mockTpm";
import { DEPT_SPEND, CASH_FLOW } from "../../data/mockCfo";
import { fmtCurrency, fmtPct } from "../../lib/format";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Activity, TrendingUp, Wallet, Flame, Clock3, Gauge, AlertTriangle, DollarSign, PieChart as PieIcon } from "lucide-react";

const FinancialMonitoring = () => {
  const today = DAILY_ACTIVITY[DAILY_ACTIVITY.length - 1];
  const totalDaily = DAILY_ACTIVITY.slice(-30).reduce((s, d) => s + d.spend, 0);
  const dailyAvg = Math.round(totalDaily / 30);
  const monthly = MONTHLY_SPEND[MONTHLY_SPEND.length - 1];
  const variance = PORTFOLIO.estimatedBudget - PORTFOLIO.actualSpend;
  const runway = PORTFOLIO.cashRunwayDays;
  const risk = PORTFOLIO.utilization >= 90 ? "High" : PORTFOLIO.utilization >= 75 ? "Medium" : "Low";
  const exhaustDate = runway ? new Date(Date.now() + runway * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

  const projectSpend = useMemo(
    () => PROJECTS.map((p) => ({ name: p.name.split(" ")[0], actual: p.actualSpend, approved: p.approvedBudget })).sort((a, b) => b.actual - a.actual),
    []
  );

  return (
    <div className="space-y-6" data-testid="page-financial-monitoring">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-400">
          <Activity className="w-3 h-3" />
          CFO Portal
        </div>
        <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Financial monitoring</h1>
        <p className="text-sm text-zinc-400 mt-1">Real-time organizational spend, forecast &amp; cash flow</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Stat label="Org spend" value={fmtCurrency(PORTFOLIO.actualSpend)} icon={Wallet} tone="magenta" testid="fm-org" />
        <Stat label="Daily spend" value={fmtCurrency(today.spend, { compact: false })} icon={Activity} sub={`avg $${(dailyAvg / 1000).toFixed(1)}k`} testid="fm-daily" />
        <Stat label="Monthly spend" value={fmtCurrency(monthly.actual)} icon={TrendingUp} tone={monthly.actual > monthly.budget ? "negative" : "positive"} testid="fm-monthly" />
        <Stat label="Variance" value={fmtCurrency(Math.abs(variance), { compact: false })} sub={variance >= 0 ? "under plan" : "over plan"} tone={variance >= 0 ? "positive" : "negative"} testid="fm-var" />
        <Stat label="EAC forecast" value={fmtCurrency(PORTFOLIO.eac)} icon={Gauge} testid="fm-forecast" />
        <Stat label="Cash flow (Jul)" value={fmtCurrency(CASH_FLOW[0].net, { compact: false })} tone={CASH_FLOW[0].net >= 0 ? "positive" : "negative"} icon={DollarSign} testid="fm-cash" />
        <Stat label="Financial risk" value={risk} tone={risk === "High" ? "negative" : risk === "Medium" ? "warning" : "positive"} icon={AlertTriangle} testid="fm-risk" />
        <Stat label="Exhaustion in" value={runway ? `${runway}d` : "—"} sub={exhaustDate} icon={Clock3} tone={runway < 14 ? "negative" : "warning"} testid="fm-exhaust" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel testid="chart-daily-consumption" title="Daily financial consumption" subtitle="Last 30 days · actual vs estimate">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={DAILY_ACTIVITY.slice(-30)}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(-5)} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="spend" name="Actual" stroke="#E619B8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="estimate" name="Estimate" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="chart-cash-flow" title="Cash flow forecast" subtitle="Next 6 months · inflow vs outflow">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={CASH_FLOW}>
                <defs>
                  <linearGradient id="in" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity={0.5} /><stop offset="100%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="out" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EF4444" stopOpacity={0.5} /><stop offset="100%" stopColor="#EF4444" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v)} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="inflow" name="Inflow" stroke="#10B981" fill="url(#in)" strokeWidth={2} />
                <Area type="monotone" dataKey="outflow" name="Outflow" stroke="#EF4444" fill="url(#out)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="chart-dept" title="Department-wise spend" subtitle="Budget vs actual">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DEPT_SPEND}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="dept" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v)} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="budget" name="Budget" fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="spend" name="Actual" fill="#E619B8" radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="chart-ai-dist" title="AI spend distribution" subtitle="Provider share">
          <div className="h-[280px] flex items-center gap-4">
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={AI_COST_BY_PROVIDER} dataKey="share" nameKey="provider" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none">
                    {AI_COST_BY_PROVIDER.map((p, i) => <Cell key={i} fill={p.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {AI_COST_BY_PROVIDER.map((p) => (
                <div key={p.provider} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
                    <span className="text-zinc-300">{p.provider}</span>
                  </div>
                  <span className="text-white font-semibold tabular">{fmtCurrency(p.month)}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* Project spend ranking */}
      <Panel testid="project-spend" title="Project-wise spend" subtitle="Top spenders">
        <div className="space-y-2">
          {projectSpend.slice(0, 6).map((p) => {
            const pct = p.approved ? Math.round((p.actual / p.approved) * 100) : 0;
            return (
              <div key={p.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
                <span className={`w-1.5 h-8 rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 90 ? "bg-amber-500" : "bg-fuchsia-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{p.name}</div>
                  <div className="w-full h-1 rounded-full bg-white/[0.05] overflow-hidden mt-1">
                    <div className="h-full" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? "#EF4444" : pct >= 90 ? "#F59E0B" : "#E619B8" }} />
                  </div>
                </div>
                <div className="text-right w-32">
                  <div className="text-sm font-semibold text-white tabular">{fmtCurrency(p.actual)}</div>
                  <div className="text-[10px] text-zinc-500 tabular">of {fmtCurrency(p.approved)} · {fmtPct(pct)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
};

const Panel = ({ title, subtitle, children, testid }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
    <div className="mb-3">
      <div className="font-display font-semibold text-[15px] text-white">{title}</div>
      {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
    </div>
    {children}
  </div>
);

const Stat = ({ label, value, sub, icon: Icon, tone = "neutral", testid }) => {
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
      <div className={`mt-2 font-display font-semibold text-lg tabular ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-zinc-500 tabular">{sub}</div>}
    </div>
  );
};

export default FinancialMonitoring;
