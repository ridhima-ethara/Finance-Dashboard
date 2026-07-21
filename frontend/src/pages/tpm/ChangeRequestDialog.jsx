import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { GitPullRequest, X, Send } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { toast } from "sonner";
import { fmtCurrency } from "../../lib/format";
import BudgetItemsFields from "../../components/budget/BudgetItemsFields";

const ChangeRequestDialog = ({ open, onOpenChange, projectId: lockedProjectId = "" }) => {
  const { visibleProjects, createChangeRequest } = useApp();

  const [project, setProject] = useState(lockedProjectId || visibleProjects[0]?.id || "");
  const [reason, setReason] = useState("");
  const [expectedTasks, setExpectedTasks] = useState("");
  const [timeline, setTimeline] = useState("");
  const [urgency, setUrgency] = useState("Normal");
  const [items, setItems] = useState({ breakdown: null, total: 0 });
  const wasOpenRef = useRef(false);

  const selectedProject = useMemo(
    () => visibleProjects.find((entry) => entry.id === project) || null,
    [project, visibleProjects]
  );
  const totalAsk = items.total;

  useEffect(() => {
    if (lockedProjectId) {
      setProject(lockedProjectId);
      return;
    }
    if (!visibleProjects.some((entry) => entry.id === project)) {
      setProject(visibleProjects[0]?.id || "");
    }
  }, [lockedProjectId, project, visibleProjects]);

  useEffect(() => {
    const openedNow = open && !wasOpenRef.current;
    if (openedNow) {
      setProject(lockedProjectId || visibleProjects[0]?.id || "");
      setReason("");
      setExpectedTasks("");
      setTimeline("");
      setUrgency("Normal");
    }
    wasOpenRef.current = open;
  }, [lockedProjectId, open, visibleProjects]);

  const submit = () => {
    if (!reason.trim()) return toast.error("Please explain the reason");
    if (!project) return toast.error("Select a project first");

    const projectName = visibleProjects.find((entry) => entry.id === project)?.name || "Project";
    createChangeRequest({
      projectId: project,
      reason,
      urgency,
      expectedTasks,
      timelineDelta: timeline,
      breakdown: items.breakdown,
    });
    toast.success("Additional request submitted", {
      description: `${projectName} · ${totalAsk > 0 ? fmtCurrency(totalAsk, { compact: false }) : "no $ ask"} · ${urgency} · routed to CTO`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[860px] max-h-[92vh] overflow-y-auto bg-[#12121A] border border-white/10 text-zinc-100" data-testid="cr-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center border border-amber-500/30">
              <GitPullRequest className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg text-white">Raise additional request</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Modify scope, timeline, or budget · provider-first models and infra · routed to CTO for review
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field label="Project">
            {lockedProjectId ? (
              <div className="w-full h-10 px-3 rounded-lg bg-white/[0.02] border border-white/10 text-sm text-zinc-100 flex items-center" data-testid="cr-project-locked">
                {(visibleProjects.find((entry) => entry.id === lockedProjectId)?.name || "Selected project")}
              </div>
            ) : (
              <select value={project} onChange={(event) => setProject(event.target.value)} data-testid="cr-project" className={selectCls}>
                {visibleProjects.length === 0 && <option value="">— No projects available —</option>}
                {visibleProjects.map((entry) => (
                  <option key={entry.id} value={entry.id} className="bg-[#12121A]">
                    {entry.name}{entry.client ? ` · ${entry.client}` : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">Budget-item asks (optional)</div>
            <BudgetItemsFields
              open={open}
              resetKey={project}
              selectedProject={selectedProject}
              accent="amber"
              onChange={setItems}
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Total additional ask</span>
              <span className="text-amber-300 font-semibold tabular" data-testid="cr-total">{fmtCurrency(totalAsk, { compact: false })}</span>
            </div>
          </div>

          <Field label="Urgency">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1 w-full">
              {["Low", "Normal", "High"].map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setUrgency(entry)}
                  data-testid={`cr-urgency-${entry.toLowerCase()}`}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-medium ${
                    urgency === entry ? "bg-amber-500/15 text-amber-300" : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {entry}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Expected tasks">
            <input
              value={expectedTasks}
              onChange={(event) => setExpectedTasks(event.target.value)}
              placeholder="e.g. 250 expected tasks after scope change"
              data-testid="cr-tasks"
              className={inputCls}
            />
          </Field>

          <Field label="Timeline change">
            <input
              value={timeline}
              onChange={(event) => setTimeline(event.target.value)}
              placeholder="e.g. Extend by 5 days"
              data-testid="cr-timeline"
              className={inputCls}
            />
          </Field>

          <Field label="Justification">
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain the change — why is it needed, what changes downstream?"
              data-testid="cr-reason"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-none"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]" data-testid="cr-cancel">
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button onClick={submit} className="bg-amber-500 hover:bg-amber-600 text-black" data-testid="cr-submit">
            <Send className="w-3.5 h-3.5 mr-1.5" /> Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const selectCls = "w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40";
const inputCls = "w-full h-9 px-3 rounded-md bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40";

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    {children}
  </div>
);

export default ChangeRequestDialog;
