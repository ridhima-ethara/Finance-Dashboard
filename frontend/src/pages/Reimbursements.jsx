import { REIMBURSEMENTS } from "../data/mockData";
import { fmtCurrency, fmtDate } from "../lib/format";
import { Button } from "../components/ui/button";
import { Upload, Paperclip } from "lucide-react";

const chip = (s) => {
  if (s === "approved" || s === "reimbursed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "processing") return "bg-blue-50 text-blue-700 border-blue-200";
  if (s === "pending") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
};

const Reimbursements = () => (
  <div className="space-y-6" data-testid="page-reimb">
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h1 className="font-display font-semibold text-3xl tracking-tight text-slate-900">Reimbursements &amp; Dinner</h1>
        <p className="text-sm text-slate-500 mt-1">Employee expense claims across all projects</p>
      </div>
      <Button className="h-9 rounded-lg bg-violet-600 hover:bg-violet-700 gap-2" data-testid="btn-upload-bill">
        <Upload className="w-4 h-4" />
        Upload bill
      </Button>
    </div>

    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
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
            <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60" data-testid={`reimb-${r.id}`}>
              <td className="py-3 px-5">
                <div className="text-sm font-semibold text-slate-900">{r.employee}</div>
                <div className="text-[11px] text-slate-500">{r.remarks}</div>
              </td>
              <td className="py-3 px-2 text-sm text-slate-700">{r.project}</td>
              <td className="py-3 px-2 text-sm text-slate-700">{r.type}</td>
              <td className="py-3 px-2 text-right tabular text-sm font-semibold text-slate-900">{fmtCurrency(r.amount, { compact: false })}</td>
              <td className="py-3 px-2 text-xs text-slate-500 tabular">{fmtDate(r.date)}</td>
              <td className="py-3 px-2">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${chip(r.approval)}`}>{r.approval}</span>
              </td>
              <td className="py-3 px-2">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${chip(r.finance)}`}>{r.finance}</span>
              </td>
              <td className="py-3 px-2">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${r.extra ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                  {r.extra ? "Extra" : "Included"}
                </span>
              </td>
              <td className="py-3 px-5">
                <a href="#" className="inline-flex items-center gap-1 text-xs text-violet-700 hover:text-violet-800">
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
