import { AlertTriangle } from "lucide-react";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { useApp } from "../../context/AppContext";
import { summarizeLoggedProject } from "../../lib/projectMetrics";

const AmountAtRisk = () => {
  const { projects, taskLogs } = useApp();
  const portfolio = projects.reduce((acc, project) => {
    const usage = summarizeLoggedProject(project, taskLogs);
    const spend = Math.max(Number(project.actualSpend || 0), Number(usage.loggedSpend || 0));
    const approved = Number(project.approvedBudget || 0);
    acc.approvedBudget += approved;
    acc.amountAtRisk += Math.max(0, spend - approved);
    acc.projectsOverBudget += spend > approved ? 1 : 0;
    acc.healthScore += approved > 0 ? Math.max(0, 100 - Math.round((Math.max(0, spend - approved) / approved) * 100)) : 0;
    acc.accuracy += approved > 0 ? Math.max(0, 100 - Math.round((Math.abs(approved - spend) / approved) * 100)) : 0;
    return acc;
  }, {
    approvedBudget: 0,
    amountAtRisk: 0,
    projectsOverBudget: 0,
    healthScore: 0,
    accuracy: 0,
  });
  const projectCount = projects.length || 1;
  const metrics = {
    ...portfolio,
    healthScore: projects.length ? Math.round(portfolio.healthScore / projectCount) : 0,
    accuracy: projects.length ? Math.round(portfolio.accuracy / projectCount) : 0,
  };

  return (
    <div
      data-testid="hero-amount-at-risk"
      className="relative overflow-hidden rounded-2xl p-7 grain min-h-[220px] card-hover"
      style={{
        background:
          "radial-gradient(120% 140% at 0% 0%, rgba(232,25,184,0.25) 0%, rgba(232,25,184,0.05) 40%, rgba(0,0,0,0) 70%), linear-gradient(135deg, #1A0A16 0%, #12080F 50%, #0D0509 100%)",
        border: "1px solid rgba(232,25,184,0.25)",
        color: "#fff",
      }}
    >
      {/* Wireframe grid backdrop */}
      <div className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Decorative rings */}
      <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full border border-fuchsia-500/10" />
      <div className="absolute -right-12 -top-12 w-52 h-52 rounded-full border border-fuchsia-500/10" />
      <div className="absolute right-6 top-6 w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_16px_rgba(232,25,184,0.8)]" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-semibold text-fuchsia-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          Amount at risk · portfolio exposure
        </div>

        <div className="mt-4 flex items-end gap-3 flex-wrap">
          <div className="font-display font-bold text-6xl tabular leading-none">
            {fmtCurrency(metrics.amountAtRisk)}
          </div>
          <div className="text-zinc-400 text-base font-medium tabular pb-2">
            of {fmtCurrency(metrics.approvedBudget)} approved
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl" data-testid="amount-at-risk-metrics">
          <Metric label="Over budget" value={`${metrics.projectsOverBudget} projects`} tone="danger" />
          <Metric label="Health score" value={`${metrics.healthScore}/100`} tone="warning" />
          <Metric label="Est. accuracy" value={fmtPct(metrics.accuracy)} tone="magenta" />
        </div>
      </div>
    </div>
  );
};

const Metric = ({ label, value, tone }) => {
  const dot =
    tone === "danger" ? "bg-red-400" : tone === "warning" ? "bg-amber-400" : tone === "magenta" ? "bg-fuchsia-400" : "bg-white/60";
  return (
    <div className="h-full rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-display font-semibold tabular text-white">{value}</div>
    </div>
  );
};

export default AmountAtRisk;
