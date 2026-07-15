import { useMemo } from "react";
import { FileText } from "lucide-react";
import { fmtCurrency } from "../../lib/format";
import { parseGeneralBudgetTable } from "../../lib/generalBudget";

const GeneralBudgetTableCard = ({
  lines = [],
  title = "Phase-wise general budget",
  subtitle = "Custom headers, phase mapping, and totals raised with the request.",
  testid = "general-budget-table-card",
}) => {
  const table = useMemo(() => parseGeneralBudgetTable(lines), [lines]);

  if (!table.isTableMode || !table.rows.length) return null;

  return (
    <div className="rounded-2xl border border-white/5 bg-[#12121A] p-5" data-testid={testid}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-white font-display font-semibold text-[15px]">
            <FileText className="w-4 h-4 text-fuchsia-300" />
            {title}
          </div>
          <div className="text-xs text-zinc-500 mt-1">{subtitle}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Total</div>
          <div className="text-lg font-semibold text-fuchsia-300 tabular">{fmtCurrency(table.total, { compact: false })}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {table.phaseTotals.map((entry) => (
          <div key={entry.phaseId} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
            <div className="text-zinc-500">{entry.phaseName}</div>
            <div className="text-white font-semibold tabular">{fmtCurrency(entry.total, { compact: false })}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
              <th className="py-2 px-3 text-left">Phase</th>
              {table.headers.map((header) => (
                <th key={header} className="py-2 px-3 text-left">{header}</th>
              ))}
              <th className="py-2 px-3 text-right">Cost ($)</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.id} className="border-b border-white/5 last:border-b-0">
                <td className="py-3 px-3 text-white font-medium">{row.phaseName || "Unassigned"}</td>
                {table.headers.map((header) => (
                  <td key={`${row.id}-${header}`} className="py-3 px-3 text-zinc-300">{row.cells?.[header] || "—"}</td>
                ))}
                <td className="py-3 px-3 text-right text-white font-semibold tabular">{fmtCurrency(row.estCost, { compact: false })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GeneralBudgetTableCard;
