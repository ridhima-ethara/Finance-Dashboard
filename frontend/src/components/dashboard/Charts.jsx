import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
} from "recharts";
import { PROJECTS, MONTHLY_SPEND, CATEGORY_BREAKDOWN, MODELS_USAGE, INFRA_BY_PROJECT } from "../../data/mockData";
import { fmtCurrency, fmtPct } from "../../lib/format";

// Palette
const COLORS = {
  budget: "#7C3AED",
  estimated: "#F59E0B",
  actual: "#EF4444",
  under: "#10B981",
  info: "#3B82F6",
  slate: "#94A3B8",
};

const CardShell = ({ title, subtitle, right, children, testid }) => (
  <div
    data-testid={testid}
    className="bg-white rounded-2xl border border-slate-200 p-5 card-hover"
  >
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <div className="text-[15px] font-semibold text-slate-900 font-display">{title}</div>
        {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 tabular">
      <div className="text-xs font-semibold text-slate-900">{label}</div>
      <div className="mt-1 space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
              <span className="text-slate-600 capitalize">{p.name}</span>
            </div>
            <span className="font-semibold text-slate-900">{fmtCurrency(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- Actual · Budget · Estimated (Grouped Bar) ----------
export const BudgetActualChart = () => {
  const data = PROJECTS.slice(0, 6).map((p) => ({
    name: p.name.split(" ")[0],
    Budget: p.approvedBudget,
    Estimated: p.estimatedBudget,
    Actual: p.actualSpend,
  }));
  return (
    <CardShell
      testid="chart-budget-actual"
      title="Actual · Budget · Estimated"
      subtitle="per project · last 30 days · $ thousands"
    >
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap={16}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F8FAFC" }} />
            <Legend
              iconType="square"
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(v) => <span className="text-slate-600 text-xs">{v}</span>}
            />
            <Bar dataKey="Budget" fill={COLORS.budget} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="Estimated" fill={COLORS.estimated} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="Actual" fill={COLORS.actual} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
};

// ---------- Model-wise expenses (Grouped Bar) ----------
export const ModelExpensesChart = () => {
  const data = MODELS_USAGE.map((m) => ({
    name: m.name,
    Budget: m.budget,
    Estimated: m.estimated,
    Actual: m.actual,
  }));
  return (
    <CardShell
      testid="chart-model-expenses"
      title="Model-wise expenses"
      subtitle="hue = model · shade = Budget → Estimated → Actual"
    >
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap={16}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F8FAFC" }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="Budget" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="Estimated" fill="#A78BFA" radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="Actual" fill="#DDD6FE" radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
};

// ---------- Infrastructure stacked by project ----------
export const InfraStackedChart = () => {
  return (
    <CardShell
      testid="chart-infra"
      title="Infrastructure by project"
      subtitle="infra $ per project · monthly"
    >
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={INFRA_BY_PROJECT}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F8FAFC" }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="EC2" stackId="a" fill="#7C3AED" maxBarSize={30} />
            <Bar dataKey="S3" stackId="a" fill="#10B981" maxBarSize={30} />
            <Bar dataKey="RDS" stackId="a" fill="#3B82F6" maxBarSize={30} />
            <Bar dataKey="SES" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
};

// ---------- Monthly spend trend ----------
export const MonthlySpendChart = () => {
  return (
    <CardShell
      testid="chart-monthly-spend"
      title="Monthly spend trend"
      subtitle="portfolio-wide · budget vs actual"
    >
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={MONTHLY_SPEND}>
            <defs>
              <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gBudget" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Area type="monotone" dataKey="budget" name="Budget" stroke="#10B981" fill="url(#gBudget)" strokeWidth={2} />
            <Area type="monotone" dataKey="actual" name="Actual" stroke="#7C3AED" fill="url(#gActual)" strokeWidth={2} />
            <Line type="monotone" dataKey="estimated" name="Estimated" stroke="#F59E0B" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
};

// ---------- Category donut ----------
export const CategoryDonut = () => {
  return (
    <CardShell
      testid="chart-category-donut"
      title="Expense breakdown"
      subtitle="portfolio · this month"
    >
      <div className="flex items-center gap-4">
        <div className="w-[180px] h-[180px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={CATEGORY_BREAKDOWN}
                dataKey="value"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
              >
                {CATEGORY_BREAKDOWN.map((c, i) => (
                  <Cell key={i} fill={c.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => `${v}%`}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Total</div>
            <div className="font-display text-xl font-semibold text-slate-900">100%</div>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-1 gap-1.5">
          {CATEGORY_BREAKDOWN.map((c) => (
            <div key={c.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.color }} />
                <span className="text-slate-700">{c.name}</span>
              </div>
              <span className="font-semibold text-slate-900 tabular">{c.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
};

// ---------- Utilization gauge/bar ----------
export const UtilizationBars = () => {
  const data = PROJECTS.map((p) => ({ name: p.name, util: p.utilization }));
  return (
    <CardShell
      testid="chart-utilization"
      title="Budget utilization"
      subtitle="per project · % of approved"
    >
      <div className="space-y-3">
        {data.map((d) => {
          const color = d.util >= 100 ? "#EF4444" : d.util >= 85 ? "#F59E0B" : "#10B981";
          const bg = d.util >= 100 ? "#FEE2E2" : d.util >= 85 ? "#FEF3C7" : "#D1FAE5";
          return (
            <div key={d.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-700 font-medium">{d.name}</span>
                <span className="font-semibold tabular" style={{ color }}>
                  {fmtPct(d.util)}
                </span>
              </div>
              <div className="h-2 rounded-full" style={{ background: bg }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(d.util, 100)}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
};

// ---------- Subscription usage panel ----------
import { SUBSCRIPTIONS } from "../../data/mockData";
import { CreditCard } from "lucide-react";
export const SubscriptionsPanel = () => {
  const totalSeats = SUBSCRIPTIONS.reduce((s, x) => s + x.seats, 0);
  return (
    <CardShell
      testid="panel-subscriptions"
      title={
        <span className="inline-flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-500" />
          Subscription usage · seat utilization
        </span>
      }
      subtitle="hover for people using each tool"
      right={
        <div className="text-xs text-slate-500 tabular">
          <span className="font-semibold text-slate-900">{SUBSCRIPTIONS.length}</span> subscriptions ·{" "}
          <span className="font-semibold text-slate-900">{totalSeats}</span> people
        </div>
      }
    >
      <div className="space-y-2">
        {SUBSCRIPTIONS.map((s) => (
          <div
            key={s.id}
            data-testid={`sub-${s.id}`}
            className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 transition-all group"
          >
            <div
              className="w-10 h-10 rounded-lg text-white text-xs font-semibold flex items-center justify-center flex-shrink-0"
              style={{ background: s.color }}
            >
              {s.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900">{s.name}</div>
              <div className="text-xs text-slate-500 tabular">
                ${s.price}
                {s.cadence} · {s.seats} seats
              </div>
            </div>
            <div className="flex -space-x-2">
              {s.users.slice(0, 4).map((u, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full border-2 border-white bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-[10px] font-semibold text-slate-700"
                  title={u}
                >
                  {u.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                </div>
              ))}
              {s.users.length > 4 && (
                <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-semibold text-slate-600">
                  +{s.users.length - 4}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
};

// ---------- Approval workflow visualizer ----------
import { CheckCircle2, Circle } from "lucide-react";
const STAGES = [
  { key: "req", label: "Budget Request", done: true },
  { key: "cto", label: "CTO Review", done: true },
  { key: "coo", label: "COO Approval", done: true, current: true },
  { key: "lock", label: "Budget Locked", done: false },
  { key: "exec", label: "Execution", done: false },
  { key: "mon", label: "Monitoring", done: false },
  { key: "top", label: "Top-up (if any)", done: false },
  { key: "close", label: "Closure", done: false },
];
export const WorkflowStrip = () => (
  <CardShell
    testid="workflow-strip"
    title="Budget approval workflow"
    subtitle="Project → CTO → COO → Locked → Execution → Monitoring → Top-up → Closure"
  >
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2 flex-shrink-0">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
              s.current
                ? "bg-violet-50 border-violet-200 text-violet-700"
                : s.done
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-slate-50 border-slate-200 text-slate-500"
            }`}
          >
            {s.done ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <Circle className="w-3.5 h-3.5" />
            )}
            {s.label}
          </div>
          {i < STAGES.length - 1 && <div className="w-4 h-px bg-slate-200" />}
        </div>
      ))}
    </div>
  </CardShell>
);
