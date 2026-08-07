import { useMemo, useState } from "react";
import { CreditCard, ExternalLink, Pencil, Search, Users } from "lucide-react";
import { fmtCurrency } from "../lib/format";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const selectCls = "h-9 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-zinc-100 outline-none focus:ring-2 focus:ring-fuchsia-500/25";
const uniqueSorted = (values) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
const monthOf = (date) => { if (!date) return ""; const parsed = new Date(date); return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString("en-US", { month: "short", year: "numeric" }); };

// Rows that have not been through fulfilment yet still surface, with blank fillable fields.
const deriveEntries = (request) => (request.lines || []).flatMap((line) => {
  const perSeat = Number(line.total || 0) / Math.max(Number(line.seats || 0), 1);
  const members = line.members?.length ? line.members : Array.from({ length: Math.max(Number(line.seats || 0), 1) }, (_, index) => ({ id: `${line.id}-seat-${index + 1}`, name: `Unassigned seat ${index + 1}`, email: "" }));
  return members.map((member) => ({
    id: `track-${line.id}-${member.id || member.email || member.name}`,
    line_id: line.id, employee_code: member.employeeId || member.emp || "", name: member.name || "", email: member.email || "",
    subscription_type: line.subscription || "", model: line.model || "", phase: request.phase_name || "",
    amount_usd: Math.round(perSeat * 100) / 100, amount_inr: 0, amount_paid: 0, total_amount: Math.round(perSeat * 100) / 100, difference: Math.round(perSeat * 100) / 100,
    reimbursement_verified: "Not Verified", reimbursement_status: "", comments: "", account_number: "", ifsc_code: "",
    status: "Active", date: "", month: monthOf(line.start_date), started: line.start_date || "", ended: line.end_date || "",
    invoice_document_id: "", receipt_document_id: "", screenshot_document_id: "",
  }));
});

const columns = ["Subscription Tracker", "Employee Code", "Name", "Email", "Amount USD", "Amount INR", "Amount Paid", "Total", "Difference", "Reimbursement", "Reimb. Status", "Comments", "Account Number", "IFSC Code", "Project", "Subscription Type", "Phase", "Status", "Date", "Month", "Started", "Ended", "Invoice", "Receipt", "Payment Screenshot", ""];

const DocLink = ({ request, docId }) => {
  if (!docId) return <span className="text-zinc-600">—</span>;
  const document = (request.documents || []).find((entry) => entry.id === docId);
  return <a href={`${BACKEND_URL}/api/subscription-requests/${request.id}/documents/${docId}`} className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200" target="_blank" rel="noreferrer">{document?.name || "View"}<ExternalLink className="h-3 w-3" /></a>;
};

// Embeddable tracker table — rendered as the "Tracker" tab inside the Subscriptions module.
const SubscriptionTrackerView = ({ requests = [], user, onEdit }) => {
  const [project, setProject] = useState("all");
  const [phase, setPhase] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const list = [];
    (requests || []).filter((request) => ["fulfilment-pending", "active", "expiring", "expired"].includes(request.status)).forEach((request) => {
      const entries = request.tracker_entries?.length ? request.tracker_entries : deriveEntries(request);
      entries.forEach((entry) => list.push({ request, entry }));
    });
    return list;
  }, [requests]);

  const projectOptions = useMemo(() => uniqueSorted(rows.map((row) => row.request.project_name)), [rows]);
  const phaseOptions = useMemo(() => uniqueSorted(rows.map((row) => row.entry.phase || row.request.phase_name)), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(({ request, entry }) =>
      (project === "all" || request.project_name === project) &&
      (phase === "all" || (entry.phase || request.phase_name) === phase) &&
      (status === "all" || request.status === status) &&
      (!q || `${entry.name} ${entry.email} ${entry.employee_code} ${entry.subscription_type} ${entry.model}`.toLowerCase().includes(q))
    );
  }, [rows, project, phase, status, query]);

  const totalUsd = filtered.reduce((sum, { entry }) => sum + Number(entry.amount_usd || 0), 0);
  const distinctMembers = new Set(filtered.map(({ entry }) => entry.email || entry.name)).size;
  const pendingReimb = filtered.filter(({ entry }) => String(entry.reimbursement_verified).toLowerCase() !== "verified").length;
  const canEdit = (request) => String(request.requester?.email || "").toLowerCase() === String(user?.email || "").toLowerCase() || request.requester?.name === user?.name || ["CFO", "CTO"].includes(user?.role);

  return (
    <div className="space-y-4" data-testid="subscription-tracker-view">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={CreditCard} label="Allocations" value={filtered.length.toLocaleString()} />
        <Kpi label="Monthly spend" value={fmtCurrency(totalUsd, { compact: false })} sub="allocated (USD)" />
        <Kpi icon={Users} label="Members" value={distinctMembers} />
        <Kpi label="Reimbursements pending" value={pendingReimb} sub="not verified" />
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#12121A] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search member, email, employee code, subscription or model" className={`${selectCls} w-full pl-9`} /></div>
          <select value={project} onChange={(event) => setProject(event.target.value)} className={`${selectCls} min-w-[170px]`}><option value="all">All projects</option>{projectOptions.map((name) => <option key={name}>{name}</option>)}</select>
          <select value={phase} onChange={(event) => setPhase(event.target.value)} className={`${selectCls} min-w-[140px]`}><option value="all">All phases</option>{phaseOptions.map((name) => <option key={name}>{name}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${selectCls} min-w-[160px]`}><option value="all">All statuses</option><option value="fulfilment-pending">Fulfilment pending</option><option value="active">Active</option><option value="expiring">Expiring</option><option value="expired">Expired</option></select>
        </div>
      </div>

      {filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-zinc-500">No approved subscriptions match these filters. Approved requests appear here once they reach fulfilment.</div> : (
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#12121A]">
          <table className="w-full min-w-[2200px] text-xs">
            <thead><tr className="border-b border-white/5 text-left uppercase tracking-widest text-[9px] text-zinc-500">{columns.map((column) => <th key={column} className="whitespace-nowrap px-3 py-2.5">{column}</th>)}</tr></thead>
            <tbody>
              {filtered.map(({ request, entry }) => (
                <tr key={`${request.id}-${entry.id}`} className="border-b border-white/[0.04] align-top hover:bg-white/[0.02]" data-testid={`tracker-row-${request.id}-${entry.id}`}>
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-zinc-100">{entry.subscription_type}{entry.model ? <div className="text-[10px] text-zinc-500">{entry.model}</div> : null}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-300">{entry.employee_code || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-200">{entry.name || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{entry.email || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular text-white">{fmtCurrency(entry.amount_usd, { compact: false })}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular text-zinc-400">{Number(entry.amount_inr || 0) ? `₹${Number(entry.amount_inr).toLocaleString("en-IN")}` : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular text-zinc-300">{fmtCurrency(entry.amount_paid, { compact: false })}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular text-zinc-300">{fmtCurrency(entry.total_amount ?? entry.amount_usd, { compact: false })}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular text-zinc-400">{fmtCurrency(entry.difference ?? (Number(entry.amount_usd || 0) - Number(entry.amount_paid || 0)), { compact: false })}</td>
                  <td className="whitespace-nowrap px-3 py-3"><span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${String(entry.reimbursement_verified).toLowerCase() === "verified" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{entry.reimbursement_verified || "Not Verified"}</span></td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{entry.reimbursement_status || "—"}</td>
                  <td className="max-w-[220px] truncate px-3 py-3 text-zinc-400" title={entry.comments}>{entry.comments || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{entry.account_number || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{entry.ifsc_code || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-300">{request.project_name}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-300">{entry.subscription_type}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{entry.phase || request.phase_name}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-300">{entry.status || "Active"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{entry.date || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{entry.month || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{entry.started || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-zinc-400">{entry.ended || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3"><DocLink request={request} docId={entry.invoice_document_id} /></td>
                  <td className="whitespace-nowrap px-3 py-3"><DocLink request={request} docId={entry.receipt_document_id} /></td>
                  <td className="whitespace-nowrap px-3 py-3"><DocLink request={request} docId={entry.screenshot_document_id} /></td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{canEdit(request) && onEdit && <button type="button" onClick={() => onEdit(request)} className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/5"><Pencil className="h-3 w-3" />Edit details</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Kpi = ({ icon: Icon, label, value, sub }) => (
  <div className="rounded-2xl border border-white/5 bg-[#12121A] p-4">
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</div>
    <div className="mt-2 font-display text-2xl font-semibold tabular text-white">{value}</div>
    {sub && <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>}
  </div>
);

export default SubscriptionTrackerView;
