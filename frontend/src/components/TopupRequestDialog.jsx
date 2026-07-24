import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { ArrowUpRightSquare, Info, Send, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { fmtCurrency } from "../lib/format";
import { normalizeBudgetType } from "../lib/projectMetrics";
import BudgetItemsFields from "./budget/BudgetItemsFields";

const TopupRequestDialog = ({ open, onOpenChange, project, defaultPhaseId }) => {
  const { createTopupRequest, visibleProjects, batchDeliveries, budgets } = useApp();
  const projectList = useMemo(() => (project ? [project] : visibleProjects), [project, visibleProjects]);

  const [projectId, setProjectId] = useState(project?.id || projectList[0]?.id || "");
  const [phaseId, setPhaseId] = useState(defaultPhaseId || "");
  const [sampleIteration, setSampleIteration] = useState(1);
  const [urgency, setUrgency] = useState("Normal");
  const [reason, setReason] = useState("");
  const [timeline, setTimeline] = useState("");
  const [items, setItems] = useState({ breakdown: null, total: 0 });
  const wasOpenRef = useRef(false);
  const lastProjectIdRef = useRef(project?.id || projectList[0]?.id || "");

  const activeProject = useMemo(
    () => projectList.find((entry) => entry.id === projectId) || project || null,
    [projectId, projectList, project]
  );
  const phases = useMemo(() => activeProject?.phases || [], [activeProject]);
  const isRndProject = activeProject?.type === "R&D";
  const sampleOptions = useMemo(() => {
    if (!isRndProject) return [];
    const maxSampleIteration = Math.max(
      1,
      ...batchDeliveries
        .filter((entry) => entry.projectId === activeProject?.id && entry.stage === "rnd-review")
        .map((entry) => Number(entry.sampleIteration || 1)),
      ...budgets
        .filter((entry) => entry.projectId === activeProject?.id)
        .map((entry) => Number(normalizeBudgetType(entry.budgetType) === "Rework" ? entry.sampleIteration || 2 : 1))
    );
    return Array.from({ length: Math.max(3, maxSampleIteration + 1) }, (_, index) => ({
      id: phases[0]?.id || "sample",
      name: `Sample ${index + 1}`,
      sampleIteration: index + 1,
    }));
  }, [activeProject?.id, batchDeliveries, budgets, isRndProject, phases]);
  const phaseOptions = useMemo(
    () => (isRndProject ? sampleOptions : phases),
    [isRndProject, phases, sampleOptions]
  );

  useEffect(() => {
    if (project?.id) {
      setProjectId(project.id);
      return;
    }
    if (!projectList.some((entry) => entry.id === projectId)) {
      setProjectId(projectList[0]?.id || "");
    }
  }, [project, projectId, projectList]);

  useEffect(() => {
    if (!phaseOptions.length) {
      setPhaseId("");
      setSampleIteration(1);
      return;
    }
    if (isRndProject) {
      if (!phaseOptions.some((option) => option.sampleIteration === sampleIteration)) {
        setSampleIteration(phaseOptions[0]?.sampleIteration || 1);
      }
      setPhaseId(phaseOptions[0]?.id || "");
      return;
    }
    const fallbackPhaseId = phaseOptions.some((option) => option.id === defaultPhaseId) ? defaultPhaseId : phaseOptions[0]?.id;
    if (!phaseOptions.some((option) => option.id === phaseId)) {
      setPhaseId(fallbackPhaseId || "");
    }
  }, [defaultPhaseId, isRndProject, phaseId, phaseOptions, sampleIteration]);

  useEffect(() => {
    const currentProjectId = activeProject?.id || "";
    const openedNow = open && !wasOpenRef.current;
    const projectChangedWhileOpen = open && wasOpenRef.current && lastProjectIdRef.current !== currentProjectId;

    if (openedNow || projectChangedWhileOpen) {
      setUrgency("Normal");
      setReason("");
      setTimeline("");
    }

    wasOpenRef.current = open;
    lastProjectIdRef.current = currentProjectId;
  }, [activeProject?.id, open]);

  const activePhase = isRndProject
    ? phaseOptions.find((option) => option.sampleIteration === sampleIteration) || phaseOptions[0] || null
    : phaseOptions.find((option) => option.id === phaseId) || phaseOptions[0] || null;

  const totalAmount = items.total;

  const submit = () => {
    if (!activeProject) {
      toast.error("Select a project");
      return;
    }
    if (phaseOptions.length > 0 && !activePhase) {
      toast.error(`Select a ${isRndProject ? "sample" : "phase"}`);
      return;
    }
    if (totalAmount <= 0) {
      toast.error("Enter at least one change line amount");
      return;
    }
    if (!reason.trim()) {
      toast.error("Justification is required");
      return;
    }

    createTopupRequest({
      projectId: activeProject.id,
      phaseId: activePhase?.id || "general",
      phaseName: isRndProject ? `Sample ${sampleIteration}` : activePhase?.name || "Project-wide",
      amount: totalAmount,
      baseAmount: totalAmount,
      bufferPct: 0,
      bufferAmount: 0,
      reason,
      urgency,
      timelineDelta: timeline,
      breakdown: items.breakdown,
      sampleIteration: isRndProject ? sampleIteration : null,
    });

    toast.success("Additional request submitted", {
      description: `${activeProject.name} · ${fmtCurrency(totalAmount, { compact: false })} · routed to CTO -> CFO`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[860px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="topup-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 flex items-center justify-center border border-fuchsia-500/30">
              <ArrowUpRightSquare className="w-4 h-4 text-fuchsia-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Raise additional request</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                One additional request for model, infrastructure, subscription, or budget updates · CTO reviews first, CFO gives final sign-off
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!project && (
            <Field label="Project">
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                data-testid="tur-project"
                className={selectCls}
              >
                {projectList.map((entry) => (
                  <option key={entry.id} value={entry.id} className="bg-[#12121A]">
                    {entry.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {phaseOptions.length > 0 && (
            isRndProject ? (
              <Field label="Sample">
                <select
                  value={sampleIteration}
                  onChange={(event) => setSampleIteration(Number(event.target.value) || 1)}
                  data-testid="tur-sample"
                  className={selectCls}
                >
                  {phaseOptions.map((entry) => (
                    <option key={entry.name} value={entry.sampleIteration} className="bg-[#12121A]">
                      {entry.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Phase">
                <select
                  value={phaseId}
                  onChange={(event) => setPhaseId(event.target.value)}
                  data-testid="tur-phase"
                  className={selectCls}
                >
                  {phaseOptions.map((entry) => (
                    <option key={entry.id} value={entry.id} className="bg-[#12121A]">
                      {entry.name}
                    </option>
                  ))}
                </select>
              </Field>
            )
          )}

          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Ask · change items</div>
            <BudgetItemsFields
              open={open}
              resetKey={activeProject?.id || ""}
              selectedProject={activeProject}
              accent="fuchsia"
              onChange={setItems}
            />
          </div>

          <div className="text-right space-y-1">
            <div className="text-[11px] text-zinc-500">Requested total</div>
            <div className="text-fuchsia-300 font-display text-2xl font-semibold tabular" data-testid="tur-total">
              {fmtCurrency(totalAmount, { compact: false })}
            </div>
          </div>

          <Field label="Urgency">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full">
              {["Low", "Normal", "High"].map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setUrgency(entry)}
                  data-testid={`tur-urgency-${entry.toLowerCase()}`}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${
                    urgency === entry
                      ? entry === "High"
                        ? "bg-red-500/15 text-red-300"
                        : "bg-fuchsia-500/15 text-fuchsia-300"
                      : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {entry}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Timeline change (optional)">
            <input
              value={timeline}
              onChange={(event) => setTimeline(event.target.value)}
              placeholder="e.g. Extend delivery by 5 days"
              data-testid="tur-timeline"
              className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            />
          </Field>

          <Field label="Justification">
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Why is the additional request needed? What deliverable does it unlock?"
              data-testid="tur-reason"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
            />
          </Field>

          <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-3 flex items-start gap-2">
            <Zap className="w-4 h-4 text-fuchsia-300 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-300 leading-relaxed">
              <span className="text-fuchsia-200 font-semibold">Flow: </span>
              CTO reviews the line-item request and may partially approve it. CFO sees the same model, infra, and subscription breakdown for final sign-off.
            </div>
          </div>

          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 flex items-start gap-2 text-[11px] text-zinc-500">
            <Info className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
            Partial approvals are supported at both stages. The final CFO amount is what gets added to the project baseline.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            data-testid="tur-cancel"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button
            onClick={submit}
            className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            data-testid="tur-submit"
          >
            <Send className="w-3.5 h-3.5" /> Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const selectCls = "w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40";

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    {children}
  </div>
);

export default TopupRequestDialog;
