import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, FileText, FolderKanban, Layers, Percent, ShieldCheck, Split, Undo2, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const inputClass = "h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-xs text-zinc-100 outline-none focus:border-fuchsia-500/40 focus:ring-1 focus:ring-fuchsia-500/25";
const apiHeaders = () => { const token = localStorage.getItem("ethara.jwt.v1"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }; };
const apiJson = async (path, options = {}) => { const response = await fetch(`${BACKEND_URL}${path}`, { ...options, headers: { ...apiHeaders(), ...(options.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) { const detail = Array.isArray(payload.detail) ? payload.detail.join(" · ") : payload.detail; throw new Error(detail || "Request failed"); } return payload; };

const dateVal = (value) => { const parsed = new Date(String(value || "").slice(0, 10)); return Number.isNaN(parsed.getTime()) ? null : parsed; };
const durationDays = (start, end) => { const s = dateVal(start); const e = dateVal(end); if (!s || !e || e < s) return 0; return Math.round((e - s) / 86400000) + 1; };
const computeLine = (line, plan) => {
  const unit = Number(plan?.unit_cost ?? line.unit_cost ?? 0);
  const seats = Math.max(Number(line.seats || 0), 0);
  const days = durationDays(line.start_date, line.end_date);
  const subtotal = unit * seats * (days ? days / 30 : 0);
  const tax = (subtotal * Math.max(Number(line.tax_pct || 0), 0)) / 100;
  const total = Math.max(subtotal + tax - Math.max(Number(line.discount || 0), 0), 0);
  return { unit, seats, days, subtotal, tax, total };
};

const Insight = ({ label, value, tone = "text-white" }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
    <div className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div>
    <div className={`mt-1 text-sm font-semibold tabular ${tone}`}>{value}</div>
  </div>
);

const SubscriptionReviewDialog = ({ open, onOpenChange, request, role, user, onSaved }) => {
  const { projects, modelCatalog } = useApp();
  const [plans, setPlans] = useState([]);
  const [lines, setLines] = useState([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [cfoMode, setCfoMode] = useState("full");
  const [approvedAmount, setApprovedAmount] = useState(0);

  const isCtoStage = role === "CTO" && request?.status === "cto-review";
  const isCfoStage = role === "CFO" && request?.status === "cfo-review";

  useEffect(() => {
    if (!open || !request) return;
    setLines((request.lines || []).map((line) => ({ ...line, members: [...(line.members || [])] })));
    setComment("");
    setCfoMode("full");
    setApprovedAmount(Number(request.requested_amount || 0));
  }, [open, request]);
  useEffect(() => { apiJson("/api/subscription-plans").then(setPlans).catch(() => setPlans([])); }, []);

  const planFor = (line) => plans.find((entry) => entry.id === line.plan_id) || line;
  const computed = useMemo(() => lines.map((line) => ({ line, ...computeLine(line, planFor(line)) })), [lines, plans]);
  const editedTotal = computed.reduce((sum, item) => sum + item.total, 0);
  const project = projects?.find((entry) => entry.id === request?.project_id);
  const totalSeats = lines.reduce((sum, line) => sum + Number(line.seats || 0), 0);
  const totalMembers = new Set(lines.flatMap((line) => (line.members || []).map((member) => member.email || member.id || member.name))).size;

  if (!request) return null;

  const updateLine = (index, key, value) => setLines((current) => current.map((line, idx) => (idx === index ? { ...line, [key]: key === "seats" ? Math.max(Number(value) || 0, 0) : value } : line)));
  const toggleMember = (index, member) => setLines((current) => current.map((line, idx) => {
    if (idx !== index) return line;
    const key = String(member.email || member.id || member.name).toLowerCase();
    const exists = (line.members || []).some((m) => String(m.email || m.id || m.name).toLowerCase() === key);
    return { ...line, members: exists ? line.members.filter((m) => String(m.email || m.id || m.name).toLowerCase() !== key) : [...(line.members || []), member] };
  }));

  const saveCtoEdits = async () => {
    const payload = { ...request, lines, editor_role: "CTO", actor: { name: user?.name, email: user?.email, role: "CTO" }, comment };
    return apiJson(`/api/subscription-requests/${request.id}`, { method: "PUT", body: JSON.stringify(payload) });
  };
  const decide = async (decision, extra = {}) => apiJson(`/api/subscription-requests/${request.id}/decision`, { method: "POST", body: JSON.stringify({ role, decision, comment, actor: { name: user?.name, email: user?.email, role }, ...extra }) });

  const run = async (fn, successMessage) => {
    setBusy(true);
    try { await fn(); toast.success(successMessage); onSaved?.(); onOpenChange(false); }
    catch (error) { toast.error("Action failed", { description: error.message }); }
    finally { setBusy(false); }
  };

  const onReturn = () => { if (!comment.trim()) { toast.error("Add a comment explaining what to change"); return; } run(() => decide("return"), "Request returned to requester"); };
  const onReject = () => { if (!comment.trim()) { toast.error("Add a rejection comment"); return; } run(() => decide("reject"), "Request rejected"); };
  const onCtoApprove = () => run(async () => { await saveCtoEdits(); await decide("approve"); }, "Technical edits saved · forwarded to CFO");
  const onCtoSaveOnly = () => run(saveCtoEdits, "Technical edits saved");
  const onCfoApprove = () => {
    if (cfoMode === "partial") {
      const amount = Number(approvedAmount);
      if (!Number.isFinite(amount) || amount <= 0 || amount >= Number(request.requested_amount || 0)) { toast.error("Partial amount must be between 1 and the requested amount"); return; }
      if (!comment.trim()) { toast.error("Add a reason for the partial approval"); return; }
      run(() => decide("partial", { approved_amount: amount }), "Partially approved");
    } else {
      run(() => decide("approve", { approved_amount: Number(request.requested_amount || 0) }), "Fully approved");
    }
  };

  const editable = isCtoStage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-white/10 bg-[#0F0F17] text-zinc-100" data-testid="subscription-review-dialog">
        <DialogHeader>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300">{isCtoStage ? "L2 · Technical review" : isCfoStage ? "L3 · Financial approval" : "Subscription request"}</div>
          <DialogTitle className="text-xl text-white">{request.request_number}</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">{request.project_name} · {request.phase_name} · {String(request.request_type || "initial").replaceAll("-", " ")} · raised by {request.requester?.name || "—"}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2.5 sm:grid-cols-4">
          <Insight label="Requested" value={fmtCurrency(request.requested_amount, { compact: false })} tone="text-fuchsia-300" />
          <Insight label={editable ? "Edited total" : "Under review"} value={fmtCurrency(editable ? editedTotal : request.requested_amount, { compact: false })} tone={editable && Math.round(editedTotal) !== Math.round(request.requested_amount || 0) ? "text-sky-300" : "text-white"} />
          <Insight label="Seats" value={totalSeats} />
          <Insight label="Members" value={totalMembers} />
        </div>

        {isCfoStage && project && (
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Insight label="Project approved budget" value={fmtCurrency(project.approvedBudget || 0, { compact: false })} />
            <Insight label="Project remaining" value={fmtCurrency(project.remaining || 0, { compact: false })} tone={(project.remaining || 0) < Number(request.requested_amount || 0) ? "text-amber-300" : "text-emerald-300"} />
            <Insight label="CTO forwarded" value={fmtCurrency(request.cto_forwarded_amount ?? request.requested_amount, { compact: false })} tone="text-sky-300" />
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500"><Layers className="h-3.5 w-3.5" />Subscription lines{editable && <span className="text-fuchsia-300">· editable</span>}</div>
          {computed.map(({ line, seats, days, total }, index) => (
            <div key={line.id || index} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-zinc-100">{line.subscription || planFor(line).subscription} <span className="text-[10px] font-normal text-zinc-500">{line.provider || planFor(line).provider} · {line.plan || planFor(line).plan}</span></div>
                <div className="text-sm font-semibold tabular text-white">{fmtCurrency(total, { compact: false })}</div>
              </div>
              {editable ? (
                <div className="mt-2 grid gap-2 md:grid-cols-3 lg:grid-cols-6">
                  <Labelled label="Plan"><select className={inputClass} value={line.plan_id} onChange={(event) => updateLine(index, "plan_id", event.target.value)}>{plans.map((entry) => <option key={entry.id} value={entry.id}>{entry.subscription}</option>)}</select></Labelled>
                  <Labelled label="Model"><select className={inputClass} value={line.model || ""} onChange={(event) => updateLine(index, "model", event.target.value)}><option value="">—</option>{(modelCatalog || []).map((entry) => { const label = entry.provider ? `${entry.name} · ${entry.provider}` : entry.name; return <option key={entry.id || label} value={label}>{label}</option>; })}</select></Labelled>
                  <Labelled label="Seats"><input className={inputClass} type="number" min="1" value={line.seats} onChange={(event) => updateLine(index, "seats", event.target.value)} /></Labelled>
                  <Labelled label="Start"><input className={inputClass} type="date" value={line.start_date} onChange={(event) => updateLine(index, "start_date", event.target.value)} /></Labelled>
                  <Labelled label="End"><input className={inputClass} type="date" value={line.end_date} onChange={(event) => updateLine(index, "end_date", event.target.value)} /></Labelled>
                  <Labelled label="Discount"><input className={inputClass} type="number" min="0" value={line.discount || 0} onChange={(event) => updateLine(index, "discount", event.target.value)} /></Labelled>
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-zinc-500">{seats} seats · {days} days{line.model ? ` · ${line.model}` : ""}</div>
              )}
              <div className="mt-2">
                <div className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-500"><Users className="h-3 w-3" />Members ({(line.members || []).length}/{line.seats})</div>
                <div className="flex flex-wrap gap-1.5">
                  {(editable ? (request.eligible_members || []) : (line.members || [])).map((member) => {
                    const selected = (line.members || []).some((m) => String(m.email || m.id || m.name).toLowerCase() === String(member.email || member.id || member.name).toLowerCase());
                    return editable ? (
                      <button key={member.id || member.email || member.name} type="button" onClick={() => toggleMember(index, member)} className={`rounded-md border px-2 py-1 text-[10px] ${selected ? "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300" : "border-white/10 text-zinc-400 hover:bg-white/5"}`}>{member.name || member.email}</button>
                    ) : (
                      <span key={member.id || member.email || member.name} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-300">{member.name || member.email}</span>
                    );
                  })}
                  {!editable && !(line.members || []).length && <span className="text-[10px] text-zinc-600">No members allocated</span>}
                </div>
              </div>
              {line.justification && <div className="mt-2 text-[11px] text-zinc-400">“{line.justification}”</div>}
            </div>
          ))}
        </div>

        {(request.documents || []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {request.documents.map((document) => <a key={document.id} href={`${BACKEND_URL}/api/subscription-requests/${request.id}/documents/${document.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:text-fuchsia-300"><FileText className="h-3 w-3" />{document.name}</a>)}
          </div>
        )}

        {(request.snapshots || request.history || []).length > 0 && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest text-zinc-500"><Clock3 className="h-3 w-3" />Approval history</div>
            <div className="space-y-1.5">
              {(request.history || []).map((entry, index) => (
                <div key={`${entry.at}-${index}`} className="flex items-center justify-between gap-2 text-[11px]"><span className="text-zinc-300">{entry.action}{entry.comment ? ` — ${entry.comment}` : ""}</span><span className="text-zinc-600">{new Date(entry.at).toLocaleString()}</span></div>
              ))}
            </div>
          </div>
        )}

        {isCfoStage && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500"><ShieldCheck className="h-3.5 w-3.5" />Approval decision</div>
            <div className="inline-flex rounded-lg border border-white/10 bg-[#12121A] p-1">
              <button type="button" onClick={() => setCfoMode("full")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${cfoMode === "full" ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-400 hover:text-zinc-200"}`}><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Full approval</button>
              <button type="button" onClick={() => setCfoMode("partial")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${cfoMode === "partial" ? "bg-amber-500/15 text-amber-300" : "text-zinc-400 hover:text-zinc-200"}`}><Split className="mr-1 inline h-3.5 w-3.5" />Partial</button>
            </div>
            {cfoMode === "partial" && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11px]"><span className="text-zinc-500">Approved amount</span><span className="font-semibold text-amber-300">{request.requested_amount ? Math.round((approvedAmount / request.requested_amount) * 100) : 0}% · remaining {fmtCurrency(Math.max(Number(request.requested_amount || 0) - approvedAmount, 0), { compact: false })}</span></div>
                <input type="range" min="0" max={request.requested_amount || 0} step={Math.max(10, Math.round((request.requested_amount || 100) / 100))} value={approvedAmount} onChange={(event) => setApprovedAmount(Number(event.target.value))} className="w-full accent-amber-500" data-testid="sub-partial-slider" />
                <input type="number" min="0" value={approvedAmount} onChange={(event) => setApprovedAmount(Number(event.target.value))} className={`${inputClass} mt-2`} data-testid="sub-partial-amount" />
              </div>
            )}
          </div>
        )}

        <div>
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Comment {isCtoStage ? "(required to return/reject)" : ""}</div>
          <textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a note for the requester or next approver" className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-100 outline-none focus:border-fuchsia-500/40" data-testid="sub-review-comment" />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/5 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Close</Button>
          {(isCtoStage || isCfoStage) && <Button type="button" variant="outline" onClick={onReturn} disabled={busy}><Undo2 className="mr-1 h-3.5 w-3.5" />Return</Button>}
          {(isCtoStage || isCfoStage) && <Button type="button" variant="outline" onClick={onReject} disabled={busy} className="text-red-300"><XCircle className="mr-1 h-3.5 w-3.5" />Reject</Button>}
          {isCtoStage && <Button type="button" variant="outline" onClick={onCtoSaveOnly} disabled={busy}>Save edits</Button>}
          {isCtoStage && <Button type="button" onClick={onCtoApprove} disabled={busy} className="bg-emerald-500 text-white hover:bg-emerald-600" data-testid="btn-cto-approve"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Save &amp; approve to CFO</Button>}
          {isCfoStage && <Button type="button" onClick={onCfoApprove} disabled={busy} className={`text-white ${cfoMode === "partial" ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-500 hover:bg-emerald-600"}`} data-testid="btn-cfo-approve"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />{cfoMode === "partial" ? `Approve ${fmtCurrency(approvedAmount, { compact: false })}` : "Approve in full"}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Labelled = ({ label, children }) => <label className="block"><span className="mb-1 block text-[9px] font-semibold uppercase tracking-widest text-zinc-500">{label}</span>{children}</label>;

export default SubscriptionReviewDialog;
