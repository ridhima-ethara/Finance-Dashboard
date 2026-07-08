import { useState, Fragment } from "react";
import { RECOVERY } from "../../data/mockCfo";
import { PROJECTS } from "../../data/mockProjects";
import { fmtCurrency, fmtPct } from "../../lib/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Receipt, TrendingUp, Wallet, Building2, CheckCircle2, Clock3, AlertTriangle, DollarSign, ChevronDown, ChevronRight, MessageSquare, User as UserIcon } from "lucide-react";

// Seed phase-wise recovery data using each project's phases plus TPM remarks & client feedback.
const seedPhaseRecovery = (project) => {
  const phases = project.phases || [];
  const perPhaseTotal = phases.length ? Math.round(project.actualSpend / phases.length) : project.actualSpend;
  const clientReasons = [
    "Client accepted phase deliverables; recovery approved as per SOW.",
    "Pending client sign-off — awaiting stakeholder review this week.",
    "Client disputed portion of AI model spend; negotiating scope amendment.",
    "Fully approved for billing — invoice issued last cycle.",
    "Client requested itemised breakdown before releasing recovery.",
  ];
  const tpmRemarks = [
    "Phase closed with 2 days spare buffer. All acceptance criteria met.",
    "Model routing changes recommended for next phase — deferred to CFO review.",
    "Extended context testing pushed cost 12% above plan. Documented in change log.",
    "On-track delivery; TPM handover completed on time.",
    "Overrun driven by client-requested scope addition (evidence attached).",
  ];
  return phases.map((ph, i) => {
    const rec = Math.round(ph.actual * (project.recoverableFromClient ? 1 : 0.6));
    const invoiced = i < phases.length - 1 ? rec : Math.round(rec * 0.4);
    const received = i < phases.length - 2 ? invoiced : 0;
    const status = received >= invoiced && invoiced > 0 ? "recovered" : invoiced > 0 ? "invoiced" : "pending";
    return {
      id: `${project.id}-${ph.id}`,
      phaseId: ph.id,
      phaseName: ph.name,
      dates: ph.dates,
      estimated: ph.estimated,
      actual: ph.actual,
      recoverable: rec,
      invoiced,
      received,
      outstanding: invoiced - received,
      status,
      tpmRemarks: tpmRemarks[i % tpmRemarks.length],
      clientFeedback: clientReasons[i % clientReasons.length],
      closureDate: ph.dates,
    };
  });
};

const Recovery = () => {
  const recoverableProjects = PROJECTS.filter((p) => p.recoverableFromClient);
  const profitPct = RECOVERY.total > 0 ? Math.round(((RECOVERY.recovered - RECOVERY.netCost) / RECOVERY.total) * 100) : 0;
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <div className="space-y-6" data-testid="page-recovery">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-400">
          <Receipt className="w-3 h-3" />
          CFO Portal
        </div>
        <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Client cost recovery</h1>
        <p className="text-sm text-zinc-400 mt-1">Recoverable billable spend, invoicing status &amp; profitability per client</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Total recoverable" value={fmtCurrency(RECOVERY.total)} icon={Wallet} tone="magenta" testid="rec-total" />
        <Stat label="Recovered" value={fmtCurrency(RECOVERY.recovered)} icon={CheckCircle2} tone="positive" testid="rec-received" />
        <Stat label="Outstanding" value={fmtCurrency(RECOVERY.outstanding)} icon={Clock3} tone="warning" testid="rec-outstanding" />
        <Stat label="Net company cost" value={fmtCurrency(RECOVERY.netCost)} icon={DollarSign} testid="rec-net" />
        <Stat label="Profitability" value={`${profitPct >= 0 ? "+" : ""}${profitPct}%`} tone={profitPct >= 0 ? "positive" : "negative"} icon={TrendingUp} testid="rec-profit" />
        <Stat label="Recoverable projects" value={String(recoverableProjects.length)} icon={Building2} testid="rec-projects" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel testid="chart-trend" title="Recovery trend" subtitle="Recovered vs outstanding · monthly">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={RECOVERY.trend}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v)} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="recovered" name="Recovered" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="outstanding" name="Outstanding" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="chart-by-client" title="Recovery by client" subtitle="Invoiced · received · outstanding">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={RECOVERY.byClient}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="client" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v)} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="invoiced" name="Invoiced" fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="received" name="Received" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="outstanding" name="Outstanding" fill="#F59E0B" radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Client Table */}
      <Panel testid="client-table" title="Per-client recovery status" subtitle="Invoicing, receipts, outstanding, profitability">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">Client</th>
                <th className="text-right py-2 px-3">Recoverable</th>
                <th className="text-right py-2 px-3">Invoiced</th>
                <th className="text-right py-2 px-3">Received</th>
                <th className="text-right py-2 px-3">Outstanding</th>
                <th className="text-right py-2 px-3">Profitability</th>
              </tr>
            </thead>
            <tbody>
              {RECOVERY.byClient.map((c) => (
                <tr key={c.client} data-testid={`client-${c.client.toLowerCase().replace(/\s+/g, "-")}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="py-3 px-3 text-white font-medium">{c.client}</td>
                  <td className="py-3 px-3 text-right text-zinc-200 tabular">{fmtCurrency(c.recoverable)}</td>
                  <td className="py-3 px-3 text-right text-white font-semibold tabular">{fmtCurrency(c.invoiced)}</td>
                  <td className="py-3 px-3 text-right text-emerald-300 tabular">{fmtCurrency(c.received)}</td>
                  <td className="py-3 px-3 text-right text-amber-300 tabular">{fmtCurrency(c.outstanding)}</td>
                  <td className="py-3 px-3 text-right tabular">
                    <span className={`font-semibold ${c.profitability >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {c.profitability >= 0 ? "+" : ""}{c.profitability}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Recoverable Projects — expandable phase-wise view */}
      <Panel testid="recoverable-projects" title="Recoverable projects" subtitle="Click a project to expand phase-wise recovery, TPM remarks &amp; client feedback">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3 w-8" />
                <th className="text-left py-2 px-3">Project</th>
                <th className="text-left py-2 px-3">Client</th>
                <th className="text-right py-2 px-3">Actual spend</th>
                <th className="text-right py-2 px-3">Recovered</th>
                <th className="text-right py-2 px-3">Net cost</th>
                <th className="text-left py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recoverableProjects.map((p) => {
                const net = p.actualSpend - (p.recoveredAmount || 0);
                const status = p.recoveredAmount >= p.actualSpend * 0.8 ? "on-track" : p.recoveredAmount > 0 ? "partial" : "pending";
                const isOpen = !!expanded[p.id];
                const phaseRecovery = seedPhaseRecovery(p);
                return (
                  <Fragment key={p.id}>
                    <tr
                      data-testid={`proj-rec-${p.id}`}
                      className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer"
                      onClick={() => toggle(p.id)}
                    >
                      <td className="py-3 px-3 text-zinc-500">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="py-3 px-3 text-white font-medium">{p.name}</td>
                      <td className="py-3 px-3 text-zinc-300 text-xs">{p.client}</td>
                      <td className="py-3 px-3 text-right text-zinc-200 tabular">{fmtCurrency(p.actualSpend)}</td>
                      <td className="py-3 px-3 text-right text-emerald-300 tabular">{fmtCurrency(p.recoveredAmount || 0)}</td>
                      <td className="py-3 px-3 text-right text-white font-semibold tabular">{fmtCurrency(net)}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          status === "on-track" ? "bg-emerald-500/15 text-emerald-300" : status === "partial" ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"
                        }`}>
                          {status === "on-track" ? <CheckCircle2 className="w-3 h-3" /> : status === "partial" ? <Clock3 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {status}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr data-testid={`proj-rec-detail-${p.id}`} className="bg-white/[0.02]">
                        <td colSpan={7} className="px-3 py-4">
                          <div className="pl-6 pr-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Phase-wise recovery</div>
                              <div className="text-[10px] text-zinc-500 tabular">{phaseRecovery.length} phases · surfaced to CFO &amp; CTO</div>
                            </div>
                            {phaseRecovery.map((ph) => (
                              <div key={ph.id} data-testid={`phase-rec-${ph.id}`} className="rounded-lg border border-white/5 bg-[#0F0F17] p-3">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                  <div className="flex-1 min-w-[180px]">
                                    <div className="flex items-center gap-2">
                                      <div className="text-sm font-semibold text-white">{ph.phaseName}</div>
                                      <span className="text-[10px] text-zinc-500 tabular">{ph.dates}</span>
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                                        ph.status === "recovered" ? "bg-emerald-500/15 text-emerald-300" : ph.status === "invoiced" ? "bg-fuchsia-500/15 text-fuchsia-300" : "bg-amber-500/15 text-amber-300"
                                      }`}>
                                        {ph.status}
                                      </span>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      <MiniStat label="Recoverable" value={fmtCurrency(ph.recoverable, { compact: false })} tone="magenta" />
                                      <MiniStat label="Invoiced" value={fmtCurrency(ph.invoiced, { compact: false })} />
                                      <MiniStat label="Received" value={fmtCurrency(ph.received, { compact: false })} tone="positive" />
                                      <MiniStat label="Outstanding" value={fmtCurrency(ph.outstanding, { compact: false })} tone={ph.outstanding > 0 ? "warning" : "positive"} />
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300 mb-1 flex items-center gap-1">
                                      <UserIcon className="w-3 h-3" /> TPM remarks (phase closure)
                                    </div>
                                    <div className="text-[12px] text-zinc-200 leading-relaxed">{ph.tpmRemarks}</div>
                                  </div>
                                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <div className="text-[10px] uppercase tracking-widest font-semibold text-emerald-300 mb-1 flex items-center gap-1">
                                      <MessageSquare className="w-3 h-3" /> Client feedback / reason
                                    </div>
                                    <div className="text-[12px] text-zinc-200 leading-relaxed">{ph.clientFeedback}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

const MiniStat = ({ label, value, tone = "neutral" }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white", magenta: "text-fuchsia-300" };
  return (
    <div className="rounded-md bg-white/[0.02] border border-white/5 p-1.5">
      <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className={`text-[12px] font-semibold tabular mt-0.5 ${tones[tone]}`}>{value}</div>
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
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white", magenta: "text-fuchsia-300" };
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
      {sub && <div className="mt-1 text-[10px] text-zinc-500 tabular">{sub}</div>}
    </div>
  );
};

export default Recovery;
