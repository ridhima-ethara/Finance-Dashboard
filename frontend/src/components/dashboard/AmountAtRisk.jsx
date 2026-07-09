import { AlertTriangle, TrendingDown } from "lucide-react";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { PORTFOLIO } from "../../data/mockData";

const AmountAtRisk = () => {
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
            {fmtCurrency(PORTFOLIO.amountAtRisk)}
          </div>
          <div className="text-zinc-400 text-base font-medium tabular pb-2">
            of {fmtCurrency(PORTFOLIO.approvedBudget)} approved
          </div>
        </div>

        <div className="mt-3 text-sm text-zinc-400 flex items-center gap-2">
          <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          <span>{PORTFOLIO.flagged} of {PORTFOLIO.total} projects flagged · forecast overrun {fmtCurrency(Math.abs(PORTFOLIO.forecastVariance))}</span>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-5" data-testid="amount-at-risk-metrics">
          <Metric label="Over budget" value={`${PORTFOLIO.projectsOverBudget} projects`} tone="danger" />
          <Metric label="Health score" value={`${PORTFOLIO.healthScore}/100`} tone="warning" />
          <Metric label="Est. accuracy" value={fmtPct(PORTFOLIO.accuracy)} tone="magenta" />
          <Metric label="Flagged" value={`${PORTFOLIO.flagged} / ${PORTFOLIO.total}`} tone="warning" />
          <Metric label="Forecast overrun" value={fmtCurrency(Math.abs(PORTFOLIO.forecastVariance))} tone="danger" />
          <Metric label="Approved cap" value={fmtCurrency(PORTFOLIO.approvedBudget)} tone="magenta" />
        </div>
      </div>
    </div>
  );
};

const Metric = ({ label, value, tone }) => {
  const dot =
    tone === "danger" ? "bg-red-400" : tone === "warning" ? "bg-amber-400" : tone === "magenta" ? "bg-fuchsia-400" : "bg-white/60";
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-display font-semibold tabular text-white">{value}</div>
    </div>
  );
};

export default AmountAtRisk;
