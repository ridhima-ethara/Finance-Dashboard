import { Fragment, useMemo, useState } from "react";
import { DAILY_ACTIVITY, MODEL_TRAJECTORY, THRESHOLDS } from "../data/mockData";
import { fmtCurrency, fmtDate } from "../lib/format";
import { useApp } from "../context/AppContext";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar } from "recharts";
import { Calendar, TrendingUp, Activity, Plus, Send } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { toast } from "sonner";

const heatColor = (v, max) => {
  if (v === 0) return "rgba(255,255,255,0.03)";
  const t = v / max;
  if (t > 0.85) return "rgba(232,25,184,0.85)";
  if (t > 0.65) return "rgba(232,25,184,0.6)";
  if (t > 0.45) return "rgba(232,25,184,0.4)";
  if (t > 0.25) return "rgba(232,25,184,0.25)";
  return "rgba(232,25,184,0.12)";
};

const DailyEstimateDialog = ({ open, onOpenChange }) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("model");
  const [note, setNote] = useState("");
  const submit = () => {
    if (!amount) return toast.error("Enter an estimate amount");
    toast.success("Daily estimate submitted", { description: `${date} · ${category} · ${fmtCurrency(Number(amount), { compact: false })}` });
    onOpenChange(false);
    setAmount("");
    setNote("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] bg-[#12121A] border border-white/10 text-zinc-100" data-testid="daily-estimate-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-white">Enter daily estimate</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="de-date" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} data-testid="de-category" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40">
                <option value="model">AI Model</option>
                <option value="infra">Infrastructure</option>
                <option value="employee">Employee</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Amount (USD)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="de-amount" placeholder="2400" className="w-full h-10 pl-7 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
              </div>
            </Field>
          </div>
          <Field label="Note (optional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Additional context…" data-testid="de-note" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]" data-testid="de-cancel">Cancel</Button>
          <Button onClick={submit} data-testid="de-submit" className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white">
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Submit estimate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    {children}
  </div>
);

const Daily = () => {
  const { role } = useApp();
  const [openEstimate, setOpenEstimate] = useState(false);
  const maxSpend = Math.max(...DAILY_ACTIVITY.map((d) => d.spend));
  const totalToday = DAILY_ACTIVITY[DAILY_ACTIVITY.length - 1];
  const total7d = DAILY_ACTIVITY.slice(-7).reduce((s, d) => s + d.spend, 0);
  const total30d = DAILY_ACTIVITY.reduce((s, d) => s + d.spend, 0);
  const approvalsToday = totalToday?.approvals || 0;

  // Build calendar heatmap (5 rows × 7 cols)
  const weeks = useMemo(() => {
    const w = [[], [], [], [], []];
    // Pad start with empties to align first day-of-week
    const first = DAILY_ACTIVITY[0];
    const pad = first ? first.dow : 0;
    let cells = Array(pad).fill(null).concat(DAILY_ACTIVITY);
    // slice into rows of 7
    for (let i = 0; i < 5; i++) w[i] = cells.slice(i * 7, i * 7 + 7);
    return w;
  }, []);

  return (
    <div className="space-y-6" data-testid="page-daily">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <Calendar className="w-3 h-3" />
            Daily Ops
          </div>
          <h1 className="mt-2 font-display font-semibold text-3xl tracking-tight text-white">Daily activity</h1>
          <p className="text-sm text-zinc-400 mt-1">Day-by-day expenses, approvals, and Ops-entered estimates · last 30 days</p>
        </div>
        {(role === "TPM" || role === "R&D" || role === "PL" || role === "CTO") && (
          <Button
            onClick={() => setOpenEstimate(true)}
            className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-2 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="btn-enter-estimate"
          >
            <Plus className="w-4 h-4" />
            Enter daily estimate
          </Button>
        )}
      </div>

      {/* Today at a glance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's spend" value={fmtCurrency(totalToday?.spend || 0, { compact: false })} icon={Activity} tone="fuchsia" />
        <StatCard label="Approvals today" value={String(approvalsToday)} icon={TrendingUp} tone="sky" />
        <StatCard label="Last 7 days" value={fmtCurrency(total7d)} icon={Calendar} tone="emerald" />
        <StatCard label="Last 30 days" value={fmtCurrency(total30d)} icon={Calendar} tone="amber" />
      </div>

      {/* Calendar heatmap */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="calendar-heatmap">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-display font-semibold text-[15px] text-white">Calendar heatmap</div>
            <div className="text-xs text-zinc-500 mt-0.5">Deeper magenta = higher spend</div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-500">
            <span>Less</span>
            {[0.1, 0.25, 0.45, 0.65, 0.85].map((t, i) => (
              <span key={i} className="w-3 h-3 rounded-sm" style={{ background: heatColor(t * maxSpend, maxSpend) }} />
            ))}
            <span>More</span>
          </div>
        </div>
        <div className="grid grid-cols-8 gap-1">
          <div />
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-[10px] text-zinc-500 text-center">{d}</div>
          ))}
          {weeks.map((row, ri) => (
            <Fragment key={`row-${ri}`}>
              <div className="text-[10px] text-zinc-500 flex items-center justify-end pr-1">W{ri + 1}</div>
              {row.map((cell, ci) =>
                cell ? (
                  <div
                    key={`${ri}-${ci}`}
                    data-testid={`heat-${cell.date}`}
                    className="aspect-square rounded-md border border-white/5 hover:border-fuchsia-500/40 hover:scale-105 transition-all cursor-pointer group relative"
                    style={{ background: heatColor(cell.spend, maxSpend) }}
                    title={`${cell.date} · ${fmtCurrency(cell.spend, { compact: false })}`}
                  >
                    <div className="hidden group-hover:block absolute z-30 -top-1 left-1/2 -translate-x-1/2 -translate-y-full bg-[#0B0B12] border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] whitespace-nowrap shadow-xl">
                      <div className="text-zinc-100 font-semibold">{cell.date}</div>
                      <div className="text-fuchsia-300 tabular">{fmtCurrency(cell.spend, { compact: false })}</div>
                      <div className="text-zinc-500">{cell.approvals} approvals · {cell.expenses} expenses</div>
                    </div>
                  </div>
                ) : (
                  <div key={`${ri}-${ci}`} className="aspect-square rounded-md border border-white/[0.02] bg-transparent" />
                )
              )}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Daily bar + line combo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Daily spend vs estimate" subtitle="last 30 days">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DAILY_ACTIVITY}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(-2)} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} labelStyle={{ color: "#f4f4f5" }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="estimate" name="Estimate" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                <Bar dataKey="spend" name="Actual" fill="#E619B8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Per-model trajectory" subtitle="daily spend · last 30 days" testid="chart-model-trajectory">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MODEL_TRAJECTORY}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(d) => d.slice(-2)} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} labelStyle={{ color: "#f4f4f5" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Opus 4.7" stroke="#E619B8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Gemini 2.5 Pro" stroke="#3B82F6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="GPT-4o" stroke="#10B981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Sonnet" stroke="#F59E0B" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Kimi" stroke="#F97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Daily log */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 overflow-hidden" data-testid="daily-log">
        <div className="px-5 py-4 border-b border-white/5">
          <div className="font-display font-semibold text-[15px] text-white">Daily log</div>
          <div className="text-xs text-zinc-500 mt-0.5">Chronological · expenses &amp; approvals per day</div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-b border-white/5 bg-white/[0.02]">
              <th className="text-left py-2.5 px-5">Date</th>
              <th className="text-right py-2.5 px-2">Spend</th>
              <th className="text-right py-2.5 px-2">Estimate</th>
              <th className="text-right py-2.5 px-2">Δ</th>
              <th className="text-right py-2.5 px-2">Expenses</th>
              <th className="text-right py-2.5 px-5">Approvals</th>
            </tr>
          </thead>
          <tbody>
            {[...DAILY_ACTIVITY].reverse().slice(0, 14).map((d) => {
              const delta = d.estimate - d.spend;
              return (
                <tr key={d.date} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="py-2.5 px-5 text-sm text-zinc-100 tabular">{fmtDate(d.date)}</td>
                  <td className="py-2.5 px-2 text-right text-sm font-semibold text-white tabular">{fmtCurrency(d.spend, { compact: false })}</td>
                  <td className="py-2.5 px-2 text-right text-sm text-zinc-300 tabular">{fmtCurrency(d.estimate, { compact: false })}</td>
                  <td className={`py-2.5 px-2 text-right text-sm font-semibold tabular ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {delta >= 0 ? "+" : ""}{fmtCurrency(delta, { compact: false })}
                  </td>
                  <td className="py-2.5 px-2 text-right text-sm text-zinc-300 tabular">{d.expenses}</td>
                  <td className="py-2.5 px-5 text-right text-sm text-zinc-300 tabular">{d.approvals}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DailyEstimateDialog open={openEstimate} onOpenChange={setOpenEstimate} />
    </div>
  );
};

const toneMap = {
  fuchsia: "text-fuchsia-300",
  sky: "text-sky-300",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
};
const StatCard = ({ label, value, icon: Icon, tone = "fuchsia" }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
    <div className="flex items-center justify-between">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
        <Icon className={`w-3.5 h-3.5 ${toneMap[tone]}`} />
      </div>
    </div>
    <div className="mt-3 font-display font-semibold text-2xl tabular text-white">{value}</div>
  </div>
);

const ChartCard = ({ title, subtitle, children, testid }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
    <div className="mb-3">
      <div className="font-display font-semibold text-[15px] text-white">{title}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>
    </div>
    {children}
  </div>
);

export default Daily;
