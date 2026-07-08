import { useMemo } from "react";
import { PROJECTS, PORTFOLIO } from "../../data/mockProjects";
import { DAILY_ACTIVITY } from "../../data/mockAi";
import { MONTHLY_SPEND } from "../../data/mockFinance";
import { AI_COST_BY_PROVIDER } from "../../data/mockTpm";
import { DEPT_SPEND, CASH_FLOW, BUFFER } from "../../data/mockCfo";
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
import { Activity, TrendingUp, Wallet, Flame, Clock3, Gauge, AlertTriangle, DollarSign, PieChart as PieIcon, ShieldCheck } from "lucide-react";

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
    () => PROJECTS.map((p) => {
      const buf = BUFFER.perProject.find((b) => b.id === p.id);
      return {
        name: p.name.split(" ")[0],
        actual: p.actualSpend,
        approved: p.approvedBudget,
        bufferAllocated: buf?.allocated || 0,
        bufferConsumed: buf?.consumed || 0,
      };
    }).sort((a, b) => b.actual - a.actual),
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Org spend" value={fmtCurrency(PORTFOLIO.actualSpend)} icon={Wallet} tone="magenta" testid="fm-org" />
        <Stat label="Daily spend" value={fmtCurrency(today.spend, { compact: false })} icon={Activity} sub={`avg $${(dailyAvg / 1000).toFixed(1)}k`} testid="fm-daily" />
        <Stat label="Monthly spend" value={fmtCurrency(monthly.actual)} icon={TrendingUp} tone={monthly.actual > monthly.budget ? "negative" : "positive"} testid="fm-monthly" />
        <Stat label="Variance" value={fmtCurrency(Math.abs(variance), { compact: false })} sub={variance >= 0 ? "under plan" : "over plan"} tone={variance >= 0 ? "positive" : "negative"} testid="fm-var" />
        <Stat label="EAC forecast" value={fmtCurrency(PORTFOLIO.eac)} icon={Gauge} testid="fm-forecast" />
        <Stat label="Financial risk" value={risk} tone={risk === "High" ? "negative" : risk === "Medium" ? "warning" : "positive"} icon={AlertTriangle} testid="fm-risk" />
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
      <Panel testid="project-spend" title="Project-wise spend" subtitle="Top spenders · magenta = actual, dashed marker = contingency buffer">
        <div className="mb-3 flex items-center gap-4 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-fuchsia-500" /> Actual spend</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500/70" /> Buffer available</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500/80" /> Buffer consumed</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-fuchsia-300" /> Buffer allocation marker</span>
        </div>
        <div className="space-y-2.5">
          {projectSpend.slice(0, 6).map((p) => {
            const pct = p.approved ? Math.round((p.actual / p.approved) * 100) : 0;
            const bufferPct = p.approved ? Math.min(100, Math.round(((p.actual + p.bufferAllocated) / p.approved) * 100)) : 0;
            const bufferSpanPct = p.approved ? Math.round((p.bufferAllocated / p.approved) * 100) : 0;
            const bufferConsumedPct = p.approved ? Math.round((p.bufferConsumed / p.approved) * 100) : 0;
            const actualPct = Math.min(100, pct);
            return (
              <div key={p.name} data-testid={`row-spend-${p.name.toLowerCase()}`} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
                <span className={`w-1.5 h-9 rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 90 ? "bg-amber-500" : "bg-fuchsia-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-white truncate">{p.name}</span>
                    <span className="text-[10px] text-zinc-500 tabular">
                      Buffer: <span className="text-fuchsia-300 font-semibold">{fmtCurrency(p.bufferAllocated, { compact: false })}</span>
                      {p.bufferConsumed > 0 && <> · used <span className="text-amber-300 font-semibold">{fmtCurrency(p.bufferConsumed, { compact: false })}</span></>}
                    </span>
                  </div>
                  {/* Segmented bar: actual + buffer overlays */}
                  <div className="relative w-full h-2 rounded-full bg-white/[0.05] overflow-visible">
                    <div className="absolute inset-0 h-full rounded-full" style={{ width: `${actualPct}%`, background: pct >= 100 ? "#EF4444" : pct >= 90 ? "#F59E0B" : "#E619B8" }} />
                    {/* Buffer allocation segment sitting on top from actual → actual + buffer */}
                    {bufferSpanPct > 0 && (
                      <div
                        className="absolute top-0 h-full rounded-full opacity-90"
                        style={{
                          left: `${actualPct}%`,
                          width: `${Math.min(100 - actualPct, bufferSpanPct)}%`,
                          background: "repeating-linear-gradient(45deg, rgba(16,185,129,0.55) 0 4px, rgba(16,185,129,0.22) 4px 8px)",
                        }}
                        title={`Buffer allocated ${fmtCurrency(p.bufferAllocated, { compact: false })}`}
                      />
                    )}
                    {/* Buffer consumed indicator inside the buffer segment */}
                    {bufferConsumedPct > 0 && (
                      <div
                        className="absolute top-0 h-full rounded-full"
                        style={{
                          left: `${actualPct}%`,
                          width: `${Math.min(100 - actualPct, bufferConsumedPct)}%`,
                          background: "rgba(245,158,11,0.85)",
                        }}
                        title={`Buffer consumed ${fmtCurrency(p.bufferConsumed, { compact: false })}`}
                      />
                    )}
                    {/* Marker line at the boundary where buffer starts */}
                    <div
                      className="absolute -top-1 h-4 w-0.5 bg-fuchsia-300 rounded-full"
                      style={{ left: `${actualPct}%` }}
                      title="Actual spend end / buffer start"
                    />
                    {/* Marker line at buffer full extent */}
                    {bufferPct > actualPct && (
                      <div
                        className="absolute -top-1 h-4 w-0.5 bg-emerald-400 rounded-full"
                        style={{ left: `${bufferPct}%` }}
                        title={`Buffer coverage extends to ${bufferPct}%`}
                      />
                    )}
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
