import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fmtCurrency, fmtPct, fmtDate, healthColor } from "../lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "../components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  ArrowLeft, Lock, ArrowUpRightSquare, Users, Wallet, ListChecks, PackageCheck, ScrollText,
  Search, Plus, ChevronRight, User as UserIcon, Circle, CheckCircle2, Clock3, XCircle, Percent,
  Trash2, Pencil, FileText, Layers, MessageSquare, Shield, Mail, KeyRound, Eye, EyeOff, Copy,
  Archive,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { isTpmView } from "../lib/roles";
import { toast } from "sonner";
import { PROJECT_MEMBER_DIRECTORY, findProjectDirectoryMember, normalizeDirectoryRole } from "../data/employeeDirectory";
import { getPhaseTasks } from "../data/mockTpm";
import TopupRequestDialog from "../components/TopupRequestDialog";
import DeliverBatchDialog from "../components/DeliverBatchDialog";
import TpmTaskLogDialog from "../components/TpmTaskLogDialog";
import EditProjectDialog from "../components/EditProjectDialog";
import { DAILY_ACTIVITY } from "../data/mockAi";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart } from "recharts";
import { buildBudgetTracks, formatBudgetTypeLabel, normalizeBudgetType, summarizeLoggedProject } from "../lib/projectMetrics";
import { buildProjectBudgetBuilderHref } from "../lib/projectBudgetRoute";

// Deterministic seed of team members per project — uses project id hash for stability.
const seedTeam = (project) => {
  if (!project) return [];
  if (Array.isArray(project.teamMembers) && project.teamMembers.length) {
    return project.teamMembers.map((member, index) => ({
      id: member.id || `${project.id}-tm-${index + 1}`,
      name: member.name,
      role: member.role || (member.name === project.tpm ? "TPM" : "R&D"),
      email: member.email || `${member.name.toLowerCase().replace(/\s+/g, ".")}@ethara.ai`,
      status: member.status || (index === 0 ? "Online" : "Pending kickoff"),
      tasksDone: Number(member.tasksDone || 0),
    }));
  }
  const explicitMembers = (project.rndMembers || [])
    .map((name) => findProjectDirectoryMember({ name }) || { name, role: "R&D", email: `${name.toLowerCase().replace(/\s+/g, ".")}@ethara.ai` });
  const roster = [
    ...(project.tpm ? [{ name: project.tpm, role: "TPM", email: `${project.tpm.toLowerCase().replace(/\s+/g, ".")}@ethara.ai` }] : []),
    ...(project.pl ? [{ name: project.pl, role: "Project Lead", email: `${project.pl.toLowerCase().replace(/\s+/g, ".")}@ethara.ai` }] : []),
    ...explicitMembers,
  ];
  // Dedupe by name
  const seen = new Set();
  return roster
    .filter((m) => (seen.has(m.name) ? false : seen.add(m.name)))
    .map((m, i) => ({
      id: `${project.id}-tm-${i + 1}`,
      name: m.name,
      role: m.role,
      email: m.email,
      status: i === 0 ? "Online" : "Pending kickoff",
      tasksDone: 0,
    }));
};

const statusMap = {
  "pending-cto": { label: "Pending", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
  "pending-cfo": { label: "Pending", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: Clock3 },
  "forwarded-cfo": { label: "Pending", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: Clock3 },
  "testing-submitted": { label: "Testing submitted", cls: "bg-sky-500/10 text-sky-300 border-sky-500/25", Icon: PackageCheck },
  "feedback-pending": { label: "Awaiting client feedback", cls: "bg-sky-500/10 text-sky-300 border-sky-500/25", Icon: Clock3 },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  partial: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", Icon: Percent },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
  "rejected-by-cto": { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
  "returned-to-tpm": { label: "Returned", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: ChevronRight },
  recovered: { label: "Recovered · full", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  "partial-recovered": { label: "Recovered · partial", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", Icon: Percent },
  "non-recoverable": { label: "Non-recoverable", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", Icon: Lock },
  "changes-requested": { label: "Returned", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: ChevronRight },
  "sample-approved": { label: "Sample accepted", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  "sample-rejected": { label: "Sample rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
};

const ProjectDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    projects, role, topupRequests, batchDeliveries, budgets, budgetReviews, teamRemovals,
    removeProjectTeamMember, getPhaseLogs, isTaskEditable, deletePhaseTask, taskLogs, changeRequests,
    modelKeyRecords, itProvisioningRequests, provisionModelKeys,
    addProjectTeamMembers, updateProjectCoreMembers, archiveProject, deleteProject,
  } = useApp();
  const p = projects.find((x) => x.id === id);
  const isTPM = isTpmView(role);
  const isCFO = role === "CFO";
  const isCto = role === "CTO";
  const isIT = role === "IT";
  const isRnd = role === "R&D";
  const isRndProject = p?.type === "R&D";
  const isExecutionOwner = isTPM || isRnd;
  const canManageTeam = isExecutionOwner || isCto;

  const [topupOpen, setTopupOpen] = useState(false);
  const [topupPhaseId, setTopupPhaseId] = useState("");
  const [budgetBatchFilter, setBudgetBatchFilter] = useState("all"); // Budget tab · batch filter
  const [deliverPhase, setDeliverPhase] = useState(null); // {project, phase} or null
  const [feedbackDelivery, setFeedbackDelivery] = useState(null);
  const [taskLogPhase, setTaskLogPhase] = useState(null); // phase for log dialog
  const [editingLog, setEditingLog] = useState(null);
  const [teamSearch, setTeamSearch] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [revealedProjectKeys, setRevealedProjectKeys] = useState({});
  const [activeProvisionRequest, setActiveProvisionRequest] = useState(null);
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [memberNameQuery, setMemberNameQuery] = useState("");
  const [memberEmailQuery, setMemberEmailQuery] = useState("");
  const [memberDesignationFilter, setMemberDesignationFilter] = useState("All");
  const [selectedMemberEmails, setSelectedMemberEmails] = useState([]);
  const [coreDrawerOpen, setCoreDrawerOpen] = useState(false);
  const [coreTpmSelection, setCoreTpmSelection] = useState("");
  const [coreRndSelection, setCoreRndSelection] = useState("");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const team = useMemo(() => {
    const removedTeamIds = teamRemovals[p?.id] || [];
    return seedTeam(p).filter((member) => !removedTeamIds.includes(member.id));
  }, [p, teamRemovals]);
  const filteredTeam = team.filter((m) =>
    !teamSearch.trim() || m.name.toLowerCase().includes(teamSearch.toLowerCase()) || m.email.toLowerCase().includes(teamSearch.toLowerCase())
  );
  const availableTeamDirectory = useMemo(() => {
    const takenEmails = new Set(team.map((member) => String(member.email || "").trim().toLowerCase()).filter(Boolean));
    const takenNames = new Set(team.map((member) => String(member.name || "").trim().toLowerCase()).filter(Boolean));
    const seen = new Set();
    return PROJECT_MEMBER_DIRECTORY
      .map((member) => ({
        selectionId: String(member.email || member.name || member.id || "").trim().toLowerCase(),
        name: member.name,
        email: member.email,
        role: normalizeDirectoryRole(member.role),
        title: member.designation || member.title || "",
        department: member.department || "",
      }))
      .filter((member) => member.selectionId && String(member.email || "").trim().toLowerCase().endsWith("@ethara.ai"))
      .filter((member) => !["Finance", "COO", "IT", "CTO", "CFO"].includes(member.role))
      .filter((member) => !takenEmails.has(member.email.toLowerCase()) && !takenNames.has(member.name.toLowerCase()))
      .filter((member) => {
        if (seen.has(member.selectionId)) return false;
        seen.add(member.selectionId);
        return true;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [team]);
  const designationOptions = useMemo(
    () => ["All", ...Array.from(new Set(availableTeamDirectory.map((member) => member.role))).sort((left, right) => left.localeCompare(right))],
    [availableTeamDirectory]
  );
  const filteredDirectoryMembers = useMemo(() => (
    availableTeamDirectory.filter((member) => {
      const matchesName = !memberNameQuery.trim() || member.name.toLowerCase().includes(memberNameQuery.toLowerCase());
      const matchesEmail = !memberEmailQuery.trim() || member.email.toLowerCase().includes(memberEmailQuery.toLowerCase());
      const matchesDesignation = memberDesignationFilter === "All" || member.role === memberDesignationFilter;
      return matchesName && matchesEmail && matchesDesignation;
    })
  ), [availableTeamDirectory, memberNameQuery, memberEmailQuery, memberDesignationFilter]);
  const coreMemberDirectory = useMemo(() => {
    const seen = new Set();
    return [
      ...team,
      ...(p?.kickoffMail?.recipients || []),
      ...availableTeamDirectory,
      ...(p?.tpm ? [{ name: p.tpm, role: "TPM" }] : []),
      ...(p?.rnd ? [{ name: p.rnd, role: "R&D" }] : []),
      ...PROJECT_MEMBER_DIRECTORY,
    ]
      .map((member) => {
        const email = member.email || `${String(member.name || "").toLowerCase().replace(/\s+/g, ".")}@ethara.ai`;
        return {
          selectionId: normalizeMemberSelectionId(email || member.name || member.id),
          name: member.name,
          email,
          role: normalizeDirectoryRole(member.role),
          title: member.designation || member.title || "",
          department: member.department || "",
        };
      })
      .filter((member) => member.selectionId && member.name && member.email?.toLowerCase().endsWith("@ethara.ai"))
      .filter((member) => !["Finance", "COO", "IT", "CTO", "CFO"].includes(member.role))
      .filter((member) => {
        if (seen.has(member.selectionId)) return false;
        seen.add(member.selectionId);
        return true;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [availableTeamDirectory, p?.kickoffMail?.recipients, p?.rnd, p?.tpm, team]);
  const coreTpmOptions = useMemo(
    () => coreMemberDirectory.filter((member) => member.role === "TPM" || member.name === p?.tpm),
    [coreMemberDirectory, p?.tpm]
  );
  const coreRndOptions = useMemo(
    () => coreMemberDirectory.filter((member) => ["R&D", "Engineer"].includes(member.role) || member.name === p?.rnd),
    [coreMemberDirectory, p?.rnd]
  );

  // Aggregate all TPM logs across all phases for the Tasks tab
  const allLogs = useMemo(() => {
    if (!p) return [];
    return (p.phases || []).flatMap((ph) => getPhaseLogs(p.id, ph.id).map((l) => ({ ...l, phaseName: ph.name })));
  }, [p, getPhaseLogs]);

  // Top-ups + batch deliveries for this project (used in the Batch tab)
  const projectTopups = useMemo(() => topupRequests.filter((r) => r.projectId === id), [topupRequests, id]);
  const projectBatches = useMemo(() => batchDeliveries.filter((b) => b.projectId === id), [batchDeliveries, id]);
  const projectBudgetRequests = useMemo(
    () => buildProjectBudgetRequests({ projectId: id, submittedBudgets: budgets, liveBudgetReviews: budgetReviews, seedBudgetReviews: [] }),
    [id, budgets, budgetReviews]
  );
  const projectBudgetReviews = useMemo(
    () => budgetReviews
      .filter((review) => review.projectId === id)
      .sort((left, right) => getBudgetReviewTimestamp(right) - getBudgetReviewTimestamp(left)),
    [budgetReviews, id]
  );
  const budgetTracks = useMemo(() => buildBudgetTracks(p, budgets), [p, budgets]);
  const projectModelKeys = useMemo(
    () => modelKeyRecords
      .filter((entry) => entry.project === id)
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()),
    [modelKeyRecords, id]
  );
  const projectProvisioningRequests = useMemo(
    () => itProvisioningRequests
      .filter((request) => request.projectId === id)
      .sort((left, right) => new Date(right.approvedAt || 0).getTime() - new Date(left.approvedAt || 0).getTime()),
    [itProvisioningRequests, id]
  );
  const hasRndWorkflowTracks = useMemo(
    () => budgetTracks.entries.some((entry) => ["Testing", "RnD", "Rework"].includes(normalizeBudgetType(entry.budgetType))),
    [budgetTracks]
  );
  const projectUsage = useMemo(() => summarizeLoggedProject(p, taskLogs), [p, taskLogs]);
  const projectChangeRequests = useMemo(() => changeRequests.filter((request) => request.projectId === id), [changeRequests, id]);
  const selectedPhase = useMemo(
    () => (p?.phases || []).find((phase) => phase.id === selectedPhaseId) || null,
    [p, selectedPhaseId]
  );
  const selectedPhaseTopups = useMemo(
    () => (selectedPhase ? projectTopups.filter((request) => request.phaseId === selectedPhase.id) : []),
    [projectTopups, selectedPhase]
  );
  const selectedPhaseChanges = useMemo(
    () => (selectedPhase ? projectChangeRequests.filter((request) => matchesPhaseLabel(request.affectedPhase, selectedPhase)) : []),
    [projectChangeRequests, selectedPhase]
  );
  const selectedPhaseLogs = useMemo(
    () => (selectedPhase ? getPhaseLogs(p.id, selectedPhase.id) : []),
    [selectedPhase, getPhaseLogs, p]
  );
  const currentRndTrackKey = useMemo(() => {
    if (!isRndProject) return null;
    const currentStage = p?.workflowStage
      || (p?.pendingBudgetSubmission
        ? "budget-pending"
        : p?.type === "Production" && Number(p?.approvedBudget || 0) > 0
          ? "production-active"
          : Number(p?.approvedBudget || 0) > 0
            ? "sample-active"
            : "awaiting-testing-budget");
    if (["testing-budget-pending", "testing-active", "awaiting-rnd-budget"].includes(currentStage)) return "Testing";
    if (["awaiting-rework-budget", "rework-budget-pending"].includes(currentStage)) return "Rework";
    if (["rnd-budget-pending", "sample-active", "sample-rejected", "tpm-budget-ready"].includes(currentStage)) return "RnD";
    const lastBudgetType = normalizeBudgetType(p?.lastBudgetSubmission?.budgetType || "");
    if (["Testing", "RnD", "Rework"].includes(lastBudgetType)) return lastBudgetType;
    return budgetTracks.ordered.find((track) => ["Testing", "RnD", "Rework"].includes(track.key))?.key || null;
  }, [budgetTracks, isRndProject, p?.approvedBudget, p?.lastBudgetSubmission?.budgetType, p?.pendingBudgetSubmission, p?.type, p?.workflowStage]);
  const batchPhases = useMemo(() => {
    const phases = p?.phases || [];
    if (!isRndProject) return phases;
    const trackedPhaseIds = new Set(
      (((currentRndTrackKey ? budgetTracks.grouped?.[currentRndTrackKey]?.[0]?.phases : []) || []))
        .map((phase) => phase.id)
        .filter(Boolean)
    );
    if (!trackedPhaseIds.size) return phases.slice(0, 1);
    const filtered = phases.filter((phase) => trackedPhaseIds.has(phase.id));
    return filtered.length ? filtered : phases.slice(0, 1);
  }, [budgetTracks, currentRndTrackKey, isRndProject, p?.phases]);
  const visibleTaskLogs = useMemo(() => {
    if (!isRndProject) return allLogs;
    const visiblePhaseIds = new Set(batchPhases.map((phase) => phase.id));
    if (!visiblePhaseIds.size) return allLogs;
    return allLogs.filter((log) => visiblePhaseIds.has(log.phaseId));
  }, [allLogs, batchPhases, isRndProject]);
  const activeBatchPhaseId = useMemo(() => {
    const editable = batchPhases.find((phase) => {
      const delivery = projectBatches.find((entry) => entry.phaseId === phase.id);
      return !delivery || delivery.status === "changes-requested";
    });
    return editable?.id || null;
  }, [batchPhases, projectBatches]);
const latestBudgetReview = projectBudgetReviews[0] || null;
const latestBudgetReviewMeta = latestBudgetReview ? getBudgetReviewMeta(latestBudgetReview.status) : null;
const hasBudgetRejection = Boolean(p?.budgetRejection);
const budgetRetryAt = p?.budgetRetryAvailableAt || p?.budgetRejection?.retryAt || "";
const budgetRetryAtTs = budgetRetryAt ? new Date(budgetRetryAt).getTime() : 0;
const budgetRetryLockActive = hasBudgetRejection && Number.isFinite(budgetRetryAtTs) && budgetRetryAtTs > Date.now();
const workflowStage = p?.workflowStage
  || (p?.pendingBudgetSubmission
    ? "budget-pending"
    : p?.type === "Production" && Number(p?.approvedBudget || 0) > 0
      ? "production-active"
      : Number(p?.approvedBudget || 0) > 0
        ? "sample-active"
        : "awaiting-testing-budget");
const hasPendingBudgetSubmission = Boolean(p?.pendingBudgetSubmission);
const showRndBudgetTracks = hasRndWorkflowTracks || isRndProject || Boolean(p?.readyForTpmBudget);
const rndExecutionUnlocked = isRnd && !hasPendingBudgetSubmission && !hasBudgetRejection && ["testing-active", "sample-active"].includes(workflowStage);
const tpmExecutionUnlocked = isTPM && !hasPendingBudgetSubmission && !hasBudgetRejection && workflowStage === "production-active";
const executionUnlocked = rndExecutionUnlocked || tpmExecutionUnlocked;
const canManageExecution = isExecutionOwner && executionUnlocked;
  const taskLogTargetPhase = useMemo(
    () => batchPhases.find((phase) => phase.id === activeBatchPhaseId) || batchPhases[0] || null,
    [activeBatchPhaseId, batchPhases]
  );
  const isTaskLogDisabled = !canManageExecution || !activeBatchPhaseId;
  const approvalLockMessage = getWorkflowLockMessage({ project: p, workflowStage, latestBudgetReviewMeta, role });
  const taskLogDisabledReason = !activeBatchPhaseId && batchPhases.length
    ? "Tasks for this batch have already been submitted."
    : !canManageExecution
      ? approvalLockMessage
      : "";
  const requestedTab = searchParams.get("tab");
  const activeProjectTab = ["team", "models", "budget", "tasks", "batch", "logs"].includes(requestedTab)
    ? requestedTab
    : "team";
  const latestTestingDelivery = useMemo(
    () => projectBatches
      .filter((delivery) => normalizeBudgetType(delivery?.budgetType) === "Testing")
      .sort((left, right) => new Date(right.deliveredAt || right.createdAt || 0).getTime() - new Date(left.deliveredAt || left.createdAt || 0).getTime())[0] || null,
    [projectBatches]
  );
const returnedBudgetReview = latestBudgetReview?.status === "returned-to-tpm" ? latestBudgetReview : null;
const canOpenChangeRequest = isExecutionOwner && executionUnlocked && Number(p?.approvedBudget || 0) > 0;
const canShowBudgetBuilder = isRnd
  ? isExecutionOwner && !hasPendingBudgetSubmission
  : isExecutionOwner && !hasPendingBudgetSubmission && !canOpenChangeRequest;
const canOpenBudgetBuilder = canShowBudgetBuilder && !budgetRetryLockActive;
const projectBudgetBuilderHref = useMemo(() => {
    if (returnedBudgetReview?.id) {
      return buildProjectBudgetBuilderHref(p.id, { edit: returnedBudgetReview.id });
    }
    if (isRnd && workflowStage === "awaiting-rework-budget") {
      return buildProjectBudgetBuilderHref(p.id, { budgetType: "Rework" });
    }
    if (isRnd) {
      return buildProjectBudgetBuilderHref(p.id, {
        sourceDeliveryId: latestTestingDelivery?.id || undefined,
      });
    }
    return buildProjectBudgetBuilderHref(p.id);
  }, [isRnd, latestTestingDelivery?.id, p.id, returnedBudgetReview?.id, workflowStage]);
  const canRevealProjectKeys = isCFO || isIT;
  const projectAllocatedMembers = useMemo(
    () => new Set(projectModelKeys.flatMap((entry) => (entry.members || []).map((member) => member.id))).size,
    [projectModelKeys]
  );
  const projectGatewayTokens = useMemo(
    () => projectModelKeys.reduce((sum, entry) => sum + (entry.accessTokens?.length || 0), 0),
    [projectModelKeys]
  );
  const pendingProvisioningCount = useMemo(
    () => projectProvisioningRequests.filter((request) => request.status === "pending-it").length,
    [projectProvisioningRequests]
  );

  useEffect(() => {
    if (!activeProvisionRequest) return;
    const refreshed = projectProvisioningRequests.find((request) => request.id === activeProvisionRequest.id);
    if (!refreshed || refreshed.status !== "pending-it") {
      setActiveProvisionRequest(null);
    }
  }, [activeProvisionRequest, projectProvisioningRequests]);

  if (!p) {
    return (
      <div className="p-6" data-testid="project-not-found">
        Project not found.
        <Link className="ml-2 text-fuchsia-400" to="/projects">Back</Link>
      </div>
    );
  }

  const prjCode = `PRJ${String(Math.abs((p.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 100000).padStart(5, "0")}`;
  const startDate = p.phases?.[0]?.dates?.split(" ")[0] || p.status;
  const toggleProjectKeyReveal = (keyId) => {
    if (!canRevealProjectKeys) {
      toast.error("Access denied", { description: `Only CFO or IT can reveal keys. You are signed in as ${role}.` });
      return;
    }
    setRevealedProjectKeys((current) => ({ ...current, [keyId]: !current[keyId] }));
  };

  const copyProjectKey = (entry) => {
    if (!canRevealProjectKeys) {
      toast.error("Access denied");
      return;
    }
    navigator.clipboard?.writeText(entry.fullKey);
    toast.success("Key copied", { description: `${entry.provider} · ${entry.model}` });
  };

  const copyProjectAccessToken = (token) => {
    navigator.clipboard?.writeText(token.internalToken);
    toast.success("Platform token copied", { description: `${token.memberName} · ${token.allowedModelLabel}` });
  };
  const handleMemberDrawerChange = (open) => {
    setMemberDrawerOpen(open);
    if (!open) {
      setMemberNameQuery("");
      setMemberEmailQuery("");
      setMemberDesignationFilter("All");
      setSelectedMemberEmails([]);
    }
  };
  const toggleDirectoryMember = (selectionId) => {
    setSelectedMemberEmails((current) => (
      current.includes(selectionId)
        ? current.filter((entry) => entry !== selectionId)
        : [...current, selectionId]
    ));
  };
  const addSelectedMembersToProject = () => {
    if (!selectedMemberEmails.length) {
      toast.error("Select at least one member to add");
      return;
    }
    const members = availableTeamDirectory
      .filter((member) => selectedMemberEmails.includes(member.selectionId))
      .map((member) => ({ name: member.name, email: member.email, role: member.role }));
    addProjectTeamMembers(p.id, members, "Project Team");
    toast.success("Project members added", {
      description: `${members.length} member${members.length === 1 ? "" : "s"} added to ${p.name}`,
    });
    handleMemberDrawerChange(false);
  };
  const openCoreMembersDrawer = () => {
    setCoreTpmSelection(findMemberSelectionId(coreTpmOptions, p?.tpm));
    setCoreRndSelection(findMemberSelectionId(coreRndOptions, p?.rnd));
    setCoreDrawerOpen(true);
  };
  const saveCoreMembers = () => {
    const nextTpm = coreTpmOptions.find((member) => member.selectionId === coreTpmSelection);
    const nextRnd = coreRndOptions.find((member) => member.selectionId === coreRndSelection);
    updateProjectCoreMembers(p.id, {
      tpmName: nextTpm?.name || p.tpm,
      tpmEmail: nextTpm?.email || "",
      rndLeadName: nextRnd?.name || p.rnd,
      rndLeadEmail: nextRnd?.email || "",
    });
    toast.success("Core members updated", {
      description: `${p.name} now maps to ${nextTpm?.name || p.tpm || "Unassigned"} as TPM and ${nextRnd?.name || p.rnd || "Unassigned"} as R&D Lead.`,
    });
    setCoreDrawerOpen(false);
  };
  const handleArchiveProject = () => {
    archiveProject(p.id);
    setArchiveDialogOpen(false);
    toast.success("Project archived", { description: `${p.name} was removed from active dashboards.` });
    nav("/projects");
  };
  const handleDeleteProject = () => {
    deleteProject(p.id);
    setDeleteDialogOpen(false);
    toast.success("Project deleted", { description: `${p.name} was removed from the active workspace.` });
    nav("/projects");
  };
  const updateProjectSearchParams = (mutate) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    setSearchParams(next, { replace: true });
  };
  const handleProjectTabChange = (nextTab) => {
    updateProjectSearchParams((params) => {
      if (nextTab === "team") {
        params.delete("tab");
      } else {
        params.set("tab", nextTab);
      }
    });
  };

  return (
    <div className="space-y-6" data-testid={`page-project-${p.id}`}>
      {/* Header */}
      <div>
        <Link to="/projects" className="text-xs text-fuchsia-300 inline-flex items-center gap-1 hover:text-fuchsia-200" data-testid="breadcrumb-back">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Projects
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-semibold text-3xl tracking-tight text-white">{p.name}</h1>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${p.type === "R&D" ? "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"}`}>
                <Circle className="w-1.5 h-1.5 fill-current" /> {p.type === "R&D" ? "R&D" : "Production"}
              </span>
            </div>
            <div className="mt-1 text-xs text-zinc-500 tabular">
              {prjCode} · Started {startDate} · {team.length} team members{isCFO && p.client ? ` · Client ${p.client}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(isCto || isCFO || isTPM || isRnd) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditDetailsOpen(true)}
                data-testid="btn-edit-project-details"
                className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit details
              </Button>
            )}
            {isCto && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openCoreMembersDrawer}
                  data-testid="btn-edit-core-members"
                  className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit core members
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setArchiveDialogOpen(true)}
                  data-testid="btn-archive-project"
                  className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] gap-2"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archive
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(true)}
                  data-testid="btn-delete-project"
                  className="h-9 rounded-lg border-red-500/30 bg-red-500/[0.06] text-red-200 hover:bg-red-500/[0.12] gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </>
            )}
            {canShowBudgetBuilder && (
              <Button
                size="sm"
                disabled={!canOpenBudgetBuilder}
                title={!canOpenBudgetBuilder ? approvalLockMessage : ""}
                onClick={() => nav(projectBudgetBuilderHref)}
                className={`h-9 rounded-lg gap-2 ${
                  canOpenBudgetBuilder
                    ? "bg-fuchsia-500 hover:bg-fuchsia-600"
                    : "bg-white/[0.04] border border-white/10 text-zinc-500 hover:bg-white/[0.04]"
                }`}
                data-testid="btn-build-budget"
              >
                <ArrowUpRightSquare className="w-3.5 h-3.5" /> Build Budget
              </Button>
            )}

            {isCFO && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300" data-testid="cfo-readonly-badge">
                <Lock className="w-3 h-3" /> Finance view
              </span>
            )}
          </div>
        </div>
      </div>

      {hasBudgetRejection && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-100">
          {approvalLockMessage}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeProjectTab} onValueChange={handleProjectTabChange} className="w-full">
        <TabsList className="bg-transparent p-0 gap-4 border-b border-white/10 rounded-none h-auto w-full justify-start" data-testid="project-tabs">
          <TabTrigger value="team" icon={Users} label="Team" testid="tab-team" />
          <TabTrigger value="models" icon={KeyRound} label="Models" testid="tab-models" />
          <TabTrigger value="budget" icon={Wallet} label="Budget" testid="tab-budget" />
          <TabTrigger value="tasks" icon={ListChecks} label="Tasks" testid="tab-tasks" />
          <TabTrigger value="batch" icon={PackageCheck} label="Batch" testid="tab-batch" />
          <TabTrigger value="logs" icon={ScrollText} label="Logs" testid="tab-logs" />
        </TabsList>

        {/* ---- Team ---- */}
        <TabsContent value="team" className="mt-6">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 overflow-hidden" data-testid="team-panel">
            <div className="p-4 border-b border-white/5 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search team members…"
                  data-testid="team-search"
                  className="w-full h-10 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>
              {canManageTeam && (
                <Button
                  size="sm"
                  onClick={() => handleMemberDrawerChange(true)}
                  data-testid="btn-add-member"
                  className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                >
                  <Plus className="w-3.5 h-3.5" /> Add member
                </Button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                  <th className="text-left py-3 px-5">Name</th>
                  <th className="text-left py-3 px-2">Role</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-right py-3 px-5 w-14">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeam.length === 0 && (
                  <tr><td colSpan="4" className="py-6 text-center text-xs text-zinc-500">No team members match.</td></tr>
                )}
                {filteredTeam.map((m) => (
                  <tr key={m.id} data-testid={`team-row-${m.id}`} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/25 flex items-center justify-center text-[11px] font-semibold text-fuchsia-200">
                          {m.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </div>
                        <div>
                          <div className="text-white font-medium">{m.name}</div>
                          <div className="text-[11px] text-zinc-500">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-fuchsia-500/10 border border-fuchsia-500/25 text-fuchsia-200">{m.role}</span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.status === "Online" ? "text-emerald-300" : "text-amber-300"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${m.status === "Online" ? "bg-emerald-400" : "bg-amber-400"}`} />
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right text-zinc-500">
                      {canManageTeam ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-7 h-7 rounded-md hover:bg-white/[0.06] inline-flex items-center justify-center" title="Actions" data-testid={`team-actions-${m.id}`}>
                              <span className="inline-block w-1 h-1 rounded-full bg-current mx-0.5" />
                              <span className="inline-block w-1 h-1 rounded-full bg-current mx-0.5" />
                              <span className="inline-block w-1 h-1 rounded-full bg-current mx-0.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 border-white/10 bg-[#12121A] text-zinc-200">
                            <DropdownMenuItem
                              onClick={() => {
                                removeProjectTeamMember(p.id, m.id);
                                toast.success("Team member removed", { description: `${m.name} removed from ${p.name}` });
                              }}
                              className="focus:bg-red-500/10 focus:text-red-300"
                              data-testid={`team-remove-${m.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-300" />
                              Remove member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-[11px] text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 border-t border-white/5 text-[11px] text-zinc-500">
              Showing <span className="text-zinc-300 tabular">1-{filteredTeam.length}</span> of <span className="text-zinc-300 tabular">{team.length}</span> members
            </div>
          </div>
          <Sheet open={memberDrawerOpen} onOpenChange={handleMemberDrawerChange}>
            <SheetContent side="right" className="w-full sm:max-w-xl bg-[#12121A] border-white/10 text-zinc-100 p-0" data-testid="team-add-member-drawer">
              <SheetHeader className="px-6 py-5 border-b border-white/5">
                <SheetTitle className="font-display text-xl text-white">Add members to {p.name}</SheetTitle>
                <SheetDescription className="text-xs text-zinc-400">
                  Members are managed here after kickoff. Search by name, email, and designation, then select who should join this project.
                </SheetDescription>
              </SheetHeader>

              <div className="px-6 py-5 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Member name">
                    <input
                      value={memberNameQuery}
                      onChange={(e) => setMemberNameQuery(e.target.value)}
                      placeholder="Search by member name"
                      data-testid="team-drawer-name"
                      className={ipStyle}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      value={memberEmailQuery}
                      onChange={(e) => setMemberEmailQuery(e.target.value)}
                      placeholder="Search by email"
                      data-testid="team-drawer-email"
                      className={ipStyle}
                    />
                  </Field>
                  <Field label="Designation">
                    <select
                      value={memberDesignationFilter}
                      onChange={(e) => setMemberDesignationFilter(e.target.value)}
                      data-testid="team-drawer-designation"
                      className={ipStyle}
                    >
                      {designationOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-zinc-400">
                      {filteredDirectoryMembers.length} available member{filteredDirectoryMembers.length === 1 ? "" : "s"}
                    </div>
                    <div className="text-[11px] font-semibold text-fuchsia-300">
                      {selectedMemberEmails.length} selected
                    </div>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto">
                    {filteredDirectoryMembers.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-zinc-500">
                        No available members match these filters.
                      </div>
                    ) : (
                      filteredDirectoryMembers.map((member) => {
                        const isSelected = selectedMemberEmails.includes(member.selectionId);
                        return (
                          <button
                            key={member.selectionId}
                            type="button"
                            onClick={() => toggleDirectoryMember(member.selectionId)}
                            data-testid={`team-drawer-member-${member.selectionId.replace(/[^a-z0-9]+/g, "-")}`}
                            className={`w-full px-4 py-3 border-b border-white/5 last:border-b-0 text-left transition-colors ${
                              isSelected ? "bg-fuchsia-500/10" : "hover:bg-white/[0.03]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-white">{member.name}</div>
                                <div className="text-[11px] text-zinc-500 mt-1">{member.email}</div>
                                {(member.title || member.department) && (
                                  <div className="text-[10px] text-zinc-600 mt-1">
                                    {[member.title, member.department].filter(Boolean).join(" · ")}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300">
                                  {member.role}
                                </span>
                                <span className={`text-[10px] font-semibold ${isSelected ? "text-fuchsia-300" : "text-zinc-500"}`}>
                                  {isSelected ? "Selected" : "Select"}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <SheetFooter className="px-6 py-4 border-t border-white/5 bg-[#12121A]">
                <Button
                  variant="outline"
                  onClick={() => handleMemberDrawerChange(false)}
                  className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={addSelectedMembersToProject}
                  data-testid="team-drawer-submit"
                  className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white"
                >
                  Add selected members
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <Sheet open={coreDrawerOpen} onOpenChange={setCoreDrawerOpen}>
            <SheetContent side="right" className="w-full sm:max-w-lg bg-[#12121A] border-white/10 text-zinc-100 p-0" data-testid="project-core-members-drawer">
              <SheetHeader className="px-6 py-5 border-b border-white/5">
                <SheetTitle className="font-display text-xl text-white">Edit core members</SheetTitle>
                <SheetDescription className="text-xs text-zinc-400">
                  Update the project owner mapping without recreating the project. Team access and kickoff recipients stay aligned to the latest core members.
                </SheetDescription>
              </SheetHeader>
              <div className="px-6 py-5 space-y-4">
                <Field label="TPM">
                  <select
                    value={coreTpmSelection}
                    onChange={(e) => setCoreTpmSelection(e.target.value)}
                    data-testid="core-member-tpm"
                    className={ipStyle}
                  >
                    {coreTpmOptions.length === 0 && <option value="">No TPM members available</option>}
                    {coreTpmOptions.map((member) => (
                      <option key={member.selectionId} value={member.selectionId}>
                        {member.name} · {member.email}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="R&D Lead">
                  <select
                    value={coreRndSelection}
                    onChange={(e) => setCoreRndSelection(e.target.value)}
                    data-testid="core-member-rnd"
                    className={ipStyle}
                  >
                    {coreRndOptions.length === 0 && <option value="">No R&D members available</option>}
                    {coreRndOptions.map((member) => (
                      <option key={member.selectionId} value={member.selectionId}>
                        {member.name} · {member.email}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <SheetFooter className="px-6 py-4 border-t border-white/5 bg-[#12121A]">
                <Button
                  variant="outline"
                  onClick={() => setCoreDrawerOpen(false)}
                  className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveCoreMembers}
                  data-testid="core-member-save"
                  className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white"
                >
                  Save core members
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* ---- Models ---- */}
        <TabsContent value="models" className="mt-6 space-y-4" data-testid="models-panel">
          <div>
            <h2 className="font-display font-semibold text-xl text-white">Models &amp; keys</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Project-specific model access lives here. IT provisions the provider keys, and project members receive internal platform tokens that route through the gateway instead of seeing raw provider credentials.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ProjectKeyStat label="Allocated keys" value={String(projectModelKeys.length)} />
            <ProjectKeyStat label="Active keys" value={String(projectModelKeys.filter((entry) => entry.status === "active").length)} />
            <ProjectKeyStat label="Pending IT" value={String(pendingProvisioningCount)} />
            <ProjectKeyStat label="Gateway tokens" value={String(projectGatewayTokens || projectAllocatedMembers)} />
          </div>

          {projectProvisioningRequests.length > 0 && (
            <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="project-provisioning-panel">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div>
                  <div className="font-display font-semibold text-[15px] text-white">IT provisioning status</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    CFO-approved asks that need model access allocation are tracked here at project level.
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {projectProvisioningRequests.map((request) => {
                  const requestedModels = (request.requestedModels || []).map((line) => line.label).filter(Boolean);
                  const requestedMembers = (request.members || []).map((member) => `${member.name} · ${member.role}`);
                  const statusMeta = getProjectProvisioningStatusMeta(request.status);
                  return (
                    <div key={request.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-semibold text-white">{request.budgetType} model access</div>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${statusMeta.cls}`}>
                              <statusMeta.Icon className="w-3 h-3" />
                              {statusMeta.label}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-500">
                            Approved {fmtDate(request.approvedAt)} · {fmtCurrency(request.approvedAmount || 0, { compact: false })}
                          </div>
                        </div>
                        {isIT && request.status === "pending-it" && (
                          <Button
                            size="sm"
                            onClick={() => setActiveProvisionRequest(request)}
                            data-testid={`project-provision-${request.id}`}
                            className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs"
                          >
                            Provision now
                          </Button>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
                        <ProvisionList
                          title="Requested models"
                          items={requestedModels}
                          empty="No model lines were captured on this approval."
                        />
                        <ProvisionList
                          title="Allocated members"
                          items={requestedMembers}
                          empty="No members were mapped on this approval."
                        />
                      </div>
                      <div className="mt-3 text-[11px] text-zinc-500">
                        Gateway route: <span className="font-mono text-zinc-200">{request.gatewayRoute || "/api/gateway/execute"}</span>
                        {request.lines?.length ? ` · ${request.lines.reduce((sum, line) => sum + Number(line.issuedTokenCount || 0), 0)} token(s) issued` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-[#12121A] rounded-2xl border border-white/5 overflow-hidden" data-testid="project-model-keys-table">
            <div className="p-5 border-b border-white/5">
              <div className="font-display font-semibold text-[15px] text-white">Allocated model keys</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                CFO and IT can manage the provider keys here. Project teams receive internal platform tokens, gateway policy, and remaining-budget visibility.
              </div>
            </div>

            {projectModelKeys.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-zinc-500">
                No model keys have been provisioned for this project yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                      <th className="text-left py-3 px-5">Provider · Model</th>
                      <th className="text-left py-3 px-2">Type</th>
                      <th className="text-left py-3 px-2">Env</th>
                      <th className="text-left py-3 px-2">{canRevealProjectKeys ? "Provider key" : "Platform token"}</th>
                      <th className="text-left py-3 px-2">Allocated members</th>
                      <th className="text-left py-3 px-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectModelKeys.map((entry) => (
                      <tr
                        key={entry.id}
                        data-testid={`project-key-row-${entry.id}`}
                        className={`border-b border-white/5 last:border-0 hover:bg-white/[0.03] ${entry.status === "revoked" ? "opacity-50" : ""}`}
                      >
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: providerColor[entry.provider] || "#E619B8" }} />
                            <div>
                              <div className="text-sm text-zinc-100">{entry.provider}</div>
                              <div className="text-[11px] text-zinc-500">{entry.model}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeChip(entry.type)}`}>{entry.type}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${envChip(entry.env)}`}>{entry.env}</span>
                        </td>
                        <td className="py-3 px-2 font-mono text-xs text-zinc-300 tabular">
                          {canRevealProjectKeys ? (
                            <>
                              <div className="flex items-center gap-1">
                                <span data-testid={`project-key-value-${entry.id}`}>{revealedProjectKeys[entry.id] ? entry.fullKey : entry.maskedKey}</span>
                                <button
                                  data-testid={`project-btn-reveal-${entry.id}`}
                                  onClick={() => toggleProjectKeyReveal(entry.id)}
                                  className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-fuchsia-300"
                                >
                                  {revealedProjectKeys[entry.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  data-testid={`project-btn-copy-${entry.id}`}
                                  onClick={() => copyProjectKey(entry)}
                                  className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-fuchsia-300"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="mt-1 text-[10px] text-zinc-500">
                                {(entry.accessTokens || []).length} platform token{(entry.accessTokens || []).length === 1 ? "" : "s"} · {(entry.gatewayPolicy?.rateLimitPerMinute || 0)}/min
                              </div>
                              <div className="text-[10px] text-zinc-600">
                                {entry.gatewayRoute || "/api/gateway/execute"} · budget ${Number(entry.gatewayPolicy?.remainingBudget || 0).toLocaleString()}
                              </div>
                            </>
                          ) : (
                            <div className="space-y-2">
                              {(entry.accessTokens || []).map((token) => (
                                <div key={token.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <div className="text-[10px] text-zinc-500">{token.memberName}</div>
                                      <div className="mt-1 flex items-center gap-1">
                                        <span>{revealedProjectKeys[token.id] ? token.internalToken : token.maskedToken}</span>
                                        <button
                                          type="button"
                                          onClick={() => setRevealedProjectKeys((current) => ({ ...current, [token.id]: !current[token.id] }))}
                                          className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-fuchsia-300"
                                        >
                                          {revealedProjectKeys[token.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => copyProjectAccessToken(token)}
                                          className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-fuchsia-300"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="text-right text-[10px] text-zinc-500">
                                      <div>{token.remainingBudget.toFixed(0)} left</div>
                                      <div>{token.rateLimitPerMinute}/min</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {(entry.accessTokens || []).length === 0 && (
                                <span className="text-[10px] text-zinc-500">No platform token issued yet.</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex flex-wrap gap-1">
                            {(entry.members || []).length === 0 && <span className="text-[10px] text-zinc-500">No members mapped</span>}
                            {(entry.members || []).map((member) => (
                              <span key={member.id} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-zinc-400">
                                {member.name}
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 text-[10px] text-zinc-500">
                            {entry.gatewayRoute || "/api/gateway/execute"} · {formatGatewayList(entry.gatewayPolicy?.allowedNetworks)} · {formatGatewayList(entry.gatewayPolicy?.allowedDevices)}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-[11px] text-zinc-500 tabular">{fmtDate(entry.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!canRevealProjectKeys && projectModelKeys.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 flex items-start gap-3 text-xs text-amber-200">
              <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                Provider keys are hidden from project teams. Use the issued platform token to call the gateway, and only CFO or IT can reveal or copy the stored provider key.
              </div>
            </div>
          )}
        </TabsContent>

        {/* ---- Budget ---- */}
        <TabsContent value="budget" className="mt-6 space-y-4" data-testid="budget-panel">
          {(() => {
            const spent = Number(isCFO ? p.cfoActualSpend || p.actualSpend || 0 : projectUsage.loggedSpend || 0);
            const cap = Number(p.approvedBudget || 0);
            const remaining = Number(isCFO ? (cap - spent) : (projectUsage.remainingBudget || (cap - spent)));
            const utilPct = cap > 0 ? Math.round((spent / cap) * 100) : 0;
            const remainingPct = cap > 0 ? Math.round((remaining / cap) * 100) : 0;
            const budgetCount = showRndBudgetTracks ? Math.max(budgetTracks.entries.length, 1) : ((p.phases || []).length || 1);
            const burnRate = Number(isCFO ? (p.cfoBurnRate || p.burnRate || 0) : (projectUsage.runRate || 0));
            const runwayDays = burnRate > 0 && remaining > 0 ? Math.floor(remaining / burnRate) : 0;
            const spendLabel = isCFO ? "Actual / Cap" : "Logged / Cap";
            const totalSpendLabel = isCFO ? "Total Actual" : "Total Logged";
            const totalTopupAmount = projectTopups.reduce((sum, request) => sum + getResolvedTopupAmount(request), 0);
            const totalChangeAmount = projectChangeRequests.reduce((sum, request) => sum + Number(request.amount || 0), 0);
            // Every subscription asked for this project — from the approved base budget and from
            // additional (change / top-up) requests — so they all show with their correct cost.
            const subscriptionAsks = [
              ...budgetTracks.ordered.flatMap((track) => (track.latest?.items?.subs || []).map((sub) => ({
                id: sub.id || `${track.key}-${sub.optionId || sub.subscription}`,
                label: sub.optionLabel || sub.subscription || "Subscription",
                amount: Number(sub.amount ?? sub.estCost ?? 0),
                members: Array.isArray(sub.members) ? sub.members : [],
                seats: Number(sub.seats || 0),
                source: `${track.label} budget`,
              }))),
              ...projectChangeRequests.flatMap((request) => (request.breakdown?.subs?.entries || []).map((sub) => ({
                id: sub.id || `${request.id}-${sub.optionId}`,
                label: sub.optionLabel || sub.subscription || "Subscription",
                amount: Number(sub.amount || 0),
                members: Array.isArray(sub.members) ? sub.members : [],
                seats: Number(sub.seats || 0),
                source: "Additional request · approved",
              }))),
              ...projectTopups.flatMap((request) => (request.breakdown?.subs?.entries || []).map((sub) => ({
                id: sub.id || `${request.id}-${sub.optionId}`,
                label: sub.optionLabel || sub.subscription || "Subscription",
                amount: Number(sub.amount || 0),
                members: Array.isArray(sub.members) ? sub.members : [],
                seats: Number(sub.seats || 0),
                source: "Top-up request",
              }))),
            ];
            const subscriptionAsksTotal = subscriptionAsks.reduce((sum, sub) => sum + sub.amount, 0);
            const currentBudgetEnvelope = cap + totalTopupAmount + totalChangeAmount;
            // Subscriptions + infrastructure with their timelines (duration in days).
            const projectWindow = [p.startDate, p.estimatedEndDate].filter(Boolean).join(" → ");
            const buildResourceRows = (subs = [], infra = [], source) => ([
              ...(subs || []).map((sub) => ({
                id: sub.id || `sub-${sub.optionId || sub.subscription}-${source}`,
                type: "Subscription",
                label: sub.optionLabel || sub.subscription || "Subscription",
                amount: Number(sub.amount ?? sub.estCost ?? 0),
                days: Number(sub.days || 0),
                source,
              })),
              ...(infra || []).map((infra) => ({
                id: infra.id || `infra-${infra.optionId || infra.instance || infra.provider}-${source}`,
                type: "Infrastructure",
                label: infra.optionLabel || [infra.provider, infra.instance].filter(Boolean).join(" · ") || "Infrastructure",
                amount: Number(infra.amount ?? infra.estCost ?? 0),
                days: Number(infra.days || 0),
                source,
              })),
            ]);
            const resourceTimelines = [
              ...budgetTracks.ordered.flatMap((track) => buildResourceRows(track.latest?.items?.subs, track.latest?.items?.infra, `${track.label} budget · approved`)),
              ...projectChangeRequests.flatMap((request) => buildResourceRows(request.breakdown?.subs?.entries, request.breakdown?.infra?.entries, "Additional request · approved")),
              ...projectTopups.flatMap((request) => buildResourceRows(request.breakdown?.subs?.entries, request.breakdown?.infra?.entries, "Additional request")),
            ].filter((entry) => entry.amount > 0 || entry.label);
            const infrastructureTimelines = resourceTimelines.filter((entry) => entry.type === "Infrastructure");
            // Allocation ledger — initial budget + every top-up / additional request.
            const allocationLedger = [
              cap > 0 ? { id: "initial", action: "Budget", amount: cap, at: p.startDate ? `${p.startDate}T00:00:00.000Z` : null } : null,
              ...projectTopups.map((request) => ({ id: request.id, action: "Additional request", amount: getResolvedTopupAmount(request), at: request.requestedAt || request.createdAt || null })),
              ...projectChangeRequests.map((request) => ({ id: request.id, action: "Additional request", amount: Number(request.amount || 0), at: request.decidedAt || request.createdAt || request.requestedAt || null })),
            ].filter((entry) => entry && entry.amount > 0).sort((left, right) => new Date(right.at || 0).getTime() - new Date(left.at || 0).getTime());
            // Batches for this project + the filter state.
            const batchStatusLabelMap = { approved: "Approved", recovered: "Approved", "pending-cfo": "Pending", "pending-cto": "Pending", "feedback-pending": "Pending", "rnd-review": "Pending", "changes-requested": "Returned", rejected: "Rejected" };
            const budgetBatchStatuses = Array.from(new Set(projectBatches.map((batch) => batch.status).filter(Boolean)));
            const filteredBudgetBatches = projectBatches.filter((batch) => budgetBatchFilter === "all" || batch.status === budgetBatchFilter);
            const seriesByDate = projectUsage.logs.reduce((map, log) => {
              if (!log.date) return map;
              map.set(log.date, (map.get(log.date) || 0) + getTaskLogRecordedCost(log));
              return map;
            }, new Map());
            const burnSeries = Array.from(seriesByDate.entries())
              .sort((left, right) => new Date(left[0]).getTime() - new Date(right[0]).getTime())
              .slice(-15)
              .map(([date, total]) => ({ date: date.slice(5), total }));
            const fallbackScale = cap > 0 ? Math.min(1, cap / 250000) : 0.05;
            const fallbackSeries = DAILY_ACTIVITY.slice(-15).map((day) => ({
              date: day.date.slice(5),
              total: Math.round(day.spend * fallbackScale),
            }));
            const displaySeries = burnSeries.length ? burnSeries : fallbackSeries;
            // Cumulative available budget vs consumption over the same window.
            const consumptionSeries = (() => {
              let consumed = 0;
              return displaySeries.map((entry) => {
                consumed += Number(entry.total || 0);
                return {
                  date: entry.date,
                  Consumed: Math.round(consumed),
                  Available: Math.max(0, Math.round(currentBudgetEnvelope - consumed)),
                };
              });
            })();
            return (
              <>
                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-300">Financial overview</div>
                    <h2 className="mt-1 font-display font-semibold text-2xl text-white">Budget control center</h2>
                    <p className="text-xs text-zinc-500 mt-1">
                      {isCFO ? "Budget usage, approvals, and actuals for this project." : "Owned budget usage, logged spend, and delivery progress for this project."}
                    </p>
                  </div>
                </div>

                {cap > 0 && remainingPct <= 20 && (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3" data-testid="budget-low-balance-alert">
                    <div className="flex items-start gap-3">
                      <Wallet className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
                      <div>
                        <div className="text-xs font-semibold text-amber-200">Budget is running low</div>
                        <div className="mt-0.5 text-[11px] text-amber-200/60">Only {remainingPct}% remains at the current spend rate.</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular text-amber-200">{fmtCurrency(remaining, { compact: false })}</div>
                  </div>
                )}

                {/* Primary budget summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(4,minmax(0,1fr))] gap-3">
                  <div
                    className="relative overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/[0.18] via-violet-500/[0.07] to-transparent p-4 flex flex-col justify-between min-h-[132px] sm:col-span-2 lg:col-span-1"
                    data-testid="budget-kpi-spent-cap"
                  >
                    <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-200">{spendLabel}</span>
                        {cap === 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-semibold bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/30">No Budget</span>
                        )}
                      </div>
                      <div className="mt-3 flex items-baseline gap-2 whitespace-nowrap font-display font-semibold text-white text-3xl tabular leading-tight">
                        {fmtCurrency(spent, { compact: false })}
                        <span className="text-fuchsia-200/55 text-base">of {fmtCurrency(cap, { compact: false })}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div
                          className={`h-full transition-all ${utilPct >= 100 ? "bg-red-400" : utilPct >= 90 ? "bg-amber-400" : "bg-fuchsia-400"}`}
                          style={{ width: `${Math.min(utilPct, 100)}%` }}
                          data-testid="budget-kpi-spent-cap-bar"
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                        <span className="text-fuchsia-200/70">{cap === 0
                            ? "awaiting budget setup"
                            : `${utilPct}% consumed · ${remaining >= 0 ? `${fmtCurrency(remaining, { compact: false })} left` : `${fmtCurrency(Math.abs(remaining), { compact: false })} over cap`}`}</span>
                        {isCFO && <span className="whitespace-nowrap text-zinc-500">Total logged <span className="font-semibold tabular text-zinc-300">{fmtCurrency(projectUsage.loggedSpend || 0, { compact: false })}</span></span>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:contents">
                    <MiniKpi testid="budget-kpi-remaining" label="Remaining" value={fmtCurrency(remaining, { compact: false })} sub={`${remainingPct}% available`} accent={remaining >= 0 ? "text-emerald-300" : "text-red-300"} />
                    <MiniKpi testid="budget-kpi-runway" label="Runway" value={`${runwayDays} days`} sub={burnRate > 0 ? "at current burn" : "No active burn"} />
                    <MiniKpi testid="budget-kpi-burn-rate" label={isCFO ? "Daily burn" : "Daily log rate"} value={fmtCurrency(burnRate, { compact: false })} sub={cap > 0 ? `${Math.round((burnRate / cap) * 10000) / 100}% of cap/day` : "0% of cap"} />
                    <MiniKpi testid="budget-kpi-count" label="Batches delivered" value={String(projectBatches.length)} sub={`${budgetCount} budget record${budgetCount === 1 ? "" : "s"}`} />
                  </div>
                </div>

                {/* Model-wise spend cards */}
                {projectUsage.models && projectUsage.models.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="budget-model-cards">
                    {projectUsage.models.slice(0, 6).map((m, idx) => {
                      const modelsTotal = projectUsage.models.reduce((sum, entry) => sum + Number(entry.cost || 0), 0) || 1;
                      const pct = Math.round((Number(m.cost || 0) / modelsTotal) * 100);
                      const runs = Number(m.tasksDone || 0);
                      const avgPerRun = runs > 0 ? Number(m.cost || 0) / runs : 0;
                      const dot = ["bg-fuchsia-400", "bg-sky-400", "bg-violet-400", "bg-emerald-400", "bg-amber-400", "bg-cyan-400"][idx % 6];
                      return (
                        <div key={m.modelId || m.modelName || idx} className="bg-[#12121A] rounded-2xl border border-white/5 p-4" data-testid="budget-model-card">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full ${dot}`} />
                              <span className="text-sm text-white font-medium truncate">{m.modelName || "Model"}</span>
                            </div>
                            <span className="text-[10px] font-semibold text-zinc-400 bg-white/[0.04] border border-white/10 rounded-md px-1.5 py-0.5">{pct}%</span>
                          </div>
                          <div className="mt-3 font-display font-semibold text-2xl text-white tabular">{fmtCurrency(m.cost || 0, { compact: false })}</div>
                          <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500">
                            <div>
                              <div className="uppercase tracking-wide">API hits</div>
                              <div className="text-zinc-300 tabular mt-0.5">{runs.toLocaleString()}</div>
                            </div>
                            <div className="text-right">
                              <div className="uppercase tracking-wide">Avg $/task</div>
                              <div className="text-zinc-300 tabular mt-0.5">{fmtCurrency(avgPerRun, { compact: false })}</div>
                            </div>
                          </div>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                            <div className={`h-full rounded-full ${dot}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[9px] uppercase tracking-wider text-zinc-600">
                            <span>Model utilization</span><span>{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Budget Added & Consumption Over Time */}
                <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="budget-consumption-chart">
                  <div className="mb-3">
                    <div className="font-display font-semibold text-[15px] text-white">Budget Added &amp; Consumption Over Time</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Available budget vs cumulative consumption</div>
                  </div>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={consumptionSeries}>
                        <defs>
                          <linearGradient id={`avail-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id={`cons-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)} />
                        <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                        <Area type="monotone" dataKey="Available" name="Available" stroke="#8B5CF6" strokeWidth={2.5} fill={`url(#avail-${p.id})`} />
                        <Area type="monotone" dataKey="Consumed" name="Consumed" stroke="#10B981" strokeWidth={2.5} fill={`url(#cons-${p.id})`} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-[10px] text-zinc-400">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400" /> Available (Additional requests + initial)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Consumption</span>
                  </div>
                </div>

                {/* Daily Burn rate chart */}
                <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="daily-burn-rate-chart">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-display font-semibold text-[15px] text-white">{isCFO ? "Daily Burn rate" : "Daily logged spend"}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Last 15 days · per-project activity</div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                      <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
                      Total
                    </div>
                  </div>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={displaySeries}>
                        <defs>
                          <linearGradient id={`brn-${p.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#E619B8" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#E619B8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#1F1F2A" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#71717A" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`)} />
                        <Tooltip contentStyle={{ background: "#12121A", border: "1px solid #26262F", borderRadius: 12 }} formatter={(v) => fmtCurrency(v, { compact: false })} />
                        <Area type="monotone" dataKey="total" name="Total" stroke="#E619B8" strokeWidth={2.5} fill={`url(#brn-${p.id})`} dot={{ r: 3, fill: "#E619B8" }} activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                </div>

                {showRndBudgetTracks ? (
                  <>
                  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="rnd-budget-tracks">
                    <div className="mb-4">
                    <div><div className="font-display font-semibold text-[15px] text-white">Budget Track</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Testing, Sample, and Rework allocations with delivery progress and approved resources.</div></div>
                    </div>
                    {!executionUnlocked && isExecutionOwner && (
                      <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-200">
                        {approvalLockMessage}
                      </div>
                    )}
                    {budgetTracks.ordered.length === 0 ? (
                      <div className="text-xs text-zinc-500 py-6 text-center">No Testing, Sample, or Rework budget has been submitted yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {budgetTracks.ordered.map((track) => (
                          <BudgetTrackCard
                            key={track.key}
                            track={track}
                            deliveries={projectBatches}
                            logs={projectUsage.logs}
                            showActual={isCFO}
                            actualSpend={spent}
                            topups={projectTopups}
                            changes={projectChangeRequests}
                            topupCount={projectTopups.length}
                            changeCount={projectChangeRequests.length}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  </>
                ) : (
                  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="burn-per-phase-table">
                    <div className="mb-3">
                      <div className="font-display font-semibold text-[15px] text-white">Budget Track</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Phase budget, logged cost, completed tasks, additional requests, and approval details.
                      </div>
                    </div>
                    {(p.phases || []).length === 0 ? (
                      <div className="text-xs text-zinc-500 py-6 text-center">No phases defined yet.</div>
                    ) : (
                      <div className="flex flex-col overflow-x-auto">
                        <div className="order-0 grid min-w-[760px] grid-cols-[1.5fr_1fr_1fr_1.4fr_1fr_40px] border-b border-white/5 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
                          <div className="py-2 px-3">Batch</div>
                          <div className="py-2 px-3 text-right">Base budget</div>
                          <div className="py-2 px-3 text-right">Logged</div>
                          <div className="py-2 px-3">Task Done</div>
                          <div className="py-2 px-3 text-center">Additional requests</div>
                          <div />
                        </div>
                              {(p.phases || []).map((ph, phaseIndex) => {
                                const plannedTasks = Number(ph.totalTasks || ph.tasks || 0);
                                const phaseLogs = getPhaseLogs(p.id, ph.id);
                                const generalActualCost = phaseLogs.reduce(
                                  (sum, log) => sum + (String(log?.logType || "").trim() === "general-actual" ? getTaskLogRecordedCost(log) : 0),
                                  0
                                );
                                const burn = isCFO
                                  ? Number(ph.actual || 0) + generalActualCost
                                  : phaseLogs.reduce((sum, log) => sum + getTaskLogRecordedCost(log), 0);
                                const est = Number(ph.estimated || 0);
                                const apprPct = est > 0 ? Math.round((burn / est) * 100) : 0;
                                const isSelected = selectedPhase?.id === ph.id;
                                const phaseTopups = projectTopups.filter((request) => request.phaseId === ph.id);
                                const phaseChanges = projectChangeRequests.filter((request) => matchesPhaseLabel(request.affectedPhase, ph));
                                const phaseBudget = summarizePhaseBudget(ph, phaseTopups, phaseChanges);
                                const progress = plannedTasks > 0
                                  ? Math.min(100, Math.round((phaseLogs.reduce((sum, log) => sum + Number(log.tasksDone || 0), 0) / plannedTasks) * 100))
                                  : 0;
                                const completedTasks = phaseLogs.reduce((sum, log) => sum + Number(log.tasksDone || 0), 0);
                                return (
                                  <div
                                    key={ph.id}
                                    data-testid={`burn-phase-${ph.id}`}
                                    onClick={() => setSelectedPhaseId((current) => current === ph.id ? "" : ph.id)}
                                    style={{ order: phaseIndex * 2 + 1 }}
                                    className={`grid min-w-[760px] grid-cols-[1.5fr_1fr_1fr_1.4fr_1fr_40px] items-center border-b border-white/5 hover:bg-white/[0.03] cursor-pointer transition-colors ${isSelected ? "bg-fuchsia-500/[0.06]" : ""}`}
                                  >
                                    <div className="py-3 px-3 text-white font-medium">{ph.name}</div>
                                    <div className="py-3 px-3 text-right tabular text-zinc-200">{fmtCurrency(phaseBudget.base, { compact: false })}</div>
                                    <div className="py-3 px-3 text-right tabular text-white font-semibold">{fmtCurrency(burn, { compact: false })}</div>
                                    <div className="py-4 px-3">
                                      <div className="text-sm text-zinc-200 tabular">{plannedTasks > 0 ? `${completedTasks}/${plannedTasks} tasks · ${progress}%` : `${apprPct}% budget util`}</div>
                                      <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
                                        <div className={`h-full ${progress >= 100 ? "bg-emerald-500" : "bg-fuchsia-500"}`} style={{ width: `${plannedTasks > 0 ? progress : Math.min(apprPct, 100)}%` }} />
                                      </div>
                                    </div>
                                    <div className="py-3 px-3 text-center text-sm font-semibold tabular text-white">{phaseTopups.length + phaseChanges.length}</div>
                                    <div className="py-3 px-3 text-right text-zinc-500"><ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? "rotate-90 text-fuchsia-300" : ""}`} /></div>
                                  </div>
                                );
                              })}

                        {selectedPhase && (
                            <details open style={{ order: ((p.phases || []).findIndex((phase) => phase.id === selectedPhase.id) * 2) + 2 }} className="group min-w-[760px] border-b border-fuchsia-500/20 bg-fuchsia-500/[0.04] overflow-hidden" data-testid={`phase-detail-${selectedPhase.id}`}>
                            <summary className="hidden">{selectedPhase.name} details</summary>

                            <div className="p-4">
                            {(() => {
                              const phaseEntries = budgetTracks.entries.filter((entry) => (entry.phases || []).some((phase) => phase.id === selectedPhase.id));
                              const baseItems = phaseEntries.flatMap((entry) => [entry.items || {}]);
                              const requestBreakdowns = [...selectedPhaseTopups, ...selectedPhaseChanges].map((request) => request.breakdown || {});
                              const modelTotals = selectedPhaseLogs.flatMap((log) => log.modelUsage || []).reduce((map, model) => {
                                const key = model.modelId || model.modelName || "Model";
                                const current = map.get(key) || { id: key, label: model.modelName || model.modelLabel || "Model", amount: 0, detail: "Logged utilization" };
                                current.amount += Number(model.cost || 0);
                                map.set(key, current);
                                return map;
                              }, new Map());
                              baseItems.flatMap((items) => items.models || []).forEach((model) => {
                                const key = model.optionId || model.id || model.optionLabel;
                                if (!modelTotals.has(key)) modelTotals.set(key, { id: key, label: model.optionLabel || model.model || "Model", amount: Number(model.amount || model.estCost || 0), detail: "Approved allocation" });
                              });
                              const subscriptions = [
                                ...baseItems.flatMap((items) => items.subs || []),
                                ...requestBreakdowns.flatMap((breakdown) => breakdown.subs?.entries || []),
                              ].map((item, index) => ({ id: item.id || `sub-${index}`, label: item.optionLabel || item.subscription || "Subscription", amount: Number(item.amount || item.estCost || 0), detail: `${Number(item.seats || 0)} seat${Number(item.seats || 0) === 1 ? "" : "s"}`, members: item.members || [] }));
                              const infrastructure = [
                                ...baseItems.flatMap((items) => items.infra || []),
                                ...requestBreakdowns.flatMap((breakdown) => breakdown.infra?.entries || []),
                              ].map((item, index) => ({ id: item.id || `infra-${index}`, label: item.optionLabel || [item.provider, item.instance].filter(Boolean).join(" · ") || "Infrastructure", amount: Number(item.amount || item.estCost || 0), detail: item.days ? `${item.days} days` : "Approved allocation" }));
                              return <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
                                <RequestSummaryCard title={`Additional request (${selectedPhaseTopups.length + selectedPhaseChanges.length})`} icon={ArrowUpRightSquare} empty="No additional request mapped to this phase." testid={`phase-additional-requests-${selectedPhase.id}`}>
                                  {[...selectedPhaseTopups.map((request) => <TopupRequestCard key={request.id} request={request} />), ...selectedPhaseChanges.map((request) => <ChangeRequestCard key={request.id} request={request} />)]}
                                </RequestSummaryCard>
                                <PhaseResourceCard title="Models" icon={Layers} entries={Array.from(modelTotals.values())} empty="No models allocated to this phase." />
                                <PhaseResourceCard title="Subscriptions" icon={Wallet} entries={subscriptions} empty="No subscriptions allocated to this phase." />
                                <PhaseResourceCard title="Infrastructure" icon={Archive} entries={infrastructure} empty="No infrastructure allocated to this phase." />
                              </div>;
                            })()}
                          </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                {/* Batches with filter */}
                <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="budget-batches">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                    <div>
                      <div className="text-[15px] font-semibold text-white font-display">Batches</div>
                      <div className="text-xs text-zinc-500 mt-0.5">Delivered batches for this project</div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {["all", ...budgetBatchStatuses].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setBudgetBatchFilter(status)}
                          data-testid={`budget-batch-filter-${status}`}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${budgetBatchFilter === status ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"}`}
                        >
                          {status === "all" ? "All" : (batchStatusLabelMap[status] || status)} ({status === "all" ? projectBatches.length : projectBatches.filter((batch) => batch.status === status).length})
                        </button>
                      ))}
                    </div>
                  </div>
                  {filteredBudgetBatches.length === 0 ? (
                    <div className="text-center text-[11px] text-zinc-500 py-6">No batches match this filter.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/5">
                            <th className="text-left font-semibold py-2 pr-3">Batch</th>
                            <th className="text-left font-semibold py-2 px-3">Status</th>
                            <th className="text-left font-semibold py-2 px-3">Delivered</th>
                            <th className="text-right font-semibold py-2 pl-3">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBudgetBatches.map((batch) => (
                            <tr key={batch.id} className="border-b border-white/[0.04]">
                              <td className="py-2.5 pr-3 text-zinc-100">{batch.phaseName || batch.id}</td>
                              <td className="py-2.5 px-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300">{batchStatusLabelMap[batch.status] || batch.status || "—"}</span>
                              </td>
                              <td className="py-2.5 px-3 text-zinc-400 tabular">{batch.deliveredAt ? new Date(batch.deliveredAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                              <td className="py-2.5 pl-3 text-right text-zinc-100 tabular">{fmtCurrency(Number(batch.proposedAmount || batch.amount || 0), { compact: false })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Allocation Ledger */}
                {allocationLedger.length > 0 && (
                  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid="budget-allocation-ledger">
                    <div className="text-[15px] font-semibold text-white font-display mb-4">Allocation Ledger</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/5">
                            <th className="text-left font-semibold py-2 pr-3">Date</th>
                            <th className="text-left font-semibold py-2 px-3">Action</th>
                            <th className="text-right font-semibold py-2 pl-3">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allocationLedger.map((entry) => (
                            <tr key={entry.id} className="border-b border-white/[0.04]">
                              <td className="py-2.5 pr-3 text-zinc-400 tabular">{entry.at ? new Date(entry.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                              <td className="py-2.5 px-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${entry.action === "Budget" ? "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"}`}>{entry.action}</span>
                              </td>
                              <td className="py-2.5 pl-3 text-right text-emerald-300 tabular font-semibold">+{fmtCurrency(entry.amount, { compact: false })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                </div>
              </>
            );
          })()}
        </TabsContent>

        {/* ---- Tasks ---- */}
        <TabsContent value="tasks" className="mt-6" data-testid="tasks-panel">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div>
                <div className="font-display font-semibold text-[15px] text-white flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-fuchsia-300" /> Daily task log
                  <span className="text-xs text-zinc-500 font-normal">({visibleTaskLogs.length})</span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {isExecutionOwner
                    ? "Logged by the owning execution team · visible to CTO & CFO · editable within 24 hours"
                    : "Logged by the owning execution team · visible to CTO & CFO"}
                </div>
              </div>
              {isExecutionOwner && taskLogTargetPhase && (
                <Button
                  size="sm"
                  disabled={isTaskLogDisabled}
                  title={taskLogDisabledReason}
                  onClick={() => { setEditingLog(null); setTaskLogPhase(taskLogTargetPhase); }}
                  data-testid="btn-log-task"
                  className={`h-8 rounded-lg gap-1.5 ${
                    isTaskLogDisabled
                      ? "bg-white/[0.04] text-zinc-500 border border-white/10 shadow-none"
                      : "bg-fuchsia-500 hover:bg-fuchsia-600 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" /> Log task
                </Button>
              )}
            </div>
            {!executionUnlocked && isExecutionOwner && (
              <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-200">
                {approvalLockMessage}
              </div>
            )}

            {visibleTaskLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-xs text-zinc-500">
                {!executionUnlocked && isExecutionOwner
                  ? "No task logging yet. This project unlocks once the current budget is approved."
                  : isExecutionOwner
                    ? "No tasks logged yet. Use the Batch tab to log daily tasks per phase."
                    : "No execution logs for this project yet."}
              </div>
            ) : (
              <>
              {/* Phase-wise progress bars */}
              {batchPhases.some((ph) => Number(ph.totalTasks || ph.tasks || 0) > 0) && (
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-2" data-testid="phase-progress-grid">
                  {batchPhases.map((ph) => {
                    const planned = Number(ph.totalTasks || ph.tasks || 0);
                    if (planned <= 0) return null;
                    const logs = getPhaseLogs(p.id, ph.id);
                    const done = logs.reduce((s, l) => s + (Number(l.tasksDone) || 0), 0);
                    const pct = planned ? Math.min(100, Math.round((done / planned) * 100)) : 0;
                    return (
                      <div key={ph.id} data-testid={`phase-progress-${ph.id}`} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="text-white font-medium">{ph.name}</span>
                          <span className="text-zinc-500 tabular"><span className="text-white font-semibold">{done.toLocaleString()}</span> / {planned.toLocaleString()} · <span className="text-fuchsia-300 font-semibold">{pct}%</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                          <div className={`h-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-fuchsia-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5">
                      <th className="text-left py-2 px-3">Task</th>
                      <th className="text-left py-2 px-3">Phase</th>
                      <th className="text-left py-2 px-3">Assignee</th>
                      <th className="text-right py-2 px-3">Tasks</th>
                      <th className="text-right py-2 px-3">Trajectories</th>
                      <th className="text-right py-2 px-3">Est. cost</th>
                      <th className="text-left py-2 px-3">{isRndProject ? "Status" : "Approval status"}</th>
                      <th className="text-left py-2 px-3">Date</th>
                      {isTPM && <th className="text-right py-2 px-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTaskLogs.map((l) => {
                      const editable = isTaskEditable(l);
                      const delivery = projectBatches.find((batch) => batch.phaseId === l.phaseId) || null;
                      const approval = getTaskApprovalState(l, delivery);
                      return (
                        <tr key={l.id} data-testid={`task-row-${l.id}`} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                          <td className="py-3 px-3">
                            <div className="text-white font-medium">{l.name}</div>
                            {l.notes && <div className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{l.notes}</div>}
                          </td>
                          <td className="py-3 px-3 text-xs text-fuchsia-300">{l.phaseName}</td>
                          <td className="py-3 px-3 text-xs text-zinc-300">
                            <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3 text-zinc-500" /> {l.assignee}</span>
                          </td>
                          <td className="py-3 px-3 text-right tabular text-white font-semibold">{Number(l.tasksDone || 0).toLocaleString()}</td>
                          <td className="py-3 px-3 text-right tabular text-white font-semibold">{Number(l.trajectories || 0).toLocaleString()}</td>
                          <td className="py-3 px-3 text-right tabular text-white font-semibold">{fmtCurrency(l.cost, { compact: false })}</td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${approval.cls}`}>
                              <approval.Icon className="w-3 h-3" />
                              {approval.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-xs text-zinc-400 tabular">{l.date}</td>
                          {isTPM && (
                            <td className="py-3 px-3 text-right">
                              {editable ? (
                                <div className="inline-flex items-center gap-0.5 justify-end">
                                  <button
                                    onClick={() => { setEditingLog(l); setTaskLogPhase(p.phases.find((ph) => ph.id === l.phaseId)); }}
                                    data-testid={`task-edit-${l.id}`}
                                    className="w-7 h-7 rounded-md hover:bg-fuchsia-500/15 text-zinc-500 hover:text-fuchsia-300 flex items-center justify-center"
                                    title="Edit (within 24h)"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!isTaskEditable(l)) { toast.error("Task log is locked (>24h)"); return; }
                                      deletePhaseTask(p.id, l.phaseId, l.id);
                                      toast.success("Task log deleted");
                                    }}
                                    data-testid={`task-delete-${l.id}`}
                                    className="w-7 h-7 rounded-md hover:bg-red-500/15 text-zinc-500 hover:text-red-300 flex items-center justify-center"
                                    title="Delete (within 24h)"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-zinc-600 inline-flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> locked</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ---- Batch ---- */}
        <TabsContent value="batch" className="mt-6" data-testid="batch-panel">
          <div className="space-y-3">
            {batchPhases.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <MiniKpi
                  label="Delivered phases"
                  value={String(batchPhases.filter((phase) => {
                    const delivery = projectBatches.find((entry) => entry.phaseId === phase.id);
                    return !!delivery && delivery.status !== "changes-requested";
                  }).length)}
                  sub={`${batchPhases.length} total`}
                />
                <MiniKpi
                  label="Recoverable total"
                  value={fmtCurrency(batchPhases.reduce((sum, phase) => {
                    const entry = projectBatches.find((delivery) => delivery.phaseId === phase.id);
                    return sum + (entry?.stage === "cfo-recovery" && entry.isRecoverable !== false ? Number(entry.proposedAmount || 0) : 0);
                  }, 0), { compact: false })}
                  sub="Consolidated across submitted phases"
                  accent="text-fuchsia-300"
                />
                <MiniKpi
                  label="Non-recoverable"
                  value={String(batchPhases.filter((phase) => {
                    const entry = projectBatches.find((delivery) => delivery.phaseId === phase.id);
                    return entry?.stage === "cfo-recovery" && entry.isRecoverable === false;
                  }).length)}
                  sub="Closed deliveries"
                />
                <MiniKpi
                  label="Active batch"
                  value={batchPhases.find((phase) => phase.id === activeBatchPhaseId)?.name || "All submitted"}
                  sub={activeBatchPhaseId ? "Only this batch can be edited now" : "No editable batch pending"}
                />
              </div>
            )}

            {batchPhases.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-xs text-zinc-500">
                {!executionUnlocked && isExecutionOwner
                  ? approvalLockMessage
                  : "No phases defined yet. Use Budget Builder to add phases."}
              </div>
            )}
            {!executionUnlocked && isExecutionOwner && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 text-[11px] text-amber-200">
                {approvalLockMessage}
              </div>
            )}
            {batchPhases.map((ph) => {
              const deliveriesForPhase = projectBatches.filter((batch) => batch.phaseId === ph.id);
              const delivery = deliveriesForPhase[0] || null;
              const isRevisableDelivery = delivery?.status === "changes-requested";
              const isSubmitted = !!delivery && !isRevisableDelivery;
              const isActivePhase = activeBatchPhaseId ? activeBatchPhaseId === ph.id : (!delivery || isRevisableDelivery);
              const isLockedPhase = !isSubmitted && !isActivePhase && role !== "R&D";
              const lockedByApproval = !executionUnlocked;
              const changesForPhase = projectChangeRequests.filter((request) => matchesPhaseLabel(request.affectedPhase, ph));
              const logs = getPhaseLogs(p.id, ph.id);
              const loggedCost = logs.reduce((sum, log) => sum + getTaskLogRecordedCost(log), 0);
              const generalActualCost = logs.reduce(
                (sum, log) => sum + (String(log?.logType || "").trim() === "general-actual" ? getTaskLogRecordedCost(log) : 0),
                0
              );
              const phaseSpend = isCFO ? Number(ph.actual || 0) + generalActualCost : loggedCost;
              const variance = Number(ph.estimated || 0) - phaseSpend;
              const util = ph.estimated ? Math.round((phaseSpend / ph.estimated) * 100) : 0;
              const hc = healthColor(ph.health);
              const loggedTasks = logs.reduce((sum, log) => sum + (Number(log.successfulTasks ?? log.tasksDone) || 0), 0);
              const loggedTrajectories = logs.reduce((sum, log) => sum + (Number(log.successTrajectories ?? log.trajectories) || 0), 0);
              const plannedTasks = Number(ph.totalTasks || ph.tasks || 0);
              const costPerTask = loggedTasks > 0 ? Math.round((phaseSpend / loggedTasks) * 100) / 100 : null;
              const modelNames = collectResourceNames([
                ...logs.flatMap((log) => getLogModelNames(log)),
              ]);
              const approvalMeta = delivery ? (statusMap[delivery.status] || statusMap["pending-cfo"]) : null;
              const phaseRecoverableTotal = delivery?.isRecoverable === false ? 0 : Number(delivery?.proposedAmount || 0);
              return (
                <div
                  key={ph.id}
                  data-testid={`batch-phase-${ph.id}`}
                  className={`rounded-2xl border p-5 transition-colors ${
                    isSubmitted
                      ? "bg-[#12121A] border-white/5 opacity-65"
                      : isLockedPhase
                        ? "bg-[#12121A] border-white/5 opacity-55"
                        : "bg-[#12121A] border-white/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/25">
                          <Layers className="w-3 h-3" /> {ph.name}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${hc.text} ${hc.bg} ${hc.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${hc.dot}`} /> {hc.label}
                        </span>
                        {delivery && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${(statusMap[delivery.status] || statusMap["pending-cfo"]).cls}`}>
                            <PackageCheck className="w-3 h-3" /> {(statusMap[delivery.status] || statusMap["pending-cfo"]).label}
                          </span>
                        )}
                        {delivery?.stage === "rnd-review" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-sky-500/20 bg-sky-500/10 text-sky-200">
                            <PackageCheck className="w-3 h-3" /> {getRndDeliveryCycleLabel(delivery)}
                          </span>
                        )}
                        {isLockedPhase && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-white/10 bg-white/[0.03] text-zinc-400">
                            <Lock className="w-3 h-3" /> Locked until previous batch is submitted
                          </span>
                        )}
                        {lockedByApproval && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-300">
                            <Clock3 className="w-3 h-3" /> Waiting for approved budget
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-zinc-500 tabular">{ph.dates}</div>
                      {isActivePhase && !isSubmitted && !isLockedPhase && (
                        <div className="mt-2 text-[11px] text-fuchsia-300">Current editable batch</div>
                      )}
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
                        <PhaseMetric label="Estimated" value={fmtCurrency(ph.estimated, { compact: false })} />
                        <PhaseMetric label={isCFO ? "Actual" : "Logged"} value={fmtCurrency(phaseSpend, { compact: false })} tone="magenta" />
                        <PhaseMetric label="Variance" value={`${variance > 0 ? "+" : ""}${fmtCurrency(variance, { compact: false })}`} tone={variance >= 0 ? "emerald" : "red"} />
                        <PhaseMetric label="Utilization" value={fmtPct(util)} tone={util >= 90 ? "warning" : "emerald"} />
                        <PhaseMetric label="Tasks" value={`${loggedTasks || 0}/${plannedTasks || 0}`} />
                        <PhaseMetric label="Trajectories" value={loggedTrajectories.toLocaleString()} />
                        <PhaseMetric label="Cost / task" value={costPerTask != null ? fmtCurrency(costPerTask, { compact: false }) : "—"} />
                        <PhaseMetric label="Recoverable" value={delivery ? (delivery.isRecoverable === false ? "No" : fmtCurrency(phaseRecoverableTotal, { compact: false })) : "—"} tone={delivery?.isRecoverable === false ? "warning" : "emerald"} />
                      </div>
                    </div>
                    {canManageExecution && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => { setEditingLog(null); setTaskLogPhase(ph); }}
                          disabled={lockedByApproval || isLockedPhase || isSubmitted}
                          data-testid={`btn-log-task-${ph.id}`}
                          className="h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-200 text-xs gap-1"
                        >
                          <Plus className="w-3 h-3" /> Log task
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => { setTopupPhaseId(ph.id); setTopupOpen(true); }}
                          disabled={lockedByApproval || isLockedPhase || isSubmitted}
                          data-testid={`btn-topup-${ph.id}`}
                          className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1"
                        >
                          <ArrowUpRightSquare className="w-3 h-3" /> Additional request
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setDeliverPhase(ph)}
                          disabled={lockedByApproval || isLockedPhase || (!!delivery && delivery.status !== "changes-requested")}
                          data-testid={`btn-deliver-${ph.id}`}
                          className="h-8 rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/25 disabled:text-emerald-200 text-white text-xs gap-1"
                        >
                          <PackageCheck className="w-3 h-3" /> {delivery?.status === "changes-requested" ? "Deliver revised sample" : isSubmitted ? "Delivered" : getDeliverButtonLabel(isRndProject, delivery, p)}
                        </Button>
                        {delivery?.status === "feedback-pending" && role === "R&D" && (
                          <Button
                            size="sm"
                            onClick={() => setFeedbackDelivery({ phase: ph, delivery })}
                            data-testid={`btn-batch-feedback-${ph.id}`}
                            className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1"
                          >
                            <MessageSquare className="w-3 h-3" /> Add client feedback
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <ResourceSummaryCard
                      title="Models"
                      value={fmtCurrency(loggedCost, { compact: false })}
                      detail={modelNames.length ? modelNames.join(", ") : "No model cost logged yet."}
                      testid={`batch-models-${ph.id}`}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <RequestSummaryCard
                      title={`Changes (${changesForPhase.length})`}
                      icon={Shield}
                      empty="No additional requests raised for this phase."
                      testid={`sub-changes-${ph.id}`}
                    >
                      {changesForPhase.map((request) => (
                        <ChangeRequestCard key={request.id} request={request} />
                      ))}
                    </RequestSummaryCard>

                    <RequestSummaryCard
                      title="Delivery"
                      icon={PackageCheck}
                      empty="Not delivered yet."
                      testid={`sub-delivery-${ph.id}`}
                    >
                      {delivery && (
                        <div className={`p-2.5 rounded-lg border space-y-2 ${
                          delivery.stage === "rnd-review"
                            ? "bg-white/[0.02] border-white/10"
                            : "bg-emerald-500/[0.05] border-emerald-500/20"
                        }`}>
                          {approvalMeta && (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${approvalMeta.cls}`}>
                              <approvalMeta.Icon className="w-2.5 h-2.5" />
                              {approvalMeta.label}
                            </span>
                          )}
                          {delivery.stage === "rnd-review" && (
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Submitted cycle</span>
                              <span className="text-[11px] text-white font-semibold tabular">{getRndDeliveryCycleLabel(delivery)}</span>
                            </div>
                          )}
                          {delivery.stage === "cfo-recovery" && (
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Recovery type</span>
                              <span className={`text-[11px] font-semibold ${delivery.isRecoverable === false ? "text-zinc-300" : "text-emerald-300"}`}>
                                {delivery.isRecoverable === false ? "Non-recoverable" : "Recoverable"}
                              </span>
                            </div>
                          )}
                          {delivery.isRecoverable !== false && (
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Proposed</span>
                              <span className="text-[11px] text-white font-semibold tabular">{fmtCurrency(delivery.proposedAmount, { compact: false })}</span>
                            </div>
                          )}
                          {delivery.stage === "cfo-recovery" && delivery.isRecoverable !== false ? (
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Recovered</span>
                              <span className={`text-[11px] font-semibold tabular ${delivery.actualRecovered != null ? "text-emerald-300" : "text-zinc-500"}`}>
                                {delivery.actualRecovered != null ? fmtCurrency(delivery.actualRecovered, { compact: false }) : "Awaiting CFO"}
                              </span>
                            </div>
                          ) : delivery.stage === "cfo-recovery" ? (
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Recovery status</span>
                              <span className="text-[11px] font-semibold text-zinc-300">Closed on delivery</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Outcome</span>
                              <span className={`text-[11px] font-semibold ${
                                delivery.status === "sample-approved"
                                  ? "text-emerald-300"
                                  : delivery.status === "testing-submitted"
                                    ? "text-sky-300"
                                    : delivery.status === "sample-rejected"
                                    ? "text-red-300"
                                    : "text-amber-300"
                              }`}>
                                {delivery.status === "testing-submitted"
                                  ? "Testing submitted · raise the Sample budget"
                                  : delivery.status === "sample-approved"
                                    ? "Accepted and handed to TPM"
                                    : delivery.status === "sample-rejected"
                                      ? "Rejected"
                                      : "Budget revision needed"}
                              </span>
                            </div>
                          )}
                          {delivery.rnd?.models && (
                            <div className="text-[10px] text-zinc-300 leading-relaxed pt-1 border-t border-white/5">
                              <span className="text-zinc-500">Models: </span>{delivery.rnd.models}
                            </div>
                          )}
                          {delivery.clientComment && (
                            <div className="text-[10px] text-zinc-300 leading-relaxed pt-1 border-t border-white/5">
                              <span className="text-emerald-200 font-semibold">{delivery.stage === "rnd-review" ? "Notes: " : "Client: "}</span>{delivery.clientComment}
                            </div>
                          )}
                          {delivery.stage === "rnd-review" && delivery.status === "changes-requested" && (
                            <Link
                              to={buildProjectBudgetBuilderHref(p.id, {
                                budgetType: "Rework",
                                phaseId: ph.id,
                                sampleIteration: Number(delivery.sampleIteration || 1) + 1,
                                sourceDeliveryId: delivery.id,
                              })}
                              className="inline-flex items-center gap-1 text-[11px] text-fuchsia-300 hover:text-fuchsia-200 font-medium pt-1"
                            >
                              Raise rework budget <ChevronRight className="w-3 h-3" />
                            </Link>
                          )}
                          {deliveriesForPhase.length > 1 && (
                            <div className="pt-2 border-t border-white/5 space-y-1">
                              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Earlier logs</div>
                              {deliveriesForPhase.slice(1).map((entry) => {
                                const entryMeta = statusMap[entry.status] || statusMap["pending-cfo"];
                                return (
                                  <div key={entry.id} className="flex items-center justify-between gap-2 text-[10px] text-zinc-400">
                                    <span className="truncate">
                                      {entry.stage === "rnd-review" ? getRndDeliveryCycleLabel(entry) : "Batch delivery"} · {fmtDate(entry.deliveredAt)}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${entryMeta.cls}`}>
                                      <entryMeta.Icon className="w-2.5 h-2.5" />
                                      {entryMeta.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </RequestSummaryCard>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden" data-testid={`batch-task-detail-${ph.id}`}>
                    <div className="px-4 py-3 border-b border-white/5">
                      <div className="font-display font-semibold text-[15px] text-white">Logged tasks for this phase</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Detailed view of task counts, trajectories, costs, and approval outcome.
                      </div>
                    </div>
                    {logs.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-500">No tasks logged for this phase yet.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                              <th className="text-left py-2.5 px-3">Task</th>
                              <th className="text-left py-2.5 px-3">Assignee</th>
                              <th className="text-right py-2.5 px-3">Tasks</th>
                              <th className="text-right py-2.5 px-3">Trajectories</th>
                              <th className="text-right py-2.5 px-3">Cost / task</th>
                              <th className="text-right py-2.5 px-3">Cost</th>
                              <th className="text-left py-2.5 px-3">Approval</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logs.map((log) => {
                              const approval = getTaskApprovalState(log, delivery);
                              const logCost = getTaskLogRecordedCost(log);
                              const logCostPerTask = Number(log.tasksDone) > 0 ? logCost / Number(log.tasksDone) : 0;
                              return (
                                <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                                  <td className="py-3 px-3">
                                    <div className="text-white font-medium">{log.name}</div>
                                    {log.notes && <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{log.notes}</div>}
                                  </td>
                                  <td className="py-3 px-3 text-xs text-zinc-300">{log.assignee}</td>
                                  <td className="py-3 px-3 text-right tabular text-white font-semibold">{Number(log.tasksDone || 0).toLocaleString()}</td>
                                  <td className="py-3 px-3 text-right tabular text-white font-semibold">{Number(log.trajectories || 0).toLocaleString()}</td>
                                  <td className="py-3 px-3 text-right tabular text-white font-semibold">{Number(log.tasksDone) > 0 ? fmtCurrency(logCostPerTask, { compact: false }) : "—"}</td>
                                  <td className="py-3 px-3 text-right tabular text-white font-semibold">{fmtCurrency(logCost, { compact: false })}</td>
                                  <td className="py-3 px-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${approval.cls}`}>
                                      <approval.Icon className="w-3 h-3" />
                                      {approval.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ---- Logs ---- */}
        <TabsContent value="logs" className="mt-6" data-testid="logs-panel">
          <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ScrollText className="w-4 h-4 text-fuchsia-300" />
              <div className="font-display font-semibold text-[15px] text-white">Activity &amp; audit log</div>
            </div>
            <div className="space-y-3">
              {(p.auditLog || []).length === 0 && (
                <div className="text-xs text-zinc-500 text-center py-6">No activity yet.</div>
              )}
              {(p.auditLog || []).map((a) => (
                <div key={a.id} data-testid={`audit-${a.id}`} className="flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                  <div className="w-7 h-7 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/25 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-fuchsia-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-white font-semibold">{a.action}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-300">{a.actor}</span>
                      <span className="text-zinc-500 tabular ml-auto">{fmtDate(a.ts)}</span>
                    </div>
                    {a.detail && <div className="text-[11px] text-zinc-400 mt-1 leading-relaxed">{a.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <TopupRequestDialog open={topupOpen} onOpenChange={setTopupOpen} project={p} defaultPhaseId={topupPhaseId} />
      <EditProjectDialog open={editDetailsOpen} onOpenChange={setEditDetailsOpen} project={p} />
      <DeliverBatchDialog
        open={!!deliverPhase || !!feedbackDelivery}
        onOpenChange={(o) => { if (!o) { setDeliverPhase(null); setFeedbackDelivery(null); } }}
        project={p}
        phase={feedbackDelivery?.phase || deliverPhase}
        delivery={feedbackDelivery?.delivery || null}
      />
      <TpmTaskLogDialog
        open={!!taskLogPhase}
        onOpenChange={(o) => { if (!o) { setTaskLogPhase(null); setEditingLog(null); } }}
        project={p}
        phase={taskLogPhase}
        editingLog={editingLog}
      />
      <ProjectProvisionKeysDialog
        open={!!activeProvisionRequest}
        onOpenChange={(open) => !open && setActiveProvisionRequest(null)}
        request={activeProvisionRequest}
        onSubmit={(requestId, payload) => {
          provisionModelKeys(requestId, payload);
          toast.success("Keys provisioned", { description: `${activeProvisionRequest?.projectName} is now visible in this project.` });
          setActiveProvisionRequest(null);
        }}
      />
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent className="bg-[#12121A] border-white/10 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {p.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This hides the project from active dashboards and project lists while preserving its audit history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveProject}
              className="bg-amber-500 hover:bg-amber-600 text-black"
              data-testid="confirm-archive-project"
            >
              Archive project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#12121A] border-white/10 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {p.name} from the active workspace?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Use this for projects created by mistake. The project is removed from active views so the workspace is not left with unused shells.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-red-500 hover:bg-red-600 text-white"
              data-testid="confirm-delete-project"
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const TabTrigger = ({ value, icon: Icon, label, testid }) => (
  <TabsTrigger
    value={value}
    data-testid={testid}
    className="relative text-sm text-zinc-400 hover:text-zinc-100 data-[state=active]:text-fuchsia-300 data-[state=active]:bg-transparent gap-2 px-2 pb-3 pt-1 rounded-none data-[state=active]:shadow-none data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:-bottom-px data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-fuchsia-500"
  >
    <Icon className="w-3.5 h-3.5" /> {label}
  </TabsTrigger>
);

const SetupCard = ({ title, icon: Icon, children, testid }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-fuchsia-300" />
      <div className="font-display font-semibold text-[15px] text-white">{title}</div>
    </div>
    {children}
  </div>
);

const EmptySetupState = ({ message }) => (
  <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-6 text-center text-xs text-zinc-500">
    {message}
  </div>
);

const ipStyle = "w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40";

const Field = ({ label, children }) => (
  <label className="block space-y-1.5">
    <span className="text-[11px] uppercase tracking-widest font-semibold text-zinc-500">{label}</span>
    {children}
  </label>
);

const normalizeMemberSelectionId = (value = "") => String(value || "").trim().toLowerCase();

const findMemberSelectionId = (members = [], name = "") => {
  const normalizedName = String(name || "").trim().toLowerCase();
  if (!normalizedName) return members[0]?.selectionId || "";
  return members.find((member) => String(member.name || "").trim().toLowerCase() === normalizedName)?.selectionId
    || members[0]?.selectionId
    || "";
};

const envChip = (env) =>
  env === "production"
    ? "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300"
    : "bg-sky-500/10 border-sky-500/30 text-sky-300";

const typeChip = (type) =>
  type === "R&D"
    ? "bg-violet-500/10 border-violet-500/30 text-violet-300"
    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";

const providerColor = {
  Anthropic: "#E619B8",
  AWS: "#F59E0B",
  Azure: "#0EA5E9",
  GCP: "#3B82F6",
  OpenAI: "#10B981",
  OpenRouter: "#F97316",
  "AIML APIs": "#8B5CF6",
  Moonshot: "#22C55E",
  Google: "#3B82F6",
  xAI: "#F59E0B",
  Amazon: "#F59E0B",
  Meta: "#94A3B8",
  Mistral: "#22C55E",
  Cohere: "#38BDF8",
};

const normalizeCommaList = (value = "", fallback = "") => {
  const normalized = String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return normalized.length ? normalized.join(", ") : fallback;
};

const formatGatewayList = (values = []) => (
  Array.isArray(values) && values.length ? values.join(", ") : "Any"
);

const todayPlusDays = (days = 45) => {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 16);
};

const buildProvisionLines = (request) =>
  (request?.requestedModels?.length ? request.requestedModels : [{ id: `${request?.id}-fallback`, label: "Project access", provider: "Anthropic" }]).map((line) => ({
    id: line.id,
    label: line.label,
    modelId: line.modelId || "",
    provider: line.provider || "Anthropic",
    env: request?.budgetType === "Production" ? "production" : "testing",
    fullKey: "",
    memberIds: (request?.members || []).map((member) => member.id),
    rateLimitPerMinute: 120,
    budgetCap: Number(line.amount || 0),
    remainingBudget: Number(line.amount || 0),
    allowedNetworks: "Corp VPN",
    allowedDevices: "Managed laptop",
    expiresAt: todayPlusDays(request?.budgetType === "Production" ? 90 : 45),
  }));

const getProjectProvisioningStatusMeta = (status) => (
  status === "completed"
    ? { label: "Provisioned", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 }
    : { label: "Pending IT", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: Clock3 }
);

const ProjectKeyStat = ({ label, value }) => (
  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="mt-2 font-display text-2xl font-semibold tabular text-white">{value}</div>
  </div>
);

const BudgetTrackCard = ({ track, deliveries = [], logs = [], showActual = false, actualSpend = 0, topups = [], changes = [], topupCount, changeCount }) => {
  const latest = track.latest || {};
  const status = getBudgetReviewMeta(latest.status);
  const trackLabel = formatBudgetTabLabel(track.key || latest.budgetType || track.label);
  const sourceDelivery = latest.sourceDeliveryId
    ? deliveries.find((delivery) => delivery.id === latest.sourceDeliveryId)
    : track.key === "Testing"
      ? deliveries
        .filter((delivery) => delivery.status === "testing-submitted")
        .sort((left, right) => new Date(right.deliveredAt || 0).getTime() - new Date(left.deliveredAt || 0).getTime())[0]
      : null;
  const trackedTasks = Number(sourceDelivery?.rnd?.taskCount || latest.totalTasks || 0);
  const completedTasks = logs.reduce((sum, log) => sum + Number(log.tasksDone || log.successfulTasks || 0), 0);
  const loggedCost = logs.reduce((sum, log) => sum + getTaskLogRecordedCost(log), 0);
  const progress = trackedTasks > 0 ? Math.min(100, Math.round((completedTasks / trackedTasks) * 100)) : 0;
  const models = (latest.items?.models || []).map((item, index) => ({ id: item.id || `model-${index}`, label: item.optionLabel || item.model || "Model", amount: Number(item.amount || item.estCost || 0), detail: "Approved allocation" }));
  const infrastructure = (latest.items?.infra || []).map((item, index) => ({ id: item.id || `infra-${index}`, label: item.optionLabel || [item.provider, item.instance].filter(Boolean).join(" · ") || "Infrastructure", amount: Number(item.amount || item.estCost || 0), detail: item.days ? `${item.days} days` : "Approved allocation" }));
  const subscriptions = (latest.items?.subs || []).map((item, index) => ({ id: item.id || `sub-${index}`, label: item.optionLabel || item.subscription || "Subscription", amount: Number(item.amount || item.estCost || 0), seats: Number(item.seats || 0), members: Array.isArray(item.members) ? item.members : [] }));

  return (
    <details className="group rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <summary className="list-none cursor-pointer px-4 py-3 [&::-webkit-details-marker]:hidden">
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${showActual ? "lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.4fr_1fr_32px]" : "lg:grid-cols-[1.5fr_1fr_1fr_1.4fr_1fr_32px]"} gap-3 items-center`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-fuchsia-300">{trackLabel}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${status.cls}`}>
              <status.Icon className="w-3 h-3" />
              {status.label}
            </span>
          </div>
        </div>
        <BudgetTrackMetric label="Base budget" value={fmtCurrency(latest.total || 0, { compact: false })} />
        <BudgetTrackMetric label="Logged" value={fmtCurrency(loggedCost, { compact: false })} />
        {showActual && <BudgetTrackMetric label="Actual" value={fmtCurrency(actualSpend, { compact: false })} />}
        <div className="min-w-0"><div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Task Done</div><div className="mt-1 text-sm text-white tabular">{completedTasks.toLocaleString()}/{trackedTasks.toLocaleString()} tasks · {progress}%</div><div className="mt-2 h-1.5 rounded-full bg-white/[0.07] overflow-hidden"><div className={`h-full ${progress >= 100 ? "bg-emerald-500" : "bg-fuchsia-500"}`} style={{ width: `${progress}%` }} /></div></div>
        <BudgetTrackMetric label="Additional requests" value={Number(topupCount + changeCount).toLocaleString()} />
        <ChevronRight className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-90" />
      </div>
      </summary>
      <div className="border-t border-white/5 p-4 grid grid-cols-1 xl:grid-cols-4 gap-3">
        <RequestSummaryCard title={`Additional request (${topups.length + changes.length})`} icon={ArrowUpRightSquare} empty="No additional request mapped to this track.">
          {[...topups.map((request) => <TopupRequestCard key={request.id} request={request} />), ...changes.map((request) => <ChangeRequestCard key={request.id} request={request} />)]}
        </RequestSummaryCard>
        <PhaseResourceCard title="Models" icon={Layers} entries={models} empty="No models allocated to this track." />
        <SubscriptionResourceCard entries={subscriptions} />
        <PhaseResourceCard title="Infrastructure" icon={Archive} entries={infrastructure} empty="No infrastructure allocated to this track." />
      </div>
    </details>
  );
};

const BudgetTrackMetric = ({ label, value }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className="mt-1 text-sm text-white font-semibold tabular">{value}</div>
  </div>
);

// KPI card used in the Budget tab redesign (Spent/Cap + smaller stat cells)
const MiniKpi = ({ label, value, sub, accent = "text-white", testid }) => (
  <div className="h-full min-h-[132px] rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex flex-col justify-center" data-testid={testid}>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    <div className={`mt-2 font-display text-2xl font-semibold tabular ${accent}`}>{value}</div>
    {sub && <div className="text-[11px] text-zinc-500 mt-1 tabular">{sub}</div>}
  </div>
);

const RequestSummaryCard = ({ title, icon: Icon, children, empty, testid }) => {
  const hasContent = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3" data-testid={testid}>
      <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
        <Icon className="w-3 h-3" /> {title}
      </div>
      {!hasContent ? <div className="text-[11px] text-zinc-600 italic">{empty}</div> : <div className="space-y-1.5">{children}</div>}
    </div>
  );
};

const PhaseResourceCard = ({ title, icon: Icon, entries = [], empty }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
    <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
      <Icon className="w-3 h-3" /> {title} ({entries.length})
    </div>
    {entries.length === 0 ? <div className="text-[11px] text-zinc-600 italic">{empty}</div> : (
      <div className="space-y-1.5">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="text-[11px] font-medium text-white truncate">{entry.label}</div><div className="mt-0.5 text-[10px] text-zinc-500">{entry.detail}</div></div>
              <div className="text-[11px] font-semibold tabular text-white">{fmtCurrency(entry.amount || 0, { compact: false })}</div>
            </div>
            {entry.members?.length > 0 && <div className="mt-2 text-[10px] text-zinc-500">{entry.members.map((member) => typeof member === "string" ? member : member.name).filter(Boolean).join(", ")}</div>}
          </div>
        ))}
      </div>
    )}
  </div>
);

const SubscriptionResourceCard = ({ entries = [] }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
    <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500"><Wallet className="w-3 h-3" /> Subscriptions ({entries.length})</div>
    {entries.length === 0 ? <div className="text-[11px] text-zinc-600 italic">No subscriptions allocated to this track.</div> : <div className="space-y-1.5">
      {entries.map((entry) => <details key={entry.id} className="group/sub rounded-lg border border-white/5 bg-white/[0.02]">
        <summary className="list-none cursor-pointer p-2.5 [&::-webkit-details-marker]:hidden"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-[11px] font-medium text-white truncate">{entry.label}</div><div className="mt-0.5 text-[10px] text-zinc-500">{entry.members.length}/{entry.seats || entry.members.length} seats allocated</div></div><div className="flex items-center gap-2"><span className="text-[11px] font-semibold tabular text-white">{fmtCurrency(entry.amount || 0, { compact: false })}</span><ChevronRight className="w-3.5 h-3.5 text-zinc-500 transition-transform group-open/sub:rotate-90" /></div></div></summary>
        <div className="border-t border-white/5 px-2.5 py-2"><div className="text-[9px] uppercase tracking-widest text-zinc-600">Allocated members</div><div className="mt-1.5 flex flex-wrap gap-1">{entry.members.length ? entry.members.map((member) => <span key={typeof member === "string" ? member : member.id || member.name} className="rounded-md border border-fuchsia-500/15 bg-fuchsia-500/[0.07] px-2 py-1 text-[10px] text-fuchsia-200">{typeof member === "string" ? member : member.name || member.email}</span>) : <span className="text-[10px] text-zinc-500">No members allocated.</span>}</div></div>
      </details>)}
    </div>}
  </div>
);

// Change requests and top-ups are both "additional requests" — render them with the same card look.
const ChangeRequestCard = ({ request }) => {
  const status = changeRequestStatusMap[request.status] || getChangeRequestMeta(request);
  const breakdown = getChangeBreakdownAmounts(request);
  const hasBreakdown = Object.values(breakdown).some((value) => value > 0);
  const breakdownSelections = getChangeBreakdownSelections(request);
  return (
    <div className="block rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[11px] text-white font-medium">{request.type}</div>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${status.cls}`}>
              <status.Icon className="w-2.5 h-2.5" />
              {status.label}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 line-clamp-2">{request.reason}</div>
          {hasBreakdown && <div className="mt-2 flex flex-wrap gap-1.5">
              <TopupBreakdownPill label="Models" value={breakdown.models} />
              <TopupBreakdownPill label="Infra" value={breakdown.infra} />
              <TopupBreakdownPill label="Subs" value={breakdown.subs} />
            </div>}
          {breakdownSelections.length > 0 && (
            <div className="mt-2 text-[10px] text-zinc-400 leading-relaxed">
              {breakdownSelections.join(" · ")}
            </div>
          )}
          {!hasBreakdown && (
            <div className="mt-2 rounded-md border border-fuchsia-500/15 bg-fuchsia-500/[0.05] p-2">
              <div className="text-[9px] uppercase tracking-widest font-semibold text-fuchsia-300/70">Request specification</div>
              <div className="mt-1 text-[10px] text-zinc-300">{request.reason || request.description || request.type || "Additional project scope"}</div>
              {request.affectedPhase && <div className="mt-0.5 text-[10px] text-zinc-500">Phase: {request.affectedPhase}</div>}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-zinc-500">{fmtDate(request.createdAt)}</div>
          <div className="mt-1 text-[11px] font-semibold text-white">{fmtCurrency(request.amount, { compact: false })}</div>
        </div>
      </div>
    </div>
  );
};

const TopupRequestCard = ({ request }) => {
  const status = statusMap[request.status] || statusMap["pending-cto"];
  const breakdown = getTopupBreakdownAmounts(request);
  const hasBreakdown = Object.values(breakdown).some((value) => value > 0);
  const breakdownSelections = getTopupBreakdownSelections(request);

  return (
    <Link
      to={`/topup-requests/${request.id}`}
      className="block rounded-lg border border-white/5 bg-white/[0.02] p-2.5 hover:border-fuchsia-500/25"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[11px] text-white font-medium">{request.phaseName}</div>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${status.cls}`}>
              <status.Icon className="w-2.5 h-2.5" />
              {status.label}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 line-clamp-2">{request.reason}</div>
          {hasBreakdown && <div className="mt-2 flex flex-wrap gap-1.5">
              <TopupBreakdownPill label="Models" value={breakdown.models} />
              <TopupBreakdownPill label="Infra" value={breakdown.infra} />
              <TopupBreakdownPill label="Subs" value={breakdown.subs} />
            </div>}
          {breakdownSelections.length > 0 && (
            <div className="mt-2 text-[10px] text-zinc-400 leading-relaxed">
              {breakdownSelections.join(" · ")}
            </div>
          )}
          {!hasBreakdown && (
            <div className="mt-2 rounded-md border border-fuchsia-500/15 bg-fuchsia-500/[0.05] p-2">
              <div className="text-[9px] uppercase tracking-widest font-semibold text-fuchsia-300/70">Request specification</div>
              <div className="mt-1 text-[10px] text-zinc-300">{request.reason || request.description || request.type || "Additional budget"}</div>
              <div className="mt-0.5 text-[10px] text-zinc-500">For {request.phaseName || "the selected project phase"}</div>
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-zinc-500">{fmtDate(request.requestedAt)}</div>
          <div className="mt-1 text-[11px] font-semibold tabular text-white">{fmtCurrency(request.amount, { compact: false })}</div>
        </div>
      </div>
    </Link>
  );
};

const TopupBreakdownPill = ({ label, value }) => (
  <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-400">
    <span>{label}</span>
    <span className="font-semibold tabular text-zinc-100">{value > 0 ? fmtCurrency(value, { compact: false }) : "—"}</span>
  </div>
);

const ProvisionList = ({ title, items, empty }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">{title}</div>
    {items.length === 0 ? (
      <div className="text-[11px] text-zinc-500">{empty}</div>
    ) : (
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item} className="text-[11px] text-zinc-200">{item}</div>
        ))}
      </div>
    )}
  </div>
);

const ProjectProvisionKeysDialog = ({ open, onOpenChange, request, onSubmit }) => {
  const [lines, setLines] = useState(() => buildProvisionLines(request));
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setLines(buildProvisionLines(request));
    setNote("");
  }, [open, request]);

  if (!request) return null;

  const updateLine = (id, key, value) => {
    setLines((current) => current.map((line) => (
      line.id === id ? { ...line, [key]: value } : line
    )));
  };

  const toggleMember = (lineId, memberId) => {
    setLines((current) => current.map((line) => {
      if (line.id !== lineId) return line;
      const memberIds = line.memberIds.includes(memberId)
        ? line.memberIds.filter((id) => id !== memberId)
        : [...line.memberIds, memberId];
      return { ...line, memberIds };
    }));
  };

  const submit = () => {
    if (lines.some((line) => !String(line.fullKey || "").trim())) {
      toast.error("Add a key value for every requested model line");
      return;
    }
    if (lines.some((line) => line.memberIds.length === 0)) {
      toast.error("Allocate each key to at least one member");
      return;
    }
    onSubmit(request.id, { lines, note });
  };

  return (
    <div
      className={`${open ? "fixed" : "hidden"} inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center`}
      data-testid="project-provision-keys-dialog"
    >
      <div className="w-full max-w-[900px] max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#12121A] text-zinc-100 p-6">
        <div className="mb-4">
          <div className="font-display text-white text-xl font-semibold">Provision model keys</div>
          <div className="text-xs text-zinc-400 mt-1">
            {request.projectName} · approved {new Date(request.approvedAt || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · store the provider key once, then issue internal platform tokens to the selected members.
          </div>
        </div>

        <div className="space-y-4">
          {lines.map((line) => (
            <div key={line.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-white">{line.label}</div>
                  <div className="text-[11px] text-zinc-500 mt-1">{line.provider}</div>
                </div>
                <select
                  value={line.env}
                  onChange={(e) => updateLine(line.id, "env", e.target.value)}
                  className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100"
                >
                  <option value="testing">testing</option>
                  <option value="production">production</option>
                </select>
              </div>

              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Key value</div>
                <input
                  value={line.fullKey}
                  onChange={(e) => updateLine(line.id, "fullKey", e.target.value)}
                  placeholder="Paste the provisioned key"
                  data-testid={`project-provision-key-${line.id}`}
                  className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <ProjectProvisionField
                  label="Rate / min"
                  type="number"
                  min="1"
                  step="1"
                  value={line.rateLimitPerMinute}
                  onChange={(value) => updateLine(line.id, "rateLimitPerMinute", value)}
                />
                <ProjectProvisionField
                  label="Budget cap"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.budgetCap}
                  onChange={(value) => updateLine(line.id, "budgetCap", value)}
                />
                <ProjectProvisionField
                  label="Remaining budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.remainingBudget}
                  onChange={(value) => updateLine(line.id, "remainingBudget", value)}
                />
                <ProjectProvisionField
                  label="Expires at"
                  type="datetime-local"
                  value={line.expiresAt}
                  onChange={(value) => updateLine(line.id, "expiresAt", value)}
                />
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <ProjectProvisionField
                  label="Allowed networks"
                  value={line.allowedNetworks}
                  placeholder="Corp VPN, HQ Office"
                  onChange={(value) => updateLine(line.id, "allowedNetworks", normalizeCommaList(value, "Corp VPN"))}
                />
                <ProjectProvisionField
                  label="Allowed devices"
                  value={line.allowedDevices}
                  placeholder="Managed laptop, Serverless app"
                  onChange={(value) => updateLine(line.id, "allowedDevices", normalizeCommaList(value, "Managed laptop"))}
                />
              </div>

              <div className="mt-3">
                <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Allocate to members</div>
                <div className="flex flex-wrap gap-1.5">
                  {(request.members || []).map((member) => {
                    const isSelected = line.memberIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleMember(line.id, member.id)}
                        data-testid={`project-provision-member-${line.id}-${member.id}`}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                          isSelected ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
                        }`}
                      >
                        {member.name} · {member.role}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2 text-[11px] text-cyan-100">
                Gateway checks on every call: token status, token owner, user or app identity, allowed model, remaining budget, rate limit, expiration, and allowed network/device.
                <div className="mt-1 text-cyan-200/80">
                  Networks: {formatGatewayList(String(line.allowedNetworks || "").split(",").map((entry) => entry.trim()).filter(Boolean))} · Devices: {formatGatewayList(String(line.allowedDevices || "").split(",").map((entry) => entry.trim()).filter(Boolean))}
                </div>
              </div>
            </div>
          ))}

          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">IT note</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Optional note about provisioning, scope, or handoff"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-none"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]">
            Cancel
          </Button>
          <Button onClick={submit} className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-1.5 shadow-[0_0_20px_rgba(232,25,184,0.35)]">
            <CheckCircle2 className="w-3.5 h-3.5" /> Save provisioning
          </Button>
        </div>
      </div>
    </div>
  );
};

const ProjectProvisionField = ({ label, onChange, ...props }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">{label}</div>
    <input
      {...props}
      onChange={(event) => onChange(event.target.value)}
      className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
    />
  </div>
);

const PhaseMetric = ({ label, value, tone = "neutral" }) => {
  const tones = { emerald: "text-emerald-300", magenta: "text-fuchsia-300", warning: "text-amber-300", red: "text-red-300", neutral: "text-white" };
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
      <div className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular ${tones[tone]}`}>{value}</div>
    </div>
  );
};

const ResourceSummaryCard = ({ title, value, detail, testid }) => (
  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3" data-testid={testid}>
    <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{title}</div>
    <div className="mt-2 text-lg font-display font-semibold text-white tabular">{value}</div>
    <div className="mt-1 text-[11px] text-zinc-500 leading-relaxed">{detail}</div>
  </div>
);

const budgetRequestStatusMap = {
  submitted: { label: "Submitted", cls: "bg-white/[0.04] text-zinc-300 border-white/10", Icon: Clock3 },
  resubmitted: { label: "Resubmitted", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: Clock3 },
  forwarded: { label: "Forwarded", cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30", Icon: ChevronRight },
  "pending-cto": { label: "Pending", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
  "pending-cfo": { label: "Pending", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: Clock3 },
  "CTO Review": { label: "L2 review", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
  "COO Approval": { label: "COO approval", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: Clock3 },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  partial: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", Icon: Percent },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
  returned: { label: "Returned", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
};

const changeRequestStatusMap = {
  "CTO Review": { label: "L2 review", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
  "COO Approval": { label: "COO approval", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: Clock3 },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
};

const taskApprovalStatusMap = {
  logged: { label: "Logged", cls: "bg-white/[0.04] text-zinc-300 border-white/10", Icon: FileText },
  submitted: { label: "Batch submitted", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: PackageCheck },
  "testing-submitted": { label: "Testing submitted", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: PackageCheck },
  "pending-cfo": { label: "Pending", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: Clock3 },
  approved: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: CheckCircle2 },
  partial: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", Icon: Percent },
  rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30", Icon: XCircle },
  "non-recoverable": { label: "Closed · non-recoverable", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", Icon: Lock },
  "changes-requested": { label: "Returned", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: ChevronRight },
};

const normalizePhaseLabel = (value = "") => String(value).toLowerCase().replace(/\s+/g, " ").trim();

const matchesPhaseLabel = (label, phase) => {
  if (!label || !phase) return false;
  const normalizedLabel = normalizePhaseLabel(label);
  return normalizedLabel.includes(normalizePhaseLabel(phase.name)) || normalizedLabel.includes(normalizePhaseLabel(phase.id));
};

const requestMatchesPhase = (request, phase) => {
  if (!request || !phase) return false;
  if (!request.phaseIds.length && !request.phaseNames.length) return true;
  return request.phaseIds.includes(phase.id) || request.phaseNames.some((name) => matchesPhaseLabel(name, phase));
};

const buildProjectBudgetRequests = ({ projectId, submittedBudgets, liveBudgetReviews, seedBudgetReviews }) => {
  const mergedReviews = new Map();
  seedBudgetReviews.filter((review) => review.projectId === projectId).forEach((review) => mergedReviews.set(review.id, review));
  liveBudgetReviews.filter((review) => review.projectId === projectId).forEach((review) => mergedReviews.set(review.id, review));
  const reviewBudgetIds = new Set(Array.from(mergedReviews.values()).map((review) => review.sourceBudgetId).filter(Boolean));
  const submitted = submittedBudgets
    .filter((entry) => entry.projectId === projectId && !reviewBudgetIds.has(entry.id))
    .map((entry) => ({
      id: `budget-${entry.id}`,
      title: formatSubmittedBudgetTitle(entry.budgetType, entry.resubmitOfReviewId, entry.sampleIteration),
      amount: Number(entry.totals?.total || 0),
      status: entry.status || "pending-cto",
      phaseIds: (entry.phases || []).map((phase) => phase.id).filter(Boolean),
      phaseNames: (entry.phases || []).map((phase) => phase.name).filter(Boolean),
      scope: (entry.phases || []).length ? (entry.phases || []).map((phase) => phase.name).filter(Boolean).join(", ") : "Project-wide",
      when: fmtDate(entry.submittedAt),
    }));

  const reviews = Array.from(mergedReviews.values()).map((review) => ({
    id: `review-${review.id}`,
    title: replaceBudgetTabLabelText(review.type || "Budget review"),
    amount: Number(review.modifiedTotal || review.requestedBudget || review.currentBudget || 0),
    status:
      review.status === "forwarded-cfo" ? "pending-cfo"
        : review.status === "rejected-by-cto" ? "rejected"
          : review.status === "returned-to-tpm" ? "returned"
            : review.status || review.stage || "pending-cto",
    phaseIds: (review.modifiedPhases || []).map((phase) => phase.id).filter(Boolean),
    phaseNames: (review.modifiedPhases || []).map((phase) => phase.name).filter(Boolean),
    scope: (review.modifiedPhases || []).length ? (review.modifiedPhases || []).map((phase) => phase.name).filter(Boolean).join(", ") : "Project-wide",
    when: fmtDate(review.ctoAt || review.submittedAt),
  }));

  return [...submitted, ...reviews];
};

const formatBudgetTabLabel = (budgetType = "") => (
  normalizeBudgetType(budgetType) === "RnD"
    ? "Sample"
    : formatBudgetTypeLabel(budgetType)
);

const replaceBudgetTabLabelText = (value = "") => String(value || "")
  .replace(/\bSampling\b/g, "Sample")
  .replace(/\bR&D\b/g, "Sample");

const formatSubmittedBudgetTitle = (budgetType, resubmitOfReviewId, sampleIteration = 1) => {
  const normalizedBudgetType = normalizeBudgetType(budgetType);
  const base =
    normalizedBudgetType === "Testing" ? "Testing budget"
      : normalizedBudgetType === "Rework" ? `Rework${sampleIteration > 1 ? ` ${sampleIteration}` : ""} budget`
        : normalizedBudgetType === "RnD" ? "Sample budget"
          : normalizedBudgetType === "Production" ? "Production budget"
            : "Budget request";
  return resubmitOfReviewId ? `Resubmitted ${base}` : base;
};

const getBudgetReviewTimestamp = (review) => new Date(
  review?.cfoDecision?.at
  || review?.ctoAt
  || review?.submittedAt
  || 0
).getTime();

const getBudgetReviewMeta = (status) => (
  statusMap[status]
  || statusMap[status === "forwarded-cfo" ? "pending-cfo" : status]
  || { label: "Submitted", cls: "bg-white/[0.04] text-zinc-300 border-white/10", Icon: Clock3 }
);

const getRndDeliveryCycleLabel = (delivery) => (
  normalizeBudgetType(delivery?.budgetType) === "Testing"
    ? "Testing submitted"
    : `Sample ${delivery?.sampleIteration || 1}`
);

const getDeliverButtonLabel = (isRndProject, delivery, project) => {
  if (delivery?.status === "changes-requested") return "Deliver revised sample";
  if (isRndProject) {
    if (delivery) return "Submitted";
    return normalizeBudgetType(project?.lastBudgetSubmission?.budgetType) === "Testing" ? "Submit testing batch" : "Submit batch";
  }
  return delivery ? "Delivered" : "Deliver batch";
};

const formatWorkflowDateTime = (value) => {
  const ts = new Date(value || "").getTime();
  if (!Number.isFinite(ts) || ts <= 0) return "";
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getWorkflowLockMessage = ({ project, workflowStage, latestBudgetReviewMeta, role }) => {
  const pendingType = normalizeBudgetType(project?.pendingBudgetSubmission?.budgetType || "");
  const pendingLabel = pendingType ? formatBudgetTabLabel(pendingType) : "Budget";
  const pendingStage = project?.pendingBudgetSubmission?.stage || latestBudgetReviewMeta?.label || "";
  const rejection = project?.budgetRejection || null;
  const retryLabel = formatWorkflowDateTime(project?.budgetRetryAvailableAt || rejection?.retryAt);
  const rejectedAtLabel = formatWorkflowDateTime(rejection?.at);
  const rejectionNote = String(rejection?.note || "").trim();

  if (rejection) {
    const byLabel = rejection?.by || rejection?.role || "approver";
    if (retryLabel && new Date(project?.budgetRetryAvailableAt || rejection?.retryAt || "").getTime() > Date.now()) {
      return `Budget was rejected by ${byLabel}. Raise a new budget after ${retryLabel}.${rejectionNote ? ` Note: ${rejectionNote}` : ""}`;
    }
    return `Budget was rejected${rejectedAtLabel ? ` on ${rejectedAtLabel}` : ""}. Raise a new budget to resume task logging.${rejectionNote ? ` Note: ${rejectionNote}` : ""}`;
  }

  if (project?.pendingBudgetSubmission) {
    const approver = pendingStage === "pending-cfo" || pendingStage === "Pending · L3" ? "L3" : "L2 and L3";
    return `${pendingLabel} request is awaiting ${approver} approval. Tasks, additional requests, and delivery unlock after approval.`;
  }
  if (workflowStage === "awaiting-testing-budget") {
    return "Raise the required R&D budget. Testing or Sample can be submitted directly, and execution unlocks after CTO and CFO approve it.";
  }
  if (workflowStage === "awaiting-rnd-budget") {
    return "Raise the required R&D budget track directly from this project. Testing, Sample, and Rework can be submitted as needed.";
  }
  if (workflowStage === "awaiting-rework-budget") {
    return "This sample needs rework. Raise the next sample budget to continue.";
  }
  if (workflowStage === "tpm-budget-ready") {
    return role === "TPM"
      ? "Project is ready for the production budget. Raise it to activate TPM execution."
      : "Project is waiting for TPM's production budget before execution can start.";
  }
  if (workflowStage === "sample-rejected") {
    return "This sample was rejected. Raise a fresh budget only if the project is continuing.";
  }
  return latestBudgetReviewMeta
    ? `Budget is ${latestBudgetReviewMeta.label.toLowerCase()}. Tasks, additional requests, and batch delivery unlock after CFO approval.`
    : "Submit a budget and wait for CFO approval to unlock tasks and batch delivery.";
};

const getBudgetRequestMeta = (request) => budgetRequestStatusMap[request.status] || budgetRequestStatusMap.submitted;
const getChangeRequestMeta = (request) => changeRequestStatusMap[request.stage] || changeRequestStatusMap["CTO Review"];

const getTaskApprovalState = (log, delivery) => {
  if (log?.approvalStatus && taskApprovalStatusMap[log.approvalStatus]) return taskApprovalStatusMap[log.approvalStatus];
  if (!delivery) return taskApprovalStatusMap.logged;
  if (delivery.status === "feedback-pending") return taskApprovalStatusMap.submitted;
  if (delivery.status === "testing-submitted") return taskApprovalStatusMap["testing-submitted"];
  if (delivery.status === "non-recoverable") return taskApprovalStatusMap["non-recoverable"];
  if (delivery.actualRecovered === 0) return taskApprovalStatusMap.rejected;
  if (delivery.actualRecovered != null && delivery.actualRecovered >= delivery.proposedAmount) return taskApprovalStatusMap.approved;
  if (delivery.actualRecovered != null) return taskApprovalStatusMap.partial;
  return taskApprovalStatusMap["pending-cfo"];
};

const sumBreakdownEntryAmount = (entry) => {
  if (!entry) return 0;
  if (Array.isArray(entry.entries) && entry.entries.length) {
    return entry.entries.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  }
  return Number(entry.amount || 0);
};

const getTopupBreakdownAmounts = (request) => ({
  models: sumBreakdownEntryAmount(request.breakdown?.models),
  infra: sumBreakdownEntryAmount(request.breakdown?.infra),
  subs: sumBreakdownEntryAmount(request.breakdown?.subs),
});

const getChangeBreakdownAmounts = (request) => ({
  models: Number(request.breakdown?.models?.amount || 0),
  infra: Number(request.breakdown?.infra?.amount || 0),
  subs: Number(request.breakdown?.subs?.amount || 0),
});

const getResolvedTopupAmount = (request) => Number((request.cfoDecision?.amount ?? request.ctoDecision?.amount ?? request.amount) || 0);

const summarizePhaseBudget = (phase, topups = [], changes = []) => {
  const base = Number(phase?.estimated || 0);
  const topupsTotal = topups.reduce((sum, request) => sum + getResolvedTopupAmount(request), 0);
  const changesTotal = changes.reduce((sum, request) => sum + Number(request.amount || 0), 0);
  return {
    base,
    topupsTotal,
    changesTotal,
    currentTotal: base + topupsTotal + changesTotal,
  };
};

const getTaskLogRecordedCost = (log) => {
  if (String(log?.logType || "").trim() === "general-actual" && Array.isArray(log?.generalActualRows)) {
    return log.generalActualRows.reduce((sum, entry) => sum + Number(entry.estCost || entry.amount || entry.cost || 0), 0);
  }
  if (Array.isArray(log?.successfulRows) || Array.isArray(log?.failedRows)) {
    return [
      ...(Array.isArray(log?.successfulRows) ? log.successfulRows : []),
      ...(Array.isArray(log?.failedRows) ? log.failedRows : []),
    ].reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
  }
  if (Array.isArray(log?.modelUsage) && log.modelUsage.length) {
    return log.modelUsage.reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
  }
  return Number(log?.cost || 0);
};

const getLogModelNames = (log) => {
  if (Array.isArray(log?.modelUsage) && log.modelUsage.length) {
    return log.modelUsage.map((entry) => entry.modelName || entry.modelId).filter(Boolean);
  }
  return [log?.modelName || log?.modelId].filter(Boolean);
};

const getTopupBreakdownSelections = (request) => {
  const amounts = getTopupBreakdownAmounts(request);
  return [
    request.breakdown?.models ? `Models ${fmtCurrency(amounts.models, { compact: false })}: ${formatBreakdownEntry(request.breakdown.models)}` : null,
    request.breakdown?.infra ? `Infra ${fmtCurrency(amounts.infra, { compact: false })}: ${formatBreakdownEntry(request.breakdown.infra)}` : null,
    request.breakdown?.subs ? `Subs ${fmtCurrency(amounts.subs, { compact: false })}: ${formatBreakdownEntry(request.breakdown.subs)}` : null,
  ].filter(Boolean);
};

const getChangeBreakdownSelections = (request) => {
  const amounts = getChangeBreakdownAmounts(request);
  return [
    request.breakdown?.models ? `Models ${fmtCurrency(amounts.models, { compact: false })}: ${formatBreakdownEntry(request.breakdown.models)}` : null,
    request.breakdown?.infra ? `Infra ${fmtCurrency(amounts.infra, { compact: false })}: ${formatBreakdownEntry(request.breakdown.infra)}` : null,
    request.breakdown?.subs ? `Subs ${fmtCurrency(amounts.subs, { compact: false })}: ${formatBreakdownEntry(request.breakdown.subs)}` : null,
  ].filter(Boolean);
};

const estimatePhaseCostBreakdown = (project, phase, topups, changes = []) => {
  const totalEstimated = (project.phases || []).reduce((sum, item) => sum + Number(item.estimated || 0), 0) || 1;
  const share = Number(phase?.estimated || 0) / totalEstimated;
  const licenseSpend = (project.expenses || [])
    .filter((expense) => expense.category === "Licenses")
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const topupModels = topups.reduce((sum, request) => sum + sumBreakdownEntryAmount(request.breakdown?.models), 0);
  const topupInfra = topups.reduce((sum, request) => sum + sumBreakdownEntryAmount(request.breakdown?.infra), 0);
  const topupSubs = topups.reduce((sum, request) => sum + sumBreakdownEntryAmount(request.breakdown?.subs), 0);
  const changeModels = changes.reduce((sum, request) => sum + Number(request.breakdown?.models?.amount || 0), 0);
  const changeInfra = changes.reduce((sum, request) => sum + Number(request.breakdown?.infra?.amount || 0), 0);
  const changeSubs = changes.reduce((sum, request) => sum + Number(request.breakdown?.subs?.amount || 0), 0);

  return {
    models: Math.round(((project.aiModelCost || 0) * share) + topupModels + changeModels),
    infra: Math.round(((project.infrastructureCost || 0) * share) + topupInfra + changeInfra),
    subs: Math.round((licenseSpend * share) + topupSubs + changeSubs),
  };
};

const collectResourceNames = (values) => Array.from(new Set(values.map((value) => String(value || "").trim()).filter((value) => value && value !== "—")));

const formatBreakdownEntry = (entry) => {
  if (!entry) return "";
  if (Array.isArray(entry.entries) && entry.entries.length) {
    return entry.entries
      .map((line) => [line.optionLabel, line.note].map((value) => String(value || "").trim()).filter(Boolean).join(" · "))
      .filter(Boolean)
      .join(" | ");
  }
  return [entry.optionLabel, entry.note].map((value) => String(value || "").trim()).filter(Boolean).join(" · ");
};

const getSubscriptionSummary = (topups = [], changes = []) => {
  const requested = [...topups, ...changes]
    .filter((request) => sumBreakdownEntryAmount(request.breakdown?.subs) > 0)
    .map((request) => `${fmtCurrency(sumBreakdownEntryAmount(request.breakdown?.subs), { compact: false })}${formatBreakdownEntry(request.breakdown?.subs) ? ` · ${formatBreakdownEntry(request.breakdown.subs)}` : ""}`);
  return requested.length ? requested.join(" | ") : "No subscription ask raised for this phase.";
};

export default ProjectDetail;
