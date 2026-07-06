import { AlertTriangle } from "lucide-react";
import { fmtCurrency, fmtPct } from "../../lib/format";
import { PORTFOLIO } from "../../data/mockData";

const AmountAtRisk = () => {
  return (
    <div
      data-testid="hero-amount-at-risk"
      className="relative overflow-hidden rounded-2xl p-7 grain col-span-1 lg:col-span-2 min-h-[220px] card-hover"
      style={{
        background:
          "linear-gradient(135deg, #B91C1C 0%, #DC2626 45%, #EF4444 100%)",
        color: "white",
      }}
    >
      {/* decorative rings */}
      <div className="absolute -right-20 -top-24 w-72 h-72 rounded-full border border-white/10" />
      <div className="absolute -right-12 -top-16 w-60 h-60 rounded-full border border-white/10" />
      <div className="absolute right-6 top-6 w-2 h-2 rounded-full bg-white/70" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-semibold text-white/85">
          <AlertTriangle className="w-3.5 h-3.5" />
          Amount at risk
        </div>

        <div className="mt-4 flex items-end gap-3 flex-wrap">
          <div className="font-display font-bold text-6xl tabular leading-none">
            {fmtCurrency(PORTFOLIO.amountAtRisk)}
          </div>
          <div className="text-white/70 text-lg font-medium tabular pb-2">
            / {fmtCurrency(PORTFOLIO.approvedRisk)} approved
          </div>
        </div>

        <div className="mt-3 text-sm text-white/85">
          {PORTFOLIO.flagged} of {PORTFOLIO.total} projects flagged · portfolio-wide exposure
        </div>

        <div className="mt-8 grid grid-cols-3 gap-6">
          <Metric label="Over budget" value={`${PORTFOLIO.projectsOverBudget} projects`} accent />
          <Metric label="Health score" value={`${PORTFOLIO.healthScore}/100`} />
          <Metric label="Accuracy" value={fmtPct(PORTFOLIO.accuracy)} />
        </div>
      </div>
    </div>
  );
};

const Metric = ({ label, value, accent }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">{label}</div>
    <div className={`mt-1 text-2xl font-display font-semibold tabular ${accent ? "text-white" : "text-white"}`}>
      {value}
    </div>
  </div>
);

export default AmountAtRisk;
