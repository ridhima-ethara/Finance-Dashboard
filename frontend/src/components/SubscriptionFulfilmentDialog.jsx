import { useEffect, useMemo, useState } from "react";
import { Building2, Check, FileText, Trash2, Upload, User } from "lucide-react";
import { toast } from "sonner";
import { fmtCurrency } from "../lib/format";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const inputClass = "h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-zinc-100 outline-none focus:border-fuchsia-500/40 focus:ring-1 focus:ring-fuchsia-500/25";
const apiHeaders = () => { const token = localStorage.getItem("ethara.jwt.v1"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }; };
const apiJson = async (path, options = {}) => { const response = await fetch(`${BACKEND_URL}${path}`, { ...options, headers: { ...apiHeaders(), ...(options.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) { const detail = Array.isArray(payload.detail) ? payload.detail.join(" · ") : payload.detail; throw new Error(detail || "Fulfilment could not be saved"); } return payload; };
const fileToDocument = (file, type) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ id: `sub-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, type, content_type: file.type || "application/octet-stream", size: file.size, uploaded_at: new Date().toISOString(), data: reader.result }); reader.onerror = () => reject(new Error(`Unable to read ${file.name}`)); reader.readAsDataURL(file); });
const monthOf = (date) => { if (!date) return ""; const parsed = new Date(date); return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString("en-US", { month: "short", year: "numeric" }); };

const buildEntries = (request) => {
  if (request?.tracker_entries?.length) return request.tracker_entries.map((entry) => ({ ...entry }));
  const entries = [];
  (request?.lines || []).forEach((line) => {
    const perSeat = Number(line.total || 0) / Math.max(Number(line.seats || 0), 1);
    const members = line.members?.length ? line.members : Array.from({ length: Math.max(Number(line.seats || 0), 1) }, (_, index) => ({ id: `${line.id}-seat-${index + 1}`, name: `Unassigned seat ${index + 1}`, email: "" }));
    members.forEach((member) => entries.push({
      id: `track-${line.id}-${member.id || member.email || member.name}`,
      line_id: line.id,
      employee_code: member.employeeId || member.emp || "",
      name: member.name || "",
      email: member.email || "",
      subscription_type: line.subscription || "",
      model: line.model || "",
      phase: request.phase_name || "",
      amount_usd: Math.round(perSeat * 100) / 100,
      amount_inr: 0,
      amount_paid: 0,
      reimbursement_verified: "Not Verified",
      reimbursement_status: "",
      comments: "",
      account_number: "",
      ifsc_code: "",
      status: "Active",
      date: new Date().toISOString().slice(0, 10),
      month: monthOf(line.start_date),
      started: line.start_date || "",
      ended: line.end_date || "",
      invoice_document_id: "",
      receipt_document_id: "",
      screenshot_document_id: "",
    }));
  });
  return entries;
};

const Field = ({ label, children }) => <label className="block"><span className="mb-1 block text-[9px] font-semibold uppercase tracking-widest text-zinc-500">{label}</span>{children}</label>;

const SubscriptionFulfilmentDialog = ({ open, onOpenChange, request, onSaved }) => {
  const [purchaseMode, setPurchaseMode] = useState("company");
  const [entries, setEntries] = useState([]);
  const [docs, setDocs] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !request) return;
    setPurchaseMode(request.purchase_mode || "company");
    setEntries(buildEntries(request));
    setDocs((request.documents || []).filter((document) => ["invoice", "receipt", "screenshot"].includes(document.type)).map((document) => ({ ...document })));
  }, [open, request]);

  const updateEntry = (id, key, value) => setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry)));

  const attach = async (entryId, type, files) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Files must be 5 MB or smaller"); return; }
    try {
      const document = await fileToDocument(file, type);
      setDocs((current) => [...current, document]);
      updateEntry(entryId, `${type}_document_id`, document.id);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} attached`);
    } catch (error) { toast.error(error.message); }
  };

  const docName = (id) => docs.find((document) => document.id === id)?.name;

  const save = async () => {
    setSaving(true);
    try {
      const usedDocIds = new Set(entries.flatMap((entry) => [entry.invoice_document_id, entry.receipt_document_id, entry.screenshot_document_id].filter(Boolean)));
      const payload = {
        purchase_mode: purchaseMode,
        tracker_entries: entries,
        documents: docs.filter((document) => document.data && usedDocIds.has(document.id)),
        actor: request?.requester || {},
      };
      const saved = await apiJson(`/api/subscription-requests/${request.id}/fulfilment`, { method: "POST", body: JSON.stringify(payload) });
      toast.success("Fulfilment recorded", { description: "The subscription is now active and visible in the tracker." });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error("Fulfilment was not saved", { description: error.message });
    } finally { setSaving(false); }
  };

  if (!request) return null;
  const requiresScreenshot = purchaseMode === "self";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-white/10 bg-[#0F0F17] text-zinc-100" data-testid="subscription-fulfilment-dialog">
        <DialogHeader>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300">Subscription fulfilment</div>
          <DialogTitle className="text-xl text-white">Record purchase &amp; payment details</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">{request.request_number} · {request.project_name} · {request.phase_name}. Fill the tracker fields and attach evidence for each allocated member.</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-500">How was this subscription purchased?</div>
          <div className="inline-flex rounded-lg border border-white/10 bg-[#12121A] p-1">
            <button type="button" onClick={() => setPurchaseMode("company")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${purchaseMode === "company" ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-400 hover:text-zinc-200"}`}><Building2 className="h-3.5 w-3.5" />Company account</button>
            <button type="button" onClick={() => setPurchaseMode("self")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${purchaseMode === "self" ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-400 hover:text-zinc-200"}`}><User className="h-3.5 w-3.5" />Own account (reimbursement)</button>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">{requiresScreenshot ? "Reimbursement: attach invoice, receipt and payment screenshot, and add the member's bank details." : "Company purchase: attach invoice and receipt (payment screenshot not required)."}</div>
        </div>

        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4" data-testid={`fulfilment-entry-${entry.id}`}>
              <div className="mb-3 flex items-center gap-2"><User className="h-4 w-4 text-fuchsia-300" /><span className="text-sm font-semibold text-white">{entry.name || "Unassigned seat"}</span><span className="text-[10px] text-zinc-500">{entry.subscription_type}{entry.model ? ` · ${entry.model}` : ""}</span></div>
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                <Field label="Employee code"><input className={inputClass} value={entry.employee_code} onChange={(event) => updateEntry(entry.id, "employee_code", event.target.value)} /></Field>
                <Field label="Name"><input className={inputClass} value={entry.name} onChange={(event) => updateEntry(entry.id, "name", event.target.value)} /></Field>
                <Field label="Email"><input className={inputClass} value={entry.email} onChange={(event) => updateEntry(entry.id, "email", event.target.value)} /></Field>
                <Field label="Status"><input className={inputClass} value={entry.status} onChange={(event) => updateEntry(entry.id, "status", event.target.value)} /></Field>
                <Field label="Amount (USD)"><input className={inputClass} type="number" min="0" step="0.01" value={entry.amount_usd} onChange={(event) => updateEntry(entry.id, "amount_usd", event.target.value)} /></Field>
                <Field label="Amount (INR)"><input className={inputClass} type="number" min="0" step="0.01" value={entry.amount_inr} onChange={(event) => updateEntry(entry.id, "amount_inr", event.target.value)} /></Field>
                <Field label="Amount paid"><input className={inputClass} type="number" min="0" step="0.01" value={entry.amount_paid} onChange={(event) => updateEntry(entry.id, "amount_paid", event.target.value)} /></Field>
                <Field label="Difference"><div className={`${inputClass} flex items-center bg-white/[0.02] text-zinc-400`}>{fmtCurrency((Number(entry.amount_usd || 0) - Number(entry.amount_paid || 0)), { compact: false })}</div></Field>
                <Field label="Reimbursement"><select className={inputClass} value={entry.reimbursement_verified} onChange={(event) => updateEntry(entry.id, "reimbursement_verified", event.target.value)}><option>Not Verified</option><option>Verified</option></select></Field>
                <Field label="Reimbursement status"><input className={inputClass} value={entry.reimbursement_status} onChange={(event) => updateEntry(entry.id, "reimbursement_status", event.target.value)} placeholder="e.g. Pending / Paid" /></Field>
                <Field label="Started"><input className={inputClass} type="date" value={entry.started} onChange={(event) => updateEntry(entry.id, "started", event.target.value)} /></Field>
                <Field label="Ended"><input className={inputClass} type="date" value={entry.ended} onChange={(event) => updateEntry(entry.id, "ended", event.target.value)} /></Field>
                {requiresScreenshot && <>
                  <Field label="Account number"><input className={inputClass} value={entry.account_number} onChange={(event) => updateEntry(entry.id, "account_number", event.target.value)} /></Field>
                  <Field label="IFSC code"><input className={inputClass} value={entry.ifsc_code} onChange={(event) => updateEntry(entry.id, "ifsc_code", event.target.value)} /></Field>
                </>}
                <div className="md:col-span-2 lg:col-span-4"><Field label="Comments"><input className={inputClass} value={entry.comments} onChange={(event) => updateEntry(entry.id, "comments", event.target.value)} placeholder="Notes for this allocation" /></Field></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Attachment label="Invoice" docName={docName(entry.invoice_document_id)} onPick={(files) => attach(entry.id, "invoice", files)} />
                <Attachment label="Receipt" docName={docName(entry.receipt_document_id)} onPick={(files) => attach(entry.id, "receipt", files)} />
                {requiresScreenshot && <Attachment label="Payment screenshot" docName={docName(entry.screenshot_document_id)} onPick={(files) => attach(entry.id, "screenshot", files)} />}
              </div>
            </div>
          ))}
          {!entries.length && <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-xs text-zinc-500">No allocated members were found on this request.</div>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving || !entries.length} className="bg-fuchsia-500 text-white hover:bg-fuchsia-600" data-testid="btn-save-fulfilment"><Check className="mr-1 h-4 w-4" />{saving ? "Saving…" : "Save fulfilment"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Attachment = ({ label, docName, onPick }) => (
  <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${docName ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300" : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]"}`}>
    {docName ? <FileText className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
    <span className="max-w-[160px] truncate">{docName || `Attach ${label.toLowerCase()}`}</span>
    <input type="file" className="hidden" onChange={(event) => onPick(event.target.files)} />
  </label>
);

export default SubscriptionFulfilmentDialog;
