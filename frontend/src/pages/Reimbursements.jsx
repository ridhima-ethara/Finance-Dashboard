import { REIMBURSEMENTS } from "../data/mockData";
import { fmtCurrency, fmtDate } from "../lib/format";
import { Button } from "../components/ui/button";
import { Upload, Paperclip } from "lucide-react";

const chip = (s) => {
  if (s === "approved" || s === "reimbursed") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  if (s === "processing") return "bg-sky-500/10 text-sky-400 border-sky-500/30";
  if (s === "pending") return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  return "bg-white/5 text-zinc-400 border-white/10";
};

const Reimbursements = () => (
  <div className="space-y-6" data-testid="page-reimb">
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 className="font-display font-semibold text-3xl tracking-tight text-white">Reimbursements &amp; Dinner</h1>
        <p className="text-sm text-zinc-500 mt-1">Employee expense claims across all projects</p>
      </div>
      <Button className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 gap-2" data-testid="btn-upload-bill">
        <Upload className="w-4 h-4" />
        Upload bill
      </Button>
    </div>

    <div className="bg-[#12121A] rounded-2xl border border-white/10 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold border-b border-white/5 bg-white/5">
            <th className="text-left py-3 px-5">Employee</th>
            <th className="text-left py-3 px-2">Project</th>
            <th className="text-left py-3 px-2">Type</th>
            <th className="text-right py-3 px-2">Amount</th>
            <th className="text-left py-3 px-2">Date</th>
            <th className="text-left py-3 px-2">Approval</th>
            <th className="text-left py-3 px-2">Finance</th>
            <th className="text-left py-3 px-2">In budget</th>
            <th className="text-left py-3 px-5">Bill</th>
          </tr>
        </thead>
        <tbody>
          {REIMBURSEMENTS.map((r) => (
            <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/5" data-testid={`reimb-${r.id}`}>
              <td className="py-3 px-5">
                <div className="text-sm font-semibold text-white">{r.employee}</div>
                <div className="text-[11px] text-zinc-500">{r.remarks}</div>
              </td>
              <td className="py-3 px-2 text-sm text-zinc-200">{r.project}</td>
              <td className="py-3 px-2 text-sm text-zinc-200">{r.type}</td>
              <td className="py-3 px-2 text-right tabular text-sm font-semibold text-white">{fmtCurrency(r.amount, { compact: false })}</td>
              <td className="py-3 px-2 text-xs text-zinc-500 tabular">{fmtDate(r.date)}</td>
              <td className="py-3 px-2">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${chip(r.approval)}`}>{r.approval}</span>
              </td>
              <td className="py-3 px-2">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${chip(r.finance)}`}>{r.finance}</span>
              </td>
              <td className="py-3 px-2">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${r.extra ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-white/5 text-zinc-400 border-white/10"}`}>
                  {r.extra ? "Extra" : "Included"}
                </span>
              </td>
              <td className="py-3 px-5">
                <a href="#" className="inline-flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300">
                  <Paperclip className="w-3 h-3" /> View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default Reimbursements;
