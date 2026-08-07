import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CreditCard, FileText, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const inputClass = "h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs text-zinc-100 outline-none focus:border-fuchsia-500/40 focus:ring-1 focus:ring-fuchsia-500/25";
const today = () => new Date().toISOString().slice(0, 10);
const afterDays = (date, days) => { const next = new Date(date || today()); next.setDate(next.getDate() + days); return next.toISOString().slice(0, 10); };
const apiHeaders = () => { const token = localStorage.getItem("ethara.jwt.v1"); return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }; };
const apiJson = async (path, options = {}) => { const response = await fetch(`${BACKEND_URL}${path}`, { ...options, headers: { ...apiHeaders(), ...(options.headers || {}) } }); const payload = await response.json().catch(() => ({})); if (!response.ok) { const detail = Array.isArray(payload.detail) ? payload.detail.join(" · ") : payload.detail; throw new Error(detail || "Subscription request could not be saved"); } return payload; };
const emptyLine = (planId = "") => ({ id: `sub-line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, plan_id: planId, model: "", seats: 1, start_date: today(), end_date: afterDays(today(), 29), members: [], tax_pct: 0, discount: 0, justification: "" });
const memberKey = (member) => String(member.email || member.id || member.name || "").trim().toLowerCase();
const normalizedMembers = (project) => {
  const all = [...(project?.teamMembers || []), ...(project?.kickoffMail?.recipients || [])];
  const seen = new Set();
  return all.reduce((result, member, index) => {
    const normalized = { id: member.id || member.employeeId || member.email || `${project?.id}-member-${index}`, name: member.name || member.memberName || member.email || "Project member", email: member.email || "", role: member.role || member.title || "Project member" };
    const key = memberKey(normalized);
    if (!key || seen.has(key)) return result;
    seen.add(key);
    result.push(normalized);
    return result;
  }, []);
};
const lineCost = (line, plan) => {
  const start = new Date(line.start_date);
  const end = new Date(line.end_date);
  const valid = !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start;
  const days = valid ? Math.floor((end - start) / 86400000) + 1 : 0;
  const subtotal = Number(plan?.unit_cost || plan?.monthly || 0) * Number(line.seats || 0) * days / 30;
  return Math.max(subtotal + subtotal * Number(line.tax_pct || 0) / 100 - Number(line.discount || 0), 0);
};
const fileToDocument = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ id: `sub-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, content_type: file.type || "application/octet-stream", size: file.size, uploaded_at: new Date().toISOString(), data: reader.result }); reader.onerror = () => reject(new Error(`Unable to read ${file.name}`)); reader.readAsDataURL(file); });

const SubscriptionRequestDialog = ({ open, onOpenChange, editingRequest = null, requests = [], onSaved }) => {
  const { visibleProjects, user, modelCatalog } = useApp();
  const [plans, setPlans] = useState([]);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [memberLineIndex, setMemberLineIndex] = useState(null);
  const [form, setForm] = useState({ request_type: "initial", project_id: "", phase_id: "", required_start_date: today(), justification: "", lines: [], documents: [] });

  useEffect(() => {
    if (!open) return;
    setLoadingPlans(true);
    apiJson("/api/subscription-plans").then((catalogue) => setPlans(catalogue)).catch((error) => toast.error("Pricing catalogue unavailable", { description: error.message })).finally(() => setLoadingPlans(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editingRequest) {
      setForm({ ...editingRequest, request_type: editingRequest.request_type || "initial", lines: (editingRequest.lines || []).map((line) => ({ ...line, members: line.members || [] })), documents: editingRequest.documents || [] });
    } else {
      setForm({ request_type: "initial", project_id: visibleProjects[0]?.id || "", phase_id: visibleProjects[0]?.phases?.[0]?.id || "", required_start_date: today(), justification: "", lines: [], documents: [] });
    }
    setStep(1);
  }, [open, editingRequest, visibleProjects]);

  useEffect(() => {
    if (!plans.length || form.lines.length) return;
    setForm((current) => ({ ...current, lines: [emptyLine(plans[0].id)] }));
  }, [plans, form.lines.length]);

  const project = visibleProjects.find((entry) => entry.id === form.project_id) || null;
  const phases = project?.phases || [];
  const members = useMemo(() => normalizedMembers(project), [project]);
  const selectedPhase = phases.find((phase) => phase.id === form.phase_id) || null;
  const total = form.lines.reduce((sum, line) => sum + lineCost(line, plans.find((plan) => plan.id === line.plan_id)), 0);
  const warnings = useMemo(() => form.lines.flatMap((line, index) => {
    const result = [];
    if ((line.members || []).length > Number(line.seats || 0)) result.push(`Subscription ${index + 1}: selected members exceed seats.`);
    (line.members || []).forEach((member) => {
      const duplicate = requests.some((request) => request.id !== editingRequest?.id && ["active", "fulfilment-pending", "expiring"].includes(request.status) && (request.lines || []).some((existing) => existing.plan_id === line.plan_id && (existing.members || []).some((item) => memberKey(item) === memberKey(member))));
      if (duplicate) result.push(`Subscription ${index + 1}: ${member.name} already has this active plan.`);
    });
    return result;
  }), [form.lines, requests, editingRequest]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateLine = (index, key, value) => setForm((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line) }));
  const selectProject = (projectId) => { const nextProject = visibleProjects.find((entry) => entry.id === projectId); setForm((current) => ({ ...current, project_id: projectId, phase_id: nextProject?.phases?.[0]?.id || "", lines: current.lines.map((line) => ({ ...line, members: [] })) })); };
  const validateStep = () => {
    if (step === 1 && (!project || !selectedPhase || !form.justification.trim())) return "Select a project and phase and add the business justification.";
    if (step === 2 && (!form.lines.length || form.lines.some((line) => !line.plan_id || Number(line.seats || 0) < 1 || !line.start_date || !line.end_date))) return "Complete every subscription line before continuing.";
    if (step === 2 && warnings.length) return warnings[0];
    return "";
  };
  const next = () => { const error = validateStep(); if (error) { toast.error("Request needs attention", { description: error }); return; } setStep((value) => Math.min(value + 1, 3)); };
  const buildPayload = () => ({ ...form, project_name: project?.name, phase_name: selectedPhase?.name, eligible_members: members, requester: { id: user?.id, name: user?.name, email: user?.email, role: user?.role } });
  const save = async (submit = false) => {
    if (submit) { const error = validateStep(); if (error || warnings.length) { toast.error("Request cannot be submitted", { description: error || warnings[0] }); return; } }
    setSaving(true);
    try {
      const payload = buildPayload();
      const saved = editingRequest?.id || form.id
        ? await apiJson(`/api/subscription-requests/${editingRequest?.id || form.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await apiJson("/api/subscription-requests", { method: "POST", body: JSON.stringify(payload) });
      const finalRecord = submit ? await apiJson(`/api/subscription-requests/${saved.id}/submit`, { method: "POST" }) : saved;
      toast.success(submit ? "Subscription request submitted" : "Subscription draft saved", { description: submit ? "The request is now with the CTO for review." : finalRecord.request_number });
      onSaved?.(finalRecord);
      onOpenChange(false);
    } catch (error) {
      toast.error("Subscription request was not saved", { description: error.message });
    } finally { setSaving(false); }
  };
  const addFiles = async (files) => {
    const allowed = [...files].filter((file) => file.size <= 5 * 1024 * 1024);
    if (allowed.length !== files.length) toast.error("Files must be 5 MB or smaller");
    try { const documents = await Promise.all(allowed.map(fileToDocument)); update("documents", [...form.documents, ...documents]); } catch (error) { toast.error(error.message); }
  };

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border-white/10 bg-[#0F0F17] text-zinc-100" data-testid="subscription-request-dialog">
        <DialogHeader><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300">Subscription request</div><DialogTitle className="text-xl text-white">{editingRequest ? "Edit subscription request" : "Request project subscriptions"}</DialogTitle><DialogDescription className="text-xs text-zinc-400">Create a multi-line request with catalogue pricing, seats, members, dates, and evidence.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-3 gap-2">{["Request details", "Subscriptions", "Review & submit"].map((label, index) => <div key={label} className={`rounded-lg border px-3 py-2 text-xs ${step === index + 1 ? "border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-300" : step > index + 1 ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-300" : "border-white/5 bg-white/[0.02] text-zinc-500"}`}><span className="mr-2 font-semibold">{index + 1}</span>{label}</div>)}</div>

        {step === 1 && <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Request type"><select className={inputClass} value={form.request_type} onChange={(event) => update("request_type", event.target.value)}><option value="initial">Initial subscription request</option><option value="additional">Additional subscription request</option><option value="renewal">Renewal request</option><option value="seat-expansion">Seat expansion</option><option value="plan-change">Plan upgrade / downgrade</option></select></Field>
          <Field label="Required start date"><input className={inputClass} type="date" value={form.required_start_date} onChange={(event) => update("required_start_date", event.target.value)} /></Field>
          <Field label="Project"><select className={inputClass} value={form.project_id} onChange={(event) => selectProject(event.target.value)}><option value="">Select project</option>{visibleProjects.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></Field>
          <Field label="Phase"><select className={inputClass} value={form.phase_id} onChange={(event) => update("phase_id", event.target.value)}><option value="">Select phase</option>{phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.name}</option>)}</select></Field>
          <div className="lg:col-span-2"><Field label="Business justification"><textarea className={`${inputClass} min-h-[110px] py-3`} value={form.justification} onChange={(event) => update("justification", event.target.value)} placeholder="Explain why these subscriptions are required for this project and phase." /></Field></div>
          <div className="lg:col-span-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-400"><b className="text-zinc-200">Approval route:</b> L3 request → CTO technical review → CFO financial approval → IT fulfilment.</div>
        </div>}

        {step === 2 && <div className="space-y-3">
          <div className="flex items-center justify-between"><div><div className="text-sm font-semibold text-white">Subscription line items</div><div className="text-xs text-zinc-500">Unit prices come from the active catalogue and totals are prorated by day.</div></div><Button type="button" variant="outline" size="sm" onClick={() => update("lines", [...form.lines, emptyLine(plans[0]?.id)])} disabled={!plans.length}><Plus className="mr-1 h-3.5 w-3.5" />Add subscription</Button></div>
          {loadingPlans && <div className="rounded-xl border border-white/5 p-6 text-center text-xs text-zinc-500">Loading pricing catalogue…</div>}
          {form.lines.map((line, index) => { const plan = plans.find((entry) => entry.id === line.plan_id); const selectedCount = (line.members || []).length; return <div key={line.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-fuchsia-300" /><span className="text-sm font-semibold text-white">Subscription {index + 1}</span></div>{form.lines.length > 1 && <button type="button" onClick={() => update("lines", form.lines.filter((_, itemIndex) => itemIndex !== index))} className="rounded-md p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>}</div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Provider and plan"><select className={inputClass} value={line.plan_id} onChange={(event) => updateLine(index, "plan_id", event.target.value)}>{plans.map((entry) => <option key={entry.id} value={entry.id}>{entry.provider} · {entry.subscription} · {entry.plan}</option>)}</select></Field>
              <Field label="Model"><select className={inputClass} value={line.model || ""} onChange={(event) => updateLine(index, "model", event.target.value)}><option value="">Select model (optional)</option>{(modelCatalog || []).map((entry) => { const label = entry.provider ? `${entry.name} · ${entry.provider}` : entry.name; return <option key={entry.id || label} value={label}>{label}</option>; })}</select></Field>
              <Field label="Unit cost"><div className={`${inputClass} flex items-center bg-white/[0.02] font-semibold text-zinc-300`}>{fmtCurrency(plan?.unit_cost || 0, { compact: false })} / seat / month</div></Field>
              <Field label="Seats"><input className={inputClass} type="number" min="1" value={line.seats} onChange={(event) => updateLine(index, "seats", event.target.value)} /></Field>
              <Field label="Members"><button type="button" onClick={() => setMemberLineIndex(index)} className={`${inputClass} flex items-center justify-between text-left`}><span>{selectedCount} selected</span><Users className="h-3.5 w-3.5 text-zinc-500" /></button></Field>
              <Field label="Start date"><input className={inputClass} type="date" value={line.start_date} onChange={(event) => updateLine(index, "start_date", event.target.value)} /></Field>
              <Field label="End date"><input className={inputClass} type="date" value={line.end_date} onChange={(event) => updateLine(index, "end_date", event.target.value)} /></Field>
              <Field label="Tax %"><input className={inputClass} type="number" min="0" step="0.01" value={line.tax_pct} onChange={(event) => updateLine(index, "tax_pct", event.target.value)} /></Field>
              <Field label="Discount"><input className={inputClass} type="number" min="0" step="0.01" value={line.discount} onChange={(event) => updateLine(index, "discount", event.target.value)} /></Field>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]"><Field label="Line justification"><input className={inputClass} value={line.justification} onChange={(event) => updateLine(index, "justification", event.target.value)} placeholder="Purpose of this subscription line" /></Field><div className="min-w-[180px] rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.06] px-3 py-2"><div className="text-[9px] uppercase tracking-widest text-fuchsia-300">Estimated cost</div><div className="mt-1 text-lg font-semibold tabular text-white">{fmtCurrency(lineCost(line, plan), { compact: false })}</div></div></div>
            {selectedCount > Number(line.seats || 0) && <div className="mt-2 text-xs text-red-300">Selected members exceed the requested seats.</div>}
          </div>; })}
          {warnings.length > 0 && <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-xs text-amber-200">{warnings.map((warning) => <div key={warning}>• {warning}</div>)}</div>}
        </div>}

        {step === 3 && <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ReviewMetric label="Project" value={project?.name || "—"} /><ReviewMetric label="Phase" value={selectedPhase?.name || "—"} /><ReviewMetric label="Subscriptions" value={String(form.lines.length)} /><ReviewMetric label="Requested total" value={fmtCurrency(total, { compact: false })} tone="text-fuchsia-300" /></div>
          <div className="overflow-hidden rounded-xl border border-white/5"><table className="w-full text-xs"><thead><tr className="bg-white/[0.025] text-[9px] uppercase tracking-widest text-zinc-500"><th className="p-3 text-left">Subscription</th><th className="p-3 text-right">Seats</th><th className="p-3 text-left">Members</th><th className="p-3 text-left">Coverage</th><th className="p-3 text-right">Cost</th></tr></thead><tbody>{form.lines.map((line) => { const plan = plans.find((entry) => entry.id === line.plan_id); return <tr key={line.id} className="border-t border-white/5"><td className="p-3"><div className="font-semibold text-zinc-200">{plan?.subscription}</div><div className="text-[10px] text-zinc-500">{plan?.provider} · {plan?.plan}{line.model ? ` · ${line.model}` : ""}</div></td><td className="p-3 text-right tabular text-zinc-300">{line.seats}</td><td className="p-3 text-zinc-400">{(line.members || []).map((member) => member.name).join(", ") || "Not allocated"}</td><td className="p-3 tabular text-zinc-400">{line.start_date} → {line.end_date}</td><td className="p-3 text-right font-semibold tabular text-fuchsia-300">{fmtCurrency(lineCost(line, plan), { compact: false })}</td></tr>; })}</tbody></table></div>
          <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-white/5 bg-white/[0.02] p-4"><div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Business justification</div><p className="mt-2 text-xs leading-5 text-zinc-300">{form.justification}</p></div><div className="rounded-xl border border-white/5 bg-white/[0.02] p-4"><div className="flex items-center justify-between"><div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Supporting documents</div><label className="cursor-pointer text-xs font-semibold text-fuchsia-300"><input type="file" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} />Add files</label></div><div className="mt-2 space-y-2">{form.documents.map((document) => <div key={document.id} className="flex items-center justify-between rounded-lg bg-white/[0.025] px-3 py-2 text-xs"><span className="flex min-w-0 items-center gap-2 text-zinc-300"><FileText className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{document.name}</span></span><button type="button" onClick={() => update("documents", form.documents.filter((entry) => entry.id !== document.id))} className="text-zinc-500 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button></div>)}{!form.documents.length && <div className="text-xs text-zinc-500">No supporting documents added.</div>}</div></div></div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-xs text-emerald-200"><Check className="mr-2 inline h-3.5 w-3.5" />Submitting sends this request to the CTO. Prices, members, dates, and the calculated amount are preserved in the approval snapshot.</div>
        </div>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-4"><div>{step > 1 && <Button type="button" variant="ghost" onClick={() => setStep((value) => value - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Back</Button>}</div><div className="flex items-center gap-2"><Button type="button" variant="outline" onClick={() => save(false)} disabled={saving}>Save draft</Button>{step < 3 ? <Button type="button" onClick={next} className="bg-fuchsia-500 text-white hover:bg-fuchsia-600">Continue<ChevronRight className="ml-1 h-4 w-4" /></Button> : <Button type="button" onClick={() => save(true)} disabled={saving} className="bg-fuchsia-500 text-white hover:bg-fuchsia-600">{saving ? "Submitting…" : "Submit for approval"}</Button>}</div></div>
      </DialogContent>
    </Dialog>
    <MemberPicker open={memberLineIndex !== null} onOpenChange={(value) => { if (!value) setMemberLineIndex(null); }} members={members} selected={memberLineIndex !== null ? form.lines[memberLineIndex]?.members || [] : []} seats={memberLineIndex !== null ? Number(form.lines[memberLineIndex]?.seats || 0) : 0} onChange={(selected) => updateLine(memberLineIndex, "members", selected)} />
  </>;
};

const Field = ({ label, children }) => <label className="block"><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</span>{children}</label>;
const ReviewMetric = ({ label, value, tone = "text-white" }) => <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3"><div className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">{label}</div><div className={`mt-1 text-sm font-semibold ${tone}`}>{value}</div></div>;
const MemberPicker = ({ open, onOpenChange, members, selected, seats, onChange }) => {
  const selectedKeys = new Set(selected.map(memberKey));
  const toggle = (member) => { const key = memberKey(member); onChange(selectedKeys.has(key) ? selected.filter((entry) => memberKey(entry) !== key) : [...selected, member]); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[80vh] max-w-xl overflow-y-auto border-white/10 bg-[#12121A] text-zinc-100"><DialogHeader><DialogTitle className="text-lg text-white">Select project members</DialogTitle><DialogDescription className="text-xs text-zinc-400">{selected.length} members selected for {seats} requested seats.</DialogDescription></DialogHeader>{selected.length > seats && <div className="rounded-lg border border-red-500/25 bg-red-500/[0.06] p-2.5 text-xs text-red-300">You are adding more members than the requested seats.</div>}<div className="space-y-2">{members.map((member) => { const checked = selectedKeys.has(memberKey(member)); return <button key={memberKey(member)} type="button" onClick={() => toggle(member)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${checked ? "border-fuchsia-500/35 bg-fuchsia-500/[0.07]" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}><span className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? "border-fuchsia-500 bg-fuchsia-500 text-white" : "border-white/15"}`}>{checked && <Check className="h-3 w-3" />}</span><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-zinc-200">{member.name}</div><div className="text-[10px] text-zinc-500">{member.email || "No email"} · {member.role}</div></div></button>; })}{!members.length && <div className="py-8 text-center text-xs text-zinc-500">No allocated project members are available.</div>}</div><Button type="button" onClick={() => onOpenChange(false)} className="bg-fuchsia-500 text-white hover:bg-fuchsia-600">Done</Button></DialogContent></Dialog>;
};

export default SubscriptionRequestDialog;
