import { PROJECTS } from "../data/mockData";
import { fmtCurrency, fmtDate } from "../lib/format";
import { Link } from "react-router-dom";
import { ArrowUpRightSquare } from "lucide-react";

const TopUps = () => {
  const all = PROJECTS.flatMap((p) =>
    p.topupHistory.map((t) => ({ ...t, project: p.name, projectId: p.id }))
  ).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="space-y-6" data-testid="page-topups">
      <div>
        <h1 className="font-display font-semibold text-3xl tracking-tight text-slate-900">Top-up requests</h1>
        <p className="text-sm text-slate-500 mt-1">Every top-up across projects · version history preserved</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Total top-up amount" value={fmtCurrency(all.reduce((s, t) => s + t.amount, 0), { compact: false })} />
        <Stat label="Pending approvals" value={String(all.filter((t) => t.status === "pending").length)} />
        <Stat label="Approved top-ups" value={String(all.filter((t) => t.status === "approved").length)} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
              <th className="text-left py-3 px-5">Project</th>
              <th className="text-right py-3 px-2">Amount</th>
              <th className="text-left py-3 px-2">Reason</th>
              <th className="text-left py-3 px-2">Requester</th>
              <th className="text-left py-3 px-2">Approver</th>
              <th className="text-left py-3 px-2">Date</th>
              <th className="text-left py-3 px-5">Status</th>
            </tr>
          </thead>
          <tbody>
            {all.map((t) => (
              <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60" data-testid={`topup-${t.id}`}>
                <td className="py-3 px-5">
                  <Link to={`/projects/${t.projectId}`} className="text-sm font-semibold text-slate-900 hover:text-violet-700 inline-flex items-center gap-1">
                    <ArrowUpRightSquare className="w-3.5 h-3.5 text-violet-500" />
                    {t.project}
                  </Link>
                </td>
                <td className="py-3 px-2 text-right tabular text-sm font-semibold text-slate-900">{fmtCurrency(t.amount, { compact: false })}</td>
                <td className="py-3 px-2 text-xs text-slate-600 max-w-xs truncate">{t.reason}</td>
                <td className="py-3 px-2 text-sm text-slate-700">{t.requester}</td>
                <td className="py-3 px-2 text-sm text-slate-700">{t.approver}</td>
                <td className="py-3 px-2 text-xs text-slate-500 tabular">{fmtDate(t.date)}</td>
                <td className="py-3 px-5">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                    t.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">{label}</div>
    <div className="mt-2 font-display font-semibold text-2xl tabular text-slate-900">{value}</div>
  </div>
);

export default TopUps;
