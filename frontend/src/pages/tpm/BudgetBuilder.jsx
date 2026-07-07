import { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Send, Sparkles, ClipboardCheck, Cpu, Server, CreditCard, Package } from "lucide-react";
import { Link } from "react-router-dom";

const uid = () => Math.random().toString(36).slice(2, 8);

const emptyModel = () => ({ id: uid(), name: "Opus 4.8", provider: "Anthropic", env: "production", costPerToken: 0.008, estUsage: 100, estCost: 800 });
const emptyInfra = () => ({ id: uid(), service: "AWS EC2", type: "GPU", monthly: 1200, months: 3, estCost: 3600 });
const emptySub = () => ({ id: uid(), name: "Claude Max", monthly: 200, seats: 4, estCost: 800 });
const emptyMisc = () => ({ id: uid(), category: "Travel", description: "Client visit", estCost: 400 });
const emptyPhase = (n = 1) => ({ id: uid(), name: `Phase ${n}`, start: "2026-07-01", end: "2026-07-15", budget: 5000, deliverables: 2 });
const emptyTask = () => ({ id: uid(), name: "New task", owner: "Aanya Sharma", estCost: 500, model: "Opus 4.8", infra: "AWS EC2", status: "planned" });

const BudgetBuilder = () => {
  const { visibleProjects, user } = useApp();
  const [step, setStep] = useState(1); // 1..3: Info · Categories · Preview
  const [projectId, setProjectId] = useState(visibleProjects[0]?.id || "");
  const [info, setInfo] = useState({ name: "Q3 Sprint budget", type: "R&D", priority: "Normal", description: "", version: "v1.0" });
  const [models, setModels] = useState([emptyModel()]);
  const [infra, setInfra] = useState([emptyInfra()]);
  const [subs, setSubs] = useState([emptySub()]);
  const [misc, setMisc] = useState([emptyMisc()]);
  const [phases, setPhases] = useState([emptyPhase(1), { ...emptyPhase(2), start: "2026-07-16", end: "2026-07-31", budget: 4000, deliverables: 3 }]);
  const [tasks, setTasks] = useState([emptyTask()]);

  const totals = useMemo(() => {
    const m = models.reduce((s, x) => s + Number(x.estCost || 0), 0);
    const i = infra.reduce((s, x) => s + Number(x.estCost || 0), 0);
    const su = subs.reduce((s, x) => s + Number(x.estCost || 0), 0);
    const mi = misc.reduce((s, x) => s + Number(x.estCost || 0), 0);
    return { models: m, infra: i, subs: su, misc: mi, total: m + i + su + mi };
  }, [models, infra, subs, misc]);

  const updateRow = (setter) => (id, key, v) => setter((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: v } : r)));
  const addRow = (setter, factory) => () => setter((r) => [...r, factory()]);
  const removeRow = (setter) => (id) => setter((r) => r.filter((x) => x.id !== id));

  const saveDraft = () => toast.success("Draft saved", { description: `${info.name} · ${fmtCurrency(totals.total, { compact: false })} · auto-saved` });
  const submit = () => {
    toast.success("Budget submitted for CTO review", {
      description: `${info.name} · ${fmtCurrency(totals.total, { compact: false })} · ${phases.length} phases · ${models.length + infra.length + subs.length + misc.length} line items`,
    });
    setStep(1);
  };

  return (
    <div className="space-y-6" data-testid="page-budget-builder">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> TPM Dashboard</Link>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ClipboardCheck className="w-3 h-3" />
            Budget Builder
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">{info.name}</h1>
          <p className="text-sm text-zinc-400 mt-1">Line-wise budget with phases &amp; tasks · running total {fmtCurrency(totals.total, { compact: false })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={saveDraft} className="h-9 rounded-lg border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 gap-2" data-testid="bb-save-draft">
            <Save className="w-3.5 h-3.5" /> Save as draft
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} data-testid="bb-next" className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white">
              Next → {step === 1 ? "Categories" : "Preview"}
            </Button>
          ) : (
            <Button onClick={submit} data-testid="bb-submit" className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)] gap-2">
              <Send className="w-3.5 h-3.5" /> Submit for CTO review
            </Button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {["Budget Info", "Categories & Phases", "Preview & Submit"].map((s, i) => (
          <button key={s} onClick={() => setStep(i + 1)} data-testid={`bb-step-${i + 1}`} className={`px-3 py-1.5 rounded-lg border ${step === i + 1 ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300" : "border-white/10 bg-white/[0.03] text-zinc-400"} font-medium`}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Budget information">
            <div className="space-y-3">
              <Field label="Project"><select value={projectId} onChange={(e) => setProjectId(e.target.value)} data-testid="bb-project" className={ipStyle}>{visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              <Field label="Budget name"><input value={info.name} onChange={(e) => setInfo({...info, name: e.target.value})} data-testid="bb-name" className={ipStyle} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type"><Pills options={["R&D", "Production"]} value={info.type} onChange={(v) => setInfo({...info, type: v})} testidPrefix="bb-type" /></Field>
                <Field label="Priority"><Pills options={["Low", "Normal", "High"]} value={info.priority} onChange={(v) => setInfo({...info, priority: v})} testidPrefix="bb-priority" /></Field>
              </div>
              <Field label="Version"><input value={info.version} onChange={(e) => setInfo({...info, version: e.target.value})} data-testid="bb-version" className={ipStyle} /></Field>
              <Field label="Description"><textarea rows={3} value={info.description} onChange={(e) => setInfo({...info, description: e.target.value})} data-testid="bb-desc" className={ipStyle + " resize-none"} /></Field>
            </div>
          </Card>
          <Card title="Running summary" subtitle="Auto-computed as you build">
            <div className="space-y-2">
              {[{k:"Models",v:totals.models,c:"#E619B8"},{k:"Infrastructure",v:totals.infra,c:"#3B82F6"},{k:"Subscriptions",v:totals.subs,c:"#10B981"},{k:"Miscellaneous",v:totals.misc,c:"#F59E0B"}].map((x) => (
                <div key={x.k} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2"><span className="w-1.5 h-6 rounded-full" style={{background:x.c}} /><span className="text-sm text-zinc-200">{x.k}</span></div>
                  <span className="font-semibold tabular text-white">{fmtCurrency(x.v, { compact: false })}</span>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 mt-3">
                <div className="text-sm font-semibold text-fuchsia-200">Total budget</div>
                <div className="font-display text-2xl font-semibold text-fuchsia-200 tabular">{fmtCurrency(totals.total, { compact: false })}</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {/* Models */}
          <CategorySection icon={Cpu} title="AI Models" testid="cat-models" onAdd={addRow(setModels, emptyModel)}>
            <TableHeader cols={["Model", "Provider", "Env", "Cost / 1K tok", "Est. usage (K)", "Est. cost", ""]} />
            {models.map((r) => (
              <TableRow key={r.id} testid={`model-${r.id}`}>
                <input value={r.name} onChange={(e) => updateRow(setModels)(r.id, "name", e.target.value)} className={rowInp} />
                <input value={r.provider} onChange={(e) => updateRow(setModels)(r.id, "provider", e.target.value)} className={rowInp} />
                <input value={r.env} onChange={(e) => updateRow(setModels)(r.id, "env", e.target.value)} className={rowInp} />
                <input type="number" step="0.001" value={r.costPerToken} onChange={(e) => updateRow(setModels)(r.id, "costPerToken", e.target.value)} className={rowInp + " tabular text-right"} />
                <input type="number" value={r.estUsage} onChange={(e) => updateRow(setModels)(r.id, "estUsage", e.target.value)} className={rowInp + " tabular text-right"} />
                <input type="number" value={r.estCost} onChange={(e) => updateRow(setModels)(r.id, "estCost", e.target.value)} className={rowInp + " tabular text-right"} />
                <RemoveBtn onClick={() => removeRow(setModels)(r.id)} />
              </TableRow>
            ))}
          </CategorySection>

          {/* Infra */}
          <CategorySection icon={Server} title="Infrastructure" testid="cat-infra" onAdd={addRow(setInfra, emptyInfra)}>
            <TableHeader cols={["Service", "Type", "Monthly $", "Months", "Est. cost", ""]} />
            {infra.map((r) => (
              <TableRow key={r.id} testid={`infra-${r.id}`}>
                <input value={r.service} onChange={(e) => updateRow(setInfra)(r.id, "service", e.target.value)} className={rowInp} />
                <input value={r.type} onChange={(e) => updateRow(setInfra)(r.id, "type", e.target.value)} className={rowInp} />
                <input type="number" value={r.monthly} onChange={(e) => updateRow(setInfra)(r.id, "monthly", e.target.value)} className={rowInp + " tabular text-right"} />
                <input type="number" value={r.months} onChange={(e) => updateRow(setInfra)(r.id, "months", e.target.value)} className={rowInp + " tabular text-right"} />
                <input type="number" value={r.estCost} onChange={(e) => updateRow(setInfra)(r.id, "estCost", e.target.value)} className={rowInp + " tabular text-right"} />
                <RemoveBtn onClick={() => removeRow(setInfra)(r.id)} />
              </TableRow>
            ))}
          </CategorySection>

          {/* Subscriptions */}
          <CategorySection icon={CreditCard} title="Subscriptions" testid="cat-subs" onAdd={addRow(setSubs, emptySub)}>
            <TableHeader cols={["Name", "Monthly $", "Seats", "Est. cost", ""]} />
            {subs.map((r) => (
              <TableRow key={r.id} testid={`sub-${r.id}`}>
                <input value={r.name} onChange={(e) => updateRow(setSubs)(r.id, "name", e.target.value)} className={rowInp} />
                <input type="number" value={r.monthly} onChange={(e) => updateRow(setSubs)(r.id, "monthly", e.target.value)} className={rowInp + " tabular text-right"} />
                <input type="number" value={r.seats} onChange={(e) => updateRow(setSubs)(r.id, "seats", e.target.value)} className={rowInp + " tabular text-right"} />
                <input type="number" value={r.estCost} onChange={(e) => updateRow(setSubs)(r.id, "estCost", e.target.value)} className={rowInp + " tabular text-right"} />
                <RemoveBtn onClick={() => removeRow(setSubs)(r.id)} />
              </TableRow>
            ))}
          </CategorySection>

          {/* Misc */}
          <CategorySection icon={Package} title="Miscellaneous" testid="cat-misc" onAdd={addRow(setMisc, emptyMisc)}>
            <TableHeader cols={["Category", "Description", "Est. cost", ""]} />
            {misc.map((r) => (
              <TableRow key={r.id} testid={`misc-${r.id}`}>
                <select value={r.category} onChange={(e) => updateRow(setMisc)(r.id, "category", e.target.value)} className={rowInp}>
                  {["Travel", "Dinner", "Hardware", "Other"].map((c) => <option key={c}>{c}</option>)}
                </select>
                <input value={r.description} onChange={(e) => updateRow(setMisc)(r.id, "description", e.target.value)} className={rowInp} />
                <input type="number" value={r.estCost} onChange={(e) => updateRow(setMisc)(r.id, "estCost", e.target.value)} className={rowInp + " tabular text-right"} />
                <RemoveBtn onClick={() => removeRow(setMisc)(r.id)} />
              </TableRow>
            ))}
          </CategorySection>

          {/* Phases */}
          <Card title="Project phases" right={<Button size="sm" variant="outline" onClick={() => setPhases((r) => [...r, emptyPhase(r.length + 1)])} className="h-7 rounded-md border-white/10 bg-white/[0.03] text-zinc-300 text-xs" data-testid="add-phase"><Plus className="w-3 h-3 mr-1" />Add phase</Button>}>
            <div className="space-y-2">
              {phases.map((ph) => (
                <div key={ph.id} className="grid grid-cols-[1fr_120px_120px_100px_80px_28px] gap-2 items-center" data-testid={`phase-${ph.id}`}>
                  <input value={ph.name} onChange={(e) => updateRow(setPhases)(ph.id, "name", e.target.value)} className={rowInp} />
                  <input type="date" value={ph.start} onChange={(e) => updateRow(setPhases)(ph.id, "start", e.target.value)} className={rowInp} />
                  <input type="date" value={ph.end} onChange={(e) => updateRow(setPhases)(ph.id, "end", e.target.value)} className={rowInp} />
                  <input type="number" value={ph.budget} onChange={(e) => updateRow(setPhases)(ph.id, "budget", e.target.value)} className={rowInp + " tabular text-right"} />
                  <input type="number" value={ph.deliverables} onChange={(e) => updateRow(setPhases)(ph.id, "deliverables", e.target.value)} className={rowInp + " tabular text-right"} />
                  <RemoveBtn onClick={() => removeRow(setPhases)(ph.id)} />
                </div>
              ))}
            </div>
          </Card>

          {/* Tasks */}
          <Card title="Tasks" subtitle="Unit-wise budgets tied to phases" right={<Button size="sm" variant="outline" onClick={addRow(setTasks, emptyTask)} className="h-7 rounded-md border-white/10 bg-white/[0.03] text-zinc-300 text-xs" data-testid="add-task"><Plus className="w-3 h-3 mr-1" />Add task</Button>}>
            <TableHeader cols={["Task", "Owner", "Est. cost", "Model", "Infra", "Status", ""]} />
            {tasks.map((t) => (
              <TableRow key={t.id} testid={`task-${t.id}`}>
                <input value={t.name} onChange={(e) => updateRow(setTasks)(t.id, "name", e.target.value)} className={rowInp} />
                <input value={t.owner} onChange={(e) => updateRow(setTasks)(t.id, "owner", e.target.value)} className={rowInp} />
                <input type="number" value={t.estCost} onChange={(e) => updateRow(setTasks)(t.id, "estCost", e.target.value)} className={rowInp + " tabular text-right"} />
                <input value={t.model} onChange={(e) => updateRow(setTasks)(t.id, "model", e.target.value)} className={rowInp} />
                <input value={t.infra} onChange={(e) => updateRow(setTasks)(t.id, "infra", e.target.value)} className={rowInp} />
                <select value={t.status} onChange={(e) => updateRow(setTasks)(t.id, "status", e.target.value)} className={rowInp}>
                  <option>planned</option><option>in-progress</option><option>done</option>
                </select>
                <RemoveBtn onClick={() => removeRow(setTasks)(t.id)} />
              </TableRow>
            ))}
          </Card>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card title="Approval preview" subtitle="Final review before submitting to CTO">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[{l:"Total budget", v:fmtCurrency(totals.total, {compact:false}), c:"text-fuchsia-300"},
                {l:"Phases", v:String(phases.length)},
                {l:"Tasks", v:String(tasks.length)},
                {l:"Deliverables", v:String(phases.reduce((s,p) => s + Number(p.deliverables || 0), 0))},
              ].map((x) => (
                <div key={x.l} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{x.l}</div>
                  <div className={`mt-1 text-lg font-semibold tabular ${x.c || "text-white"}`}>{x.v}</div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SummaryCard title="Category summary" rows={[
              {k:"AI Models", v:totals.models},
              {k:"Infrastructure", v:totals.infra},
              {k:"Subscriptions", v:totals.subs},
              {k:"Miscellaneous", v:totals.misc},
            ]} />
            <SummaryCard title="Phase summary" rows={phases.map((p, i) => ({id: p.id, k: `${p.name}${phases.filter((x, j) => x.name === p.name).length > 1 ? ` (${i+1})` : ""}`, v: Number(p.budget||0)}))} />
          </div>

          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3 text-xs">
            <Sparkles className="w-4 h-4 text-fuchsia-300 mt-0.5 flex-shrink-0" />
            <div className="text-zinc-300">
              <span className="text-fuchsia-200 font-semibold">AI insight: </span>
              Model spend ({fmtCurrency(totals.models, {compact:false})}) is <span className="text-fuchsia-300 font-semibold">{Math.round((totals.models/totals.total)*100)}%</span> of total.
              At current model rates, Phase 1 usage may be under-estimated by ~12%. Consider adding a 10% buffer on the Opus 4.8 line.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ipStyle = "w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40";
const rowInp = "h-8 px-2 rounded-md bg-white/[0.04] border border-white/10 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40";

const Card = ({ title, subtitle, right, children }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <div className="font-display font-semibold text-[15px] text-white">{title}</div>
        {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

const Field = ({ label, children }) => (<div><div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>{children}</div>);

const Pills = ({ options, value, onChange, testidPrefix }) => (
  <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full">
    {options.map((o) => (
      <button key={o} onClick={() => onChange(o)} data-testid={`${testidPrefix}-${o.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`} className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium ${value === o ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-400 hover:text-zinc-100"}`}>{o}</button>
    ))}
  </div>
);

const CategorySection = ({ icon: Icon, title, onAdd, children, testid }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-fuchsia-300" />
        <div className="font-display font-semibold text-[14px] text-white">{title}</div>
      </div>
      <Button size="sm" variant="outline" onClick={onAdd} className="h-7 rounded-md border-white/10 bg-white/[0.03] text-zinc-300 text-xs" data-testid={`add-${testid}`}>
        <Plus className="w-3 h-3 mr-1" />Add
      </Button>
    </div>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const TableHeader = ({ cols }) => (
  <div className={`grid gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pb-1 border-b border-white/5`} style={{gridTemplateColumns: `repeat(${cols.length - 1}, 1fr) 28px`}}>
    {cols.map((c, i) => <span key={i} className={i === cols.length - 1 ? "" : ""}>{c}</span>)}
  </div>
);
const TableRow = ({ children, testid }) => (
  <div className="grid gap-2 items-center py-1" style={{gridTemplateColumns: `repeat(${children.length - 1}, 1fr) 28px`}} data-testid={testid}>
    {children}
  </div>
);
const RemoveBtn = ({ onClick }) => (
  <button onClick={onClick} className="w-6 h-6 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-300 flex items-center justify-center">
    <Trash2 className="w-3 h-3" />
  </button>
);

const SummaryCard = ({ title, rows }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4">
    <div className="text-[13px] font-semibold text-white mb-2">{title}</div>
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={r.id || `${r.k}-${i}`} className="flex items-center justify-between text-xs">
          <span className="text-zinc-300">{r.k}</span>
          <span className="text-white font-semibold tabular">{fmtCurrency(r.v, { compact: false })}</span>
        </div>
      ))}
    </div>
  </div>
);

export default BudgetBuilder;
