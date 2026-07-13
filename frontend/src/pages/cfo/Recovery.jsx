import { useMemo, useState, Fragment } from "react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
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
import {
  Receipt,
  TrendingUp,
  Wallet,
  Building2,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  DollarSign,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  User as UserIcon,
} from "lucide-react";

const statusTone = {
  recovered: "bg-emerald-500/15 text-emerald-300",
  "partial-recovered": "bg-amber-500/15 text-amber-300",
  "pending-cfo": "bg-fuchsia-500/15 text-fuchsia-300",
  "non-recoverable": "bg-zinc-500/15 text-zinc-300",
};

const formatMonth = (value) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

const Recovery = () => {
  const { projects, batchDeliveries } = useApp();
  const [expanded, setExpanded] = useState({});
  const financeDeliveries = useMemo(
    () => batchDeliveries.filter((delivery) => delivery.stage !== "rnd-review"),
    [batchDeliveries]
  );

  const recoveryProjects = useMemo(() => {
    const projectIds = new Set(financeDeliveries.map((delivery) => delivery.projectId));
    return projects
      .filter((project) => project.recoverableFromClient || projectIds.has(project.id))
      .map((project) => {
        const deliveries = financeDeliveries.filter((delivery) => delivery.projectId === project.id);
        const actualSpend = Number(project.cfoActualSpend || project.actualSpend || 0);
        const proposed = deliveries.reduce((sum, delivery) => sum + Number(delivery.proposedAmount || 0), 0);
        const recovered = deliveries.reduce((sum, delivery) => sum + Number(delivery.actualRecovered || 0), 0);
        const outstanding = Math.max(0, actualSpend - recovered);
        const phaseRows = deliveries.map((delivery) => {
          const phase = (project.phases || []).find((entry) => entry.id === delivery.phaseId || entry.name === delivery.phaseName);
          const phaseActual = Number(phase?.actual || phase?.estimated || delivery.proposedAmount || 0);
          const actualRecovered = Number(delivery.actualRecovered || 0);
          return {
            id: delivery.id,
            phaseName: delivery.phaseName,
            dates: phase?.dates || "Live delivery",
            actual: phaseActual,
            recoverable: Number(delivery.proposedAmount || 0),
            received: actualRecovered,
            outstanding: Math.max(0, Number(delivery.proposedAmount || 0) - actualRecovered),
            variance: actualRecovered - Number(delivery.proposedAmount || 0),
            status: delivery.status,
            deliveryNote: delivery.clientComment || "No TPM delivery note recorded.",
            cfoNote: delivery.cfoNote || "No Finance note recorded yet.",
            closureDate: delivery.deliveredAt,
            clientRepresentative: delivery.clientRepresentative || "—",
            deliveredBy: delivery.deliveredBy || project.tpm || "TPM",
            isRecoverable: delivery.isRecoverable !== false,
          };
        });
        const status = outstanding <= 0
          ? "on-track"
          : recovered > 0
            ? "partial"
            : deliveries.some((delivery) => delivery.status === "pending-cfo")
              ? "awaiting-finance"
              : "pending";
        return {
          ...project,
          actualSpend,
          proposed,
          recovered,
          outstanding,
          netCost: Math.max(0, actualSpend - recovered),
          profitability: actualSpend > 0 ? Math.round(((recovered - actualSpend) / actualSpend) * 100) : 0,
          status,
          phaseRows,
        };
      });
  }, [projects, financeDeliveries]);

  const recoveryStats = useMemo(() => {
    const total = recoveryProjects.reduce((sum, project) => sum + project.actualSpend, 0);
    const recovered = recoveryProjects.reduce((sum, project) => sum + project.recovered, 0);
    const outstanding = recoveryProjects.reduce((sum, project) => sum + project.outstanding, 0);
    const netCost = Math.max(0, total - recovered);
    const profitPct = total > 0 ? Math.round(((recovered - netCost) / total) * 100) : 0;
    return {
      total,
      recovered,
      outstanding,
      netCost,
      profitPct,
    };
  }, [recoveryProjects]);

  const trend = useMemo(() => {
    const byMonth = new Map();
    financeDeliveries.forEach((delivery) => {
      const date = (delivery.cfoAt || delivery.deliveredAt || "").slice(0, 7);
      if (!date) return;
      const current = byMonth.get(date) || { month: date, recovered: 0, outstanding: 0 };
      const proposed = Number(delivery.proposedAmount || 0);
      const actual = Number(delivery.actualRecovered || 0);
      current.recovered += actual;
      current.outstanding += Math.max(0, proposed - actual);
      byMonth.set(date, current);
    });
    return Array.from(byMonth.values()).sort((left, right) => left.month.localeCompare(right.month));
  }, [financeDeliveries]);

  const byClient = useMemo(() => {
    const map = new Map();
    recoveryProjects.forEach((project) => {
      const current = map.get(project.client) || {
        client: project.client,
        recoverable: 0,
        invoiced: 0,
        received: 0,
        outstanding: 0,
        profitability: 0,
      };
      current.recoverable += project.actualSpend;
      current.invoiced += project.proposed;
      current.received += project.recovered;
      current.outstanding += project.outstanding;
      map.set(project.client, current);
    });
    return Array.from(map.values()).map((entry) => ({
      ...entry,
      profitability: entry.recoverable > 0 ? Math.round(((entry.received - entry.recoverable) / entry.recoverable) * 100) : 0,
    }));
  }, [recoveryProjects]);

  const toggle = (id) => setExpanded((current) => ({ ...current, [id]: !current[id] }));

  return (
    <div className="space-y-6" data-testid="page-recovery">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-400">
          <Receipt className="w-3 h-3" />
          CFO Portal
        </div>
        <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">Client cost recovery</h1>
        <p className="text-sm text-zinc-400 mt-1">Live recoverable spend, actual recovery, and CFO variance by project and client.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Total recoverable" value={fmtCurrency(recoveryStats.total)} icon={Wallet} tone="magenta" testid="rec-total" />
        <Stat label="Recovered" value={fmtCurrency(recoveryStats.recovered)} icon={CheckCircle2} tone="positive" testid="rec-received" />
        <Stat label="Outstanding" value={fmtCurrency(recoveryStats.outstanding)} icon={Clock3} tone="warning" testid="rec-outstanding" />
        <Stat label="Net company cost" value={fmtCurrency(recoveryStats.netCost)} icon={DollarSign} testid="rec-net" />
        <Stat label="Profitability" value={`${recoveryStats.profitPct >= 0 ? "+" : ""}${recoveryStats.profitPct}%`} tone={recoveryStats.profitPct >= 0 ? "positive" : "negative"} icon={TrendingUp} testid="rec-profit" />
        <Stat label="Recoverable projects" value={String(recoveryProjects.length)} icon={Building2} testid="rec-projects" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel testid="chart-trend" title="Recovery trend" subtitle="Recovered vs outstanding · live deliveries">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={formatMonth} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(value) => fmtCurrency(value)} labelFormatter={formatMonth} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="recovered" name="Recovered" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="outstanding" name="Outstanding" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel testid="chart-by-client" title="Recovery by client" subtitle="Recoverable · received · outstanding">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClient}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                <XAxis dataKey="client" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(value) => fmtCurrency(value)} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="recoverable" name="Recoverable" fill="#E619B8" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="received" name="Received" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="outstanding" name="Outstanding" fill="#F59E0B" radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel testid="client-table" title="Per-client recovery status" subtitle="Recoverable spend, proposed recovery, actual recovery, and outstanding">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3">Client</th>
                <th className="text-right py-2 px-3">Recoverable</th>
                <th className="text-right py-2 px-3">Proposed</th>
                <th className="text-right py-2 px-3">Received</th>
                <th className="text-right py-2 px-3">Outstanding</th>
                <th className="text-right py-2 px-3">Variance</th>
              </tr>
            </thead>
            <tbody>
              {byClient.map((client) => (
                <tr key={client.client} data-testid={`client-${client.client.toLowerCase().replace(/\s+/g, "-")}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="py-3 px-3 text-white font-medium">{client.client}</td>
                  <td className="py-3 px-3 text-right text-zinc-200 tabular">{fmtCurrency(client.recoverable)}</td>
                  <td className="py-3 px-3 text-right text-fuchsia-300 font-semibold tabular">{fmtCurrency(client.invoiced)}</td>
                  <td className="py-3 px-3 text-right text-emerald-300 tabular">{fmtCurrency(client.received)}</td>
                  <td className="py-3 px-3 text-right text-amber-300 tabular">{fmtCurrency(client.outstanding)}</td>
                  <td className="py-3 px-3 text-right tabular">
                    <span className={`font-semibold ${client.profitability >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {client.profitability >= 0 ? "+" : ""}{client.profitability}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel testid="recoverable-projects" title="Recoverable projects" subtitle="Expand a project to see phase-wise delivery, TPM note, CFO recovery, and variance">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <th className="text-left py-2 px-3 w-8" />
                <th className="text-left py-2 px-3">Project</th>
                <th className="text-left py-2 px-3">Client</th>
                <th className="text-right py-2 px-3">Actual spend</th>
                <th className="text-right py-2 px-3">Recovered</th>
                <th className="text-right py-2 px-3">Outstanding</th>
                <th className="text-left py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recoveryProjects.map((project) => {
                const isOpen = !!expanded[project.id];
                return (
                  <Fragment key={project.id}>
                    <tr
                      data-testid={`proj-rec-${project.id}`}
                      className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer"
                      onClick={() => toggle(project.id)}
                    >
                      <td className="py-3 px-3 text-zinc-500">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="py-3 px-3 text-white font-medium">{project.name}</td>
                      <td className="py-3 px-3 text-zinc-300 text-xs">{project.client}</td>
                      <td className="py-3 px-3 text-right text-zinc-200 tabular">{fmtCurrency(project.actualSpend)}</td>
                      <td className="py-3 px-3 text-right text-emerald-300 tabular">{fmtCurrency(project.recovered)}</td>
                      <td className="py-3 px-3 text-right text-white font-semibold tabular">{fmtCurrency(project.outstanding)}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          project.status === "on-track"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : project.status === "partial"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-fuchsia-500/15 text-fuchsia-300"
                        }`}>
                          {project.status === "on-track" ? <CheckCircle2 className="w-3 h-3" /> : project.status === "partial" ? <Clock3 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {project.status}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr data-testid={`proj-rec-detail-${project.id}`} className="bg-white/[0.02]">
                        <td colSpan={7} className="px-3 py-4">
                          <div className="pl-6 pr-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Phase-wise recovery</div>
                              <div className="text-[10px] text-zinc-500 tabular">{project.phaseRows.length} deliveries · live CFO recovery state</div>
                            </div>
                            {project.phaseRows.length === 0 && (
                              <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs text-zinc-500">
                                No deliverables have been handed to Finance for this project yet.
                              </div>
                            )}
                            {project.phaseRows.map((phase) => (
                              <div key={phase.id} data-testid={`phase-rec-${phase.id}`} className="rounded-lg border border-white/5 bg-[#0F0F17] p-3">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                  <div className="flex-1 min-w-[180px]">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className="text-sm font-semibold text-white">{phase.phaseName}</div>
                                      <span className="text-[10px] text-zinc-500 tabular">{phase.dates}</span>
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${statusTone[phase.status] || statusTone["pending-cfo"]}`}>
                                        {phase.status}
                                      </span>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                                      <MiniStat label="Actual cost" value={fmtCurrency(phase.actual, { compact: false })} />
                                      <MiniStat label="Recoverable" value={fmtCurrency(phase.recoverable, { compact: false })} tone="magenta" />
                                      <MiniStat label="Recovered" value={fmtCurrency(phase.received, { compact: false })} tone="positive" />
                                      <MiniStat label="Outstanding" value={fmtCurrency(phase.outstanding, { compact: false })} tone={phase.outstanding > 0 ? "warning" : "positive"} />
                                      <MiniStat label="Variance" value={`${phase.variance >= 0 ? "+" : ""}${fmtCurrency(phase.variance, { compact: false })}`} tone={phase.variance >= 0 ? "positive" : "negative"} />
                                    </div>
                                    <div className="mt-2 text-[11px] text-zinc-500">
                                      Delivered by <span className="text-zinc-300">{phase.deliveredBy}</span> · Client rep <span className="text-zinc-300">{phase.clientRepresentative}</span> · {phase.isRecoverable ? "Recoverable" : "Non-recoverable"}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <div className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300 mb-1 flex items-center gap-1">
                                      <UserIcon className="w-3 h-3" /> TPM / delivery note
                                    </div>
                                    <div className="text-[12px] text-zinc-200 leading-relaxed">{phase.deliveryNote}</div>
                                  </div>
                                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <div className="text-[10px] uppercase tracking-widest font-semibold text-emerald-300 mb-1 flex items-center gap-1">
                                      <MessageSquare className="w-3 h-3" /> CFO recovery note
                                    </div>
                                    <div className="text-[12px] text-zinc-200 leading-relaxed">{phase.cfoNote}</div>
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

const Panel = ({ title, subtitle, children, testid }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
    <div className="mb-3">
      <div className="font-display font-semibold text-[15px] text-white">{title}</div>
      {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
    </div>
    {children}
  </div>
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

const MiniStat = ({ label, value, tone = "neutral" }) => {
  const tones = {
    positive: "text-emerald-300",
    negative: "text-red-300",
    warning: "text-amber-300",
    neutral: "text-white",
    magenta: "text-fuchsia-300",
  };
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold tabular ${tones[tone]}`}>{value}</div>
    </div>
  );
};

export default Recovery;
