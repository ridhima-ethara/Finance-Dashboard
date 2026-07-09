import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import { MODEL_KEYS_MASKED } from "../../data/mockAi";
import {
  AI_COST_TODAY,
  AI_COST_MONTHLY,
  AI_COST_BY_PROVIDER,
  AI_COST_BY_MODEL,
  AI_COST_TREND,
  AI_COST_BY_PROJECT,
  PHASE_TASKS,
} from "../../data/mockTpm";
import { PROJECTS } from "../../data/mockProjects";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Sparkles, TrendingUp, Activity, Coins, Cpu, Zap, ArrowUpRight, ArrowDownRight,
  ChevronRight, BarChart3, ListChecks, Gauge,
} from "lucide-react";

const providerColors = Object.fromEntries(AI_COST_BY_PROVIDER.map((p) => [p.provider, p.color]));

const Panel = ({ title, subtitle, right, children, testid, className = "" }) => (
  <div className={`bg-[#12121A] rounded-2xl border border-white/5 p-5 ${className}`} data-testid={testid}>
    <div className="flex items-start justify-between gap-2 mb-4">
      <div>
        <div className="font-display font-semibold text-[15px] text-white">{title}</div>
        {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

const StatCard = ({ label, value, sub, tone = "neutral", icon: Icon, testid }) => {
  const tones = {
    positive: "text-emerald-300",
    negative: "text-red-300",
    warning: "text-amber-300",
    neutral: "text-zinc-200",
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
      <div className="mt-2 font-display font-semibold text-2xl tabular text-white">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-zinc-500 tabular">{sub}</div>}
    </div>
  );
};

const fmtTokens = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

// Flatten phase tasks into a task-log rows list
const buildTaskLog = () => {
  const rows = [];
  Object.entries(PHASE_TASKS).forEach(([projectId, phases]) => {
    const project = PROJECTS.find((p) => p.id === projectId);
    Object.entries(phases).forEach(([phaseId, tasks]) => {
      tasks.forEach((t) => {
        rows.push({
          id: t.id,
          project: project?.name || projectId,
          phase: phaseId,
          task: t.name,
          owner: t.owner,
          model: t.model,
          infra: t.infra,
          estCost: t.estCost,
          actualCost: t.actualCost,
          variance: t.variance,
          rawStatus: t.status,
          tasks: Math.max(1, Math.round(t.estCost / 220)),
          trajectories: Math.max(1, Math.round(t.estCost / 220)) * (2 + (t.estCost % 4)),
        });
      });
    });
  });
  // Synthesize additional rows from AI_COST_BY_PROJECT + BY_MODEL to broaden coverage
  AI_COST_BY_PROJECT.forEach((p) => {
    const estCost = Math.round(p.month * 0.95);
    rows.push({
      id: `syn-${p.id}`,
      project: p.name,
      phase: "—",
      task: `Aggregate ${p.topModel} usage`,
      owner: "—",
      model: p.topModel,
      infra: "—",
      estCost,
      actualCost: p.month,
      variance: Math.round(p.month * 0.05) * -1,
      rawStatus: "in-progress",
      tasks: Math.max(1, Math.round(estCost / 220)),
      trajectories: Math.max(1, Math.round(estCost / 220)) * 3,
    });
  });
  return rows;
};

// Determines status from estimate vs actual: under / okay / over / planned
const deriveEstimateStatus = (r) => {
  if (!r.actualCost || r.actualCost === 0) return "planned";
  const diffPct = ((r.actualCost - r.estCost) / (r.estCost || 1)) * 100;
  if (diffPct > 10) return "over";
  if (diffPct < -10) return "under";
  return "okay";
};

const AiCost = () => {
  const { user } = useApp();
  const [range, setRange] = useState("30d");
  const [selectedModel, setSelectedModel] = useState(null);

  const trend = useMemo(
    () => (range === "7d" ? AI_COST_TREND.slice(-7) : AI_COST_TREND),
    [range]
  );
  const projectedOverrun = AI_COST_MONTHLY.projected - AI_COST_MONTHLY.budget;
  const wowUp = AI_COST_TODAY.wowChange > 0;

  return (
    <div className="space-y-6" data-testid="page-ai-cost">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <span className="w-6 h-px bg-fuchsia-400" />
            AI Cost Analytics
          </div>
          <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">
            Model spend, task log &amp; usage analysis
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time cost across models and projects · {user?.role === "TPM" || user?.role === "R&D" ? "your projects" : "portfolio-wide"}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 h-9">
          {["7d", "30d"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              data-testid={`ai-cost-range-${r}`}
              className={`px-3 rounded-md text-xs font-medium ${
                range === r ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {r === "7d" ? "Last 7 days" : "Last 30 days"}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard testid="kpi-today-cost" label="Today" value={fmtCurrency(AI_COST_TODAY.total, { compact: false })} sub={`of ${fmtCurrency(AI_COST_TODAY.budget, { compact: false })} budget`} icon={Zap} tone="magenta" />
        <StatCard testid="kpi-wow" label="Week-over-week" value={`${wowUp ? "+" : ""}${AI_COST_TODAY.wowChange.toFixed(1)}%`} sub={wowUp ? "up vs last week" : "down vs last week"} icon={wowUp ? ArrowUpRight : ArrowDownRight} tone={wowUp ? "negative" : "positive"} />
        <StatCard testid="kpi-month-cost" label="Month-to-date" value={fmtCurrency(AI_COST_MONTHLY.total)} sub={`of ${fmtCurrency(AI_COST_MONTHLY.budget)} · ${Math.round((AI_COST_MONTHLY.total / AI_COST_MONTHLY.budget) * 100)}%`} icon={Coins} />
        <StatCard testid="kpi-forecast" label="Projected EOM" value={fmtCurrency(AI_COST_MONTHLY.projected)} sub={projectedOverrun > 0 ? `${fmtCurrency(projectedOverrun)} over budget` : `${fmtCurrency(-projectedOverrun)} under budget`} icon={TrendingUp} tone={projectedOverrun > 0 ? "negative" : "positive"} />
        <StatCard testid="kpi-active-models" label="Active models" value={String(AI_COST_BY_MODEL.length)} sub="in production this month" icon={Cpu} />
        <StatCard testid="kpi-requests" label="Requests (today)" value={AI_COST_TODAY.requests.toLocaleString()} sub={`avg ${AI_COST_TODAY.avgLatencyMs}ms latency`} icon={Activity} />
      </div>

      {/* Model Spend + Usage Analysis merged */}
      <div className="space-y-4" data-testid="section-ai-cost-analysis">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel testid="chart-cost-trend" title="Daily AI cost trend" subtitle={`${range === "7d" ? "Last 7 days" : "Last 30 days"} · stacked by provider`} className="lg:col-span-2">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      {AI_COST_BY_PROVIDER.map((p) => (
                        <linearGradient key={p.provider} id={`grad-${p.provider}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={p.color} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={p.color} stopOpacity={0.05} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(-5)} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                    <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} labelStyle={{ color: "#f4f4f5" }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                    <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                    {AI_COST_BY_PROVIDER.map((p) => (
                      <Area key={p.provider} type="monotone" dataKey={p.provider} stackId="1" stroke={p.color} fill={`url(#grad-${p.provider})`} strokeWidth={1.5} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel testid="chart-model-share" title="Model share" subtitle="% of month-to-date spend">
              <div className="h-[280px] flex items-center gap-3">
                <div className="w-40 h-40 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={AI_COST_BY_MODEL} dataKey="month" nameKey="model" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                        {AI_COST_BY_MODEL.map((m, i) => (<Cell key={i} fill={providerColors[m.provider] || "#94A3B8"} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">Total</div>
                    <div className="font-display text-lg font-semibold text-white tabular">{fmtCurrency(AI_COST_MONTHLY.total)}</div>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {AI_COST_BY_MODEL.map((m) => (
                    <div key={m.model} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: providerColors[m.provider] }} />
                        <span className="text-zinc-300 truncate">{m.model}</span>
                      </div>
                      <span className="text-white font-semibold tabular ml-2">{fmtCurrency(m.month, { compact: false })}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          {/* Model Breakdown table — kept */}
          <Panel
            testid="table-models"
            title="Model breakdown"
            subtitle={selectedModel ? `Selected: ${selectedModel} — click again to clear` : "Per-model cost, tokens, unit economics and projects using each model"}
          >
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                    <th className="text-left py-2 px-3">Model</th>
                    <th className="text-left py-2 px-3">Provider</th>
                    <th className="text-left py-2 px-3">Projects using</th>
                    <th className="text-right py-2 px-3">Today</th>
                    <th className="text-right py-2 px-3">MTD</th>
                    <th className="text-right py-2 px-3">Tokens (in / out)</th>
                    <th className="text-right py-2 px-3">$ / 1K in · out</th>
                    <th className="text-right py-2 px-3">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {AI_COST_BY_MODEL.map((m) => {
                    const usedIn = MODEL_KEYS_MASKED.filter((k) => k.model === m.model).map((k) => k.projectName);
                    const projectsUsing = Array.from(new Set(usedIn));
                    return (
                      <tr
                        key={m.model}
                        data-testid={`row-model-${m.model}`}
                        onClick={() => setSelectedModel(selectedModel === m.model ? null : m.model)}
                        className={`border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-colors ${selectedModel === m.model ? "bg-fuchsia-500/[0.06]" : ""}`}
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-6 rounded-full" style={{ background: providerColors[m.provider] }} />
                            <span className="font-medium text-white">{m.model}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-zinc-400 text-xs">{m.provider}</td>
                        <td className="py-3 px-3">
                          {projectsUsing.length === 0 ? (
                            <span className="text-[11px] text-zinc-600">—</span>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap max-w-[240px]">
                              {projectsUsing.slice(0, 3).map((pname) => (
                                <span key={pname} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/25 text-fuchsia-200 text-[10px] font-medium">
                                  {pname}
                                </span>
                              ))}
                              {projectsUsing.length > 3 && (<span className="text-[10px] text-zinc-500">+{projectsUsing.length - 3}</span>)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-zinc-200 tabular">{fmtCurrency(m.today, { compact: false })}</td>
                        <td className="py-3 px-3 text-right text-white font-semibold tabular">{fmtCurrency(m.month)}</td>
                        <td className="py-3 px-3 text-right text-zinc-300 tabular">{fmtTokens(m.tokensIn)} / {fmtTokens(m.tokensOut)}</td>
                        <td className="py-3 px-3 text-right text-zinc-300 tabular">${m.avgCostPer1kIn.toFixed(2)} · ${m.avgCostPer1kOut.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right text-zinc-300 tabular">{m.requests.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

          <Panel testid="chart-cost-per-model" title="Cost per model (MTD)" subtitle="Absolute spend across all providers">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={AI_COST_BY_MODEL}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                  <XAxis dataKey="model" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v)} />
                  <Bar dataKey="month" name="MTD" radius={[3, 3, 0, 0]} maxBarSize={40}>
                    {AI_COST_BY_MODEL.map((m, i) => (<Cell key={i} fill={providerColors[m.provider]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel testid="widget-project-attr" title="Cost by project" subtitle="AI spend attribution" className="lg:col-span-2">
              <div className="space-y-2">
                {AI_COST_BY_PROJECT.map((p) => (
                  <Link
                    to={`/projects/${p.id}`}
                    key={p.id}
                    data-testid={`row-project-${p.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:border-fuchsia-500/30 bg-white/[0.02] hover:bg-white/[0.06] transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{p.name}</div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        top model · <span className="text-fuchsia-300">{p.topModel}</span> · {fmtTokens(p.tokens)} tokens
                      </div>
                    </div>
                    <div className="w-32 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full bg-fuchsia-500" style={{ width: `${p.share}%` }} />
                    </div>
                    <div className="text-right w-24">
                      <div className="text-sm font-semibold text-white tabular">{fmtCurrency(p.month)}</div>
                      <div className="text-[11px] text-zinc-500 tabular">{fmtCurrency(p.today, { compact: false })} today</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600" />
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel testid="ai-cost-insight" title="AI insight" subtitle="Optimization suggestion" right={<Sparkles className="w-4 h-4 text-fuchsia-300" />}>
              <div className="space-y-3">
                <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300 mb-1">Cost optimization</div>
                  <div className="text-xs text-zinc-200 leading-relaxed">
                    Anthropic Opus 4.8 is <span className="text-fuchsia-300 font-semibold">46%</span> of your spend but only <span className="text-fuchsia-300 font-semibold">31%</span> of requests. Consider routing lightweight classification (2.1K req/day) to <span className="text-fuchsia-300 font-semibold">Gemini 2.5 Pro</span> — projected saving <span className="text-emerald-300 font-semibold">$1,240/mo</span>.
                  </div>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-amber-300 mb-1">Budget alert</div>
                  <div className="text-xs text-zinc-200 leading-relaxed">
                    At the current burn rate ({fmtCurrency(AI_COST_MONTHLY.total / AI_COST_MONTHLY.daysElapsed, { compact: false })}/day), you&apos;ll exhaust the monthly AI budget in <span className="text-amber-300 font-semibold">
                      {Math.max(0, Math.round((AI_COST_MONTHLY.budget - AI_COST_MONTHLY.total) / (AI_COST_MONTHLY.total / AI_COST_MONTHLY.daysElapsed)))}
                    </span> days.
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-emerald-300 mb-1">Latency insight</div>
                  <div className="text-xs text-zinc-200 leading-relaxed">
                    Average latency ({AI_COST_TODAY.avgLatencyMs}ms) is within SLA. Kimi shows lowest p95 latency — consider it for realtime routing.
                  </div>
                </div>
              </div>
            </Panel>
          </div>
    </div>
  );
};

const TabBtn = ({ active, onClick, icon: Icon, label, testid }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
      active ? "bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]" : "text-zinc-400 hover:text-zinc-100"
    }`}
  >
    <Icon className="w-3.5 h-3.5" /> {label}
  </button>
);

export default AiCost;
