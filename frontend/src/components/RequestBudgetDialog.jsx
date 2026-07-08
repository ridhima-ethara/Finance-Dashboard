import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Sparkles, Send, X, Plus, Trash2, Cpu, Server, CreditCard, HardDrive, Users, Package } from "lucide-react";
import { LINE_CATEGORIES } from "../data/mockData";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import { toast } from "sonner";

const catIcon = {
  model: Cpu,
  infra: Server,
  subscription: CreditCard,
  hardware: HardDrive,
  employee: Users,
  other: Package,
};

const uid = () => Math.random().toString(36).slice(2, 9);

const RequestBudgetDialog = ({ open, onOpenChange }) => {
  const { visibleProjects, projects } = useApp();
  const projectOptions = useMemo(() => (visibleProjects.length ? visibleProjects : projects), [visibleProjects, projects]);
  const [project, setProject] = useState(projectOptions[0]?.id || "");
  const [type, setType] = useState("Initial budget");
  const [delivery, setDelivery] = useState("phase-wise"); // "single" or "phase-wise"
  const [projectType, setProjectType] = useState("R&D"); // R&D or Operations
  const [costPerTask, setCostPerTask] = useState("");
  const [justification, setJustification] = useState("");
  const [lines, setLines] = useState([
    { id: uid(), category: "model", description: "Opus 4.8 inference · Phase 1", quantity: 800, unitCost: 8 },
    { id: uid(), category: "infra", description: "AWS EC2 (g5.xlarge)", quantity: 120, unitCost: 12 },
  ]);
  const [phases, setPhases] = useState([
    { id: uid(), name: "Phase 1 · Discovery", deliverables: 3 },
    { id: uid(), name: "Phase 2 · Build", deliverables: 5 },
  ]);

  const total = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0),
    [lines]
  );
  const totalDeliverables = useMemo(() => phases.reduce((s, p) => s + (Number(p.deliverables) || 0), 0), [phases]);

  const addLine = () => setLines([...lines, { id: uid(), category: "model", description: "", quantity: 0, unitCost: 0 }]);
  const removeLine = (id) => setLines(lines.filter((l) => l.id !== id));
  const updateLine = (id, key, v) => setLines(lines.map((l) => (l.id === id ? { ...l, [key]: v } : l)));

  const addPhase = () => setPhases([...phases, { id: uid(), name: `Phase ${phases.length + 1}`, deliverables: 1 }]);
  const removePhase = (id) => setPhases(phases.filter((p) => p.id !== id));
  const updatePhase = (id, key, v) => setPhases(phases.map((p) => (p.id === id ? { ...p, [key]: v } : p)));

  const submit = () => {
    if (lines.length === 0 || total === 0) {
      toast.error("Add at least one non-zero line item");
      return;
    }
    if (!justification.trim()) {
      toast.error("Justification is required");
      return;
    }
    toast.success("Budget request submitted · routed for CTO/CFO review", {
      description: `${type} · ${fmtCurrency(total, { compact: false })} · ${lines.length} line items · ${projectType}`,
    });
    onOpenChange(false);
    // Reset
    setJustification("");
    setCostPerTask("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[820px] max-h-[90vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100"
        data-testid="request-budget-dialog"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30">
              <Sparkles className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Request Budget · line-wise breakdown</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Line-item detail (Model / Infra / Subscription / Other), delivery model &amp; phase-wise deliverables · routed CTO → CFO.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Row 1 · project + type */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project">
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                data-testid="rb-project"
                className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              >
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.client ? ` — ${p.client}` : ""}</option>
                ))}
              </select>
            </Field>
            <Field label="Request type">
              <SelectPills options={["Initial budget", "Budget increase", "Top-up"]} value={type} onChange={setType} testidPrefix="rb-type" />
            </Field>
          </div>

          {/* Row 2 · R&D vs Ops + delivery */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="R&D or Operations">
              <SelectPills options={["R&D", "Production"]} value={projectType} onChange={setProjectType} testidPrefix="rb-scope" />
            </Field>
            <Field label="Delivery model">
              <SelectPills options={["single", "phase-wise"]} value={delivery} onChange={setDelivery} testidPrefix="rb-delivery" />
            </Field>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Line items</div>
              <Button
                size="sm"
                variant="outline"
                onClick={addLine}
                className="h-7 rounded-md border-white/10 bg-white/[0.03] text-zinc-300 text-xs"
                data-testid="rb-add-line"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add line
              </Button>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
              <div className="grid grid-cols-[130px_1fr_90px_90px_100px_28px] gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                <span>Category</span>
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit $</span>
                <span className="text-right">Total</span>
                <span />
              </div>
              {lines.map((l) => {
                const Icon = catIcon[l.category] || Package;
                const cat = LINE_CATEGORIES.find((c) => c.id === l.category);
                const t = (Number(l.quantity) || 0) * (Number(l.unitCost) || 0);
                return (
                  <div key={l.id} className="grid grid-cols-[130px_1fr_90px_90px_100px_28px] gap-2 px-3 py-2 items-center border-b border-white/5 last:border-0" data-testid={`rb-line-${l.id}`}>
                    <select
                      value={l.category}
                      onChange={(e) => updateLine(l.id, "category", e.target.value)}
                      className="h-8 px-2 rounded-md bg-white/[0.04] border border-white/10 text-xs text-zinc-200"
                    >
                      {LINE_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                      <input
                        value={l.description}
                        onChange={(e) => updateLine(l.id, "description", e.target.value)}
                        placeholder={`e.g. ${cat?.label || "line"} · ${cat?.unit || ""}`}
                        className="w-full h-8 px-2 rounded-md bg-white/[0.04] border border-white/10 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40"
                      />
                    </div>
                    <input
                      type="number"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.id, "quantity", e.target.value)}
                      className="h-8 px-2 rounded-md bg-white/[0.04] border border-white/10 text-xs text-zinc-100 text-right tabular focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40"
                    />
                    <input
                      type="number"
                      value={l.unitCost}
                      onChange={(e) => updateLine(l.id, "unitCost", e.target.value)}
                      className="h-8 px-2 rounded-md bg-white/[0.04] border border-white/10 text-xs text-zinc-100 text-right tabular focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40"
                    />
                    <div className="text-right text-sm font-semibold text-white tabular">{fmtCurrency(t, { compact: false })}</div>
                    <button
                      onClick={() => removeLine(l.id)}
                      className="w-6 h-6 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-300 flex items-center justify-center"
                      data-testid={`rb-remove-${l.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              <div className="grid grid-cols-[130px_1fr_90px_90px_100px_28px] gap-2 px-3 py-2.5 bg-white/[0.04] border-t border-white/10">
                <span className="text-[11px] font-semibold text-zinc-500 col-span-4">Total</span>
                <span className="text-right font-display text-lg font-semibold text-fuchsia-300 tabular">{fmtCurrency(total, { compact: false })}</span>
                <span />
              </div>
            </div>
          </div>

          {/* Cost per task */}
          <Field label="Cost per task (optional)">
            <div className="relative w-full max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <input
                type="number"
                value={costPerTask}
                onChange={(e) => setCostPerTask(e.target.value)}
                placeholder="12"
                data-testid="rb-cost-per-task"
                className="w-full h-9 pl-7 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
              />
            </div>
          </Field>

          {/* Phases (only if phase-wise) */}
          {delivery === "phase-wise" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
                  Phase-wise deliverables · <span className="text-fuchsia-300">{totalDeliverables} total</span>
                </div>
                <Button size="sm" variant="outline" onClick={addPhase} className="h-7 rounded-md border-white/10 bg-white/[0.03] text-zinc-300 text-xs" data-testid="rb-add-phase">
                  <Plus className="w-3 h-3 mr-1" />
                  Add phase
                </Button>
              </div>
              <div className="space-y-2">
                {phases.map((p) => (
                  <div key={p.id} className="grid grid-cols-[1fr_140px_28px] gap-2 items-center" data-testid={`rb-phase-${p.id}`}>
                    <input
                      value={p.name}
                      onChange={(e) => updatePhase(p.id, "name", e.target.value)}
                      className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={p.deliverables}
                        onChange={(e) => updatePhase(p.id, "deliverables", e.target.value)}
                        className="w-full h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 tabular focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                      />
                      <span className="text-[10px] text-zinc-500 whitespace-nowrap">deliverables</span>
                    </div>
                    <button onClick={() => removePhase(p.id)} className="w-7 h-7 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-300 flex items-center justify-center">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Field label="Justification">
            <textarea
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Why this budget? Business context, expected outcomes, risks…"
              data-testid="rb-justification"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
            />
          </Field>
        </div>

        <DialogFooter className="gap-2 border-t border-white/5 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            data-testid="rb-cancel"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Cancel
          </Button>
          <Button
            onClick={submit}
            data-testid="rb-submit"
            className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Submit · {fmtCurrency(total, { compact: false })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    {children}
  </div>
);

const SelectPills = ({ options, value, onChange, testidPrefix }) => (
  <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full">
    {options.map((o) => (
      <button
        key={o}
        onClick={() => onChange(o)}
        data-testid={`${testidPrefix}-${o.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors capitalize ${
          value === o ? "bg-fuchsia-500/15 text-fuchsia-300" : "text-zinc-400 hover:text-zinc-100"
        }`}
      >
        {o}
      </button>
    ))}
  </div>
);

export default RequestBudgetDialog;
