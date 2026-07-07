import { useMemo, useState } from "react";
import { MONTHLY_SPEND } from "../../data/mockFinance";
import { PROJECTS } from "../../data/mockProjects";
import { fmtCurrency } from "../../lib/format";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { TrendingUp, Sparkles, ChevronRight, Cpu, ListChecks, Bot, Target } from "lucide-react";
import { Button } from "../../components/ui/button";

const PROJECT_TYPES = [
  { id: "rnd", label: "R&D", overrunPct: 62 },
  { id: "prod", label: "Production", overrunPct: 34 },
  { id: "eval", label: "Model eval", overrunPct: 71 },
  { id: "ingest", label: "Data ingest", overrunPct: 22 },
  { id: "poc", label: "Client PoC", overrunPct: 48 },
];

const MODELS = ["Opus 4.8", "Sonnet", "GPT-4o", "Gemini 2.5 Pro", "Kimi", "Grok-2"];

// Base forecast — extrapolate from last 3 months
const buildForecast = () => {
  const base = MONTHLY_SPEND.slice(-3).reduce((s, m) => s + m.actual, 0) / 3;
  const rows = [
    { month: "Jun", base: MONTHLY_SPEND[MONTHLY_SPEND.length - 1].actual, optimistic: null, pessimistic: null, actual: MONTHLY_SPEND[MONTHLY_SPEND.length - 1].actual },
  ];
  ["Jul", "Aug", "Sep"].forEach((m, i) => {
    const growth = 1.05 + i * 0.04;
    const b = Math.round(base * growth);
    rows.push({
      month: m,
      base: b,
      optimistic: Math.round(b * 0.85),
      pessimistic: Math.round(b * 1.20),
      actual: null,
    });
  });
  return rows;
};

const MonthlyForecast = () => {
  const [projType, setProjType] = useState("rnd");
  const [tasks, setTasks] = useState(24);
  const [selectedModel, setSelectedModel] = useState("Opus 4.8");

  const forecast = useMemo(buildForecast, []);

  // Recommendation engine
  const baseEstimate = useMemo(() => {
    const perTask = selectedModel === "Opus 4.8" ? 220 : selectedModel === "Gemini 2.5 Pro" ? 90 : selectedModel === "GPT-4o" ? 140 : 60;
    const scale = projType === "rnd" ? 1.4 : projType === "eval" ? 1.6 : projType === "prod" ? 1.0 : projType === "poc" ? 1.2 : 0.8;
    return Math.round(tasks * perTask * scale);
  }, [projType, tasks, selectedModel]);
  const buffered = Math.round(baseEstimate * 1.25);
  const risk = projType === "rnd" || projType === "eval" ? "High" : projType === "poc" ? "Medium" : "Low";
  const overrunProb = PROJECT_TYPES.find((t) => t.id === projType)?.overrunPct || 40;

  const similar = [
    { name: "Crowley Generation", desc: `Similar model mix · ${tasks - 4} tasks`, match: "high" },
    { name: "Kaiju Eval", desc: `Same model family · ${tasks + 3} tasks`, match: "high" },
    { name: "Talos", desc: `Different provider · ${tasks - 8} tasks`, match: "partial" },
  ];

  return (
    <div className="space-y-6" data-testid="page-monthly-forecast">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-400">
            <TrendingUp className="w-3 h-3" /> CFO Portal
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Monthly forecast</h1>
          <p className="text-sm text-zinc-400 mt-1">
            AI-powered budget recommendations, overrun probability &amp; 3-month portfolio spend forecast
          </p>
        </div>
      </div>

      {/* Recommendation engine + overrun probability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="rec-engine">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-fuchsia-300" />
            <div className="font-display font-semibold text-[15px] text-white">Budget recommendation engine</div>
          </div>
          <div className="text-xs text-zinc-400 mb-4">
            Enter project parameters — we&apos;ll produce base &amp; buffered estimates plus a risk rating from historical patterns
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Project type">
              <select
                value={projType}
                onChange={(e) => setProjType(e.target.value)}
                data-testid="fc-input-type"
                className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Task count">
              <input
                type="number"
                value={tasks}
                onChange={(e) => setTasks(Number(e.target.value) || 0)}
                data-testid="fc-input-tasks"
                className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </Field>
            <Field label="Primary model">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                data-testid="fc-input-model"
                className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <RecommendCell label="Base estimate" value={fmtCurrency(baseEstimate, { compact: false })} color="text-sky-300" testid="rec-base" />
            <RecommendCell label="+25% buffer" value={fmtCurrency(buffered, { compact: false })} color="text-amber-300" testid="rec-buffered" />
            <RecommendCell label="Risk rating" value={risk} color={risk === "High" ? "text-red-300" : risk === "Medium" ? "text-amber-300" : "text-emerald-300"} testid="rec-risk" />
          </div>

          <div className="mt-4 text-xs text-zinc-400 leading-relaxed rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            <span>
              Based on {similar.length} historical projects matching this profile, expect ~<span className="text-fuchsia-300 font-semibold tabular">{overrunProb}%</span> probability of overrun. Consider allocating a hidden buffer of 8–12% in addition to the +25% shown here.
            </span>
          </div>
        </div>

        {/* Overrun probability + Similar historical projects */}
        <div className="space-y-4">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="overrun-prob">
            <div className="font-display font-semibold text-[15px] text-white mb-1">Overrun probability by project type</div>
            <div className="text-xs text-zinc-500 mb-3">Historical data · higher = more likely to exceed estimate</div>
            <div className="space-y-2.5">
              {PROJECT_TYPES.map((t) => {
                const color = t.overrunPct >= 60 ? "#EF4444" : t.overrunPct >= 40 ? "#F59E0B" : "#10B981";
                return (
                  <div key={t.id} data-testid={`overrun-${t.id}`}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zinc-200 font-medium">{t.label}</span>
                      <span className="font-semibold tabular" style={{ color }}>{t.overrunPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${t.overrunPct}%`, background: `linear-gradient(90deg, #10B981, ${color})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="similar-projects">
            <div className="font-display font-semibold text-[15px] text-white mb-3">Similar historical projects</div>
            <div className="space-y-2">
              {similar.map((s) => (
                <div key={s.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
                  <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center flex-shrink-0">
                    <Target className="w-3.5 h-3.5 text-fuchsia-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{s.name}</div>
                    <div className="text-[11px] text-zinc-500 truncate">{s.desc}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                    s.match === "high" ? "bg-red-500/15 text-red-300 border border-red-500/30" : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  }`}>
                    {s.match === "high" ? "Match" : "Partial"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio spend forecast chart */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="portfolio-forecast">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">Portfolio spend forecast · next 3 months</div>
            <div className="text-xs text-zinc-500 mt-0.5">Base forecast vs optimistic (−15%) vs pessimistic (+20%) scenarios</div>
          </div>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forecast}>
              <defs>
                <linearGradient id="pess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => (v ? fmtCurrency(v) : "—")} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="pessimistic" name="Pessimistic (+20%)" stroke="#EF4444" strokeDasharray="5 3" fill="url(#pess)" strokeWidth={2} />
              <Line type="monotone" dataKey="base" name="Base forecast" stroke="#4F8EF7" strokeWidth={2.5} dot={{ r: 4, fill: "#4F8EF7" }} />
              <Line type="monotone" dataKey="optimistic" name="Optimistic (−15%)" stroke="#10B981" strokeDasharray="5 3" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="actual" name="Actual (last)" stroke="#E619B8" strokeWidth={3} dot={{ r: 5, fill: "#E619B8" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-start gap-2 text-xs text-zinc-300">
          <Sparkles className="w-3.5 h-3.5 text-fuchsia-300 flex-shrink-0 mt-0.5" />
          <span>
            <span className="text-fuchsia-200 font-semibold">AI insight: </span>
            Base forecast projects <span className="text-white font-semibold tabular">{fmtCurrency(forecast[3].base)}</span> spend in Sep — a{" "}
            <span className="text-white font-semibold tabular">{Math.round(((forecast[3].base - forecast[0].base) / forecast[0].base) * 100)}%</span> increase over Jun.
            Pessimistic scenario ({fmtCurrency(forecast[3].pessimistic)}) would require top-ups; consider pre-approving a{" "}
            <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(forecast[3].pessimistic - forecast[3].base)}</span> buffer.
          </span>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    {children}
  </div>
);

const RecommendCell = ({ label, value, color, testid }) => (
  <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3" data-testid={testid}>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className={`font-display text-2xl font-semibold tabular mt-1 ${color}`}>{value}</div>
  </div>
);

export default MonthlyForecast;
