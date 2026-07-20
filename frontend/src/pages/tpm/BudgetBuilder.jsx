import { useMemo, useState, useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext";
import { fmtCurrency } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, Send, Sparkles, ClipboardCheck, Cpu, Server, CreditCard,
  CheckCircle2, ChevronRight, UserPlus, MessageSquareWarning, FileText,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  EC2_INSTANCES,
  BEDROCK_MODELS,
  INFRA_STORAGE_TYPES,
  PLATFORM_PROVIDERS,
  SUBSCRIPTION_CATALOG,
} from "../../data/mockCatalog";
import { BUDGET_REVIEWS } from "../../data/mockTpm";
import { isProjectInTpmLane, normalizeBudgetType } from "../../lib/projectMetrics";
import { ADD_CUSTOM_MODEL_OPTION, buildModelOptionLabel, promptForCustomModel } from "../../lib/modelCatalog";
import GeneralBudgetTableCard from "../../components/budget/GeneralBudgetTableCard";
import {
  calculateGeneralBudgetRowTotal,
  DEFAULT_GENERAL_BUDGET_HEADERS,
  buildEmptyGeneralBudgetTableRow,
  getGeneralBudgetCostHeaders,
  getGeneralBudgetColumnCellKey,
  isGeneralBudgetCostHeader,
  isGeneralBudgetTableLine,
  normalizeGeneralBudgetHeaders,
  normalizeGeneralBudgetRows,
  parseGeneralBudgetTable,
  serializeGeneralBudgetTableRows,
  sumGeneralBudgetRows,
} from "../../lib/generalBudget";

const uid = () => Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDaysISO = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const splitPhaseDates = (value = "") => String(value).split("→").map((part) => part.trim());
const HOURS_PER_MONTH = 730; // AWS standard
const MS_PER_DAY = 86400000;
const DIRECT_COST_BUDGET_TYPES = ["Testing"];
const TEAM_TYPE_OPTIONS = ["Technical", "Generalist", "R&D"];
const MODEL_PLATFORM_PRIORITY = PLATFORM_PROVIDERS;
const MODEL_PLATFORM_MAP = {
  AWS: new Set(["AI21", "Amazon", "Anthropic", "Cohere", "DeepSeek", "Meta", "Mistral", "Stability AI"]),
  OpenAI: new Set(["OpenAI"]),
  GCP: new Set(["Google"]),
  Moonshot: new Set(["Moonshot AI"]),
};

const getInfraProvider = (instance = {}) => String(instance?.provider || "AWS").trim() || "AWS";
const withInfraProvider = (instance = {}) => ({ ...instance, provider: getInfraProvider(instance) });
const getModelPlatform = (model = {}) => {
  const explicit = String(model?.platform || "").trim();
  if (explicit) return explicit;
  const provider = String(model?.provider || "").trim();
  if (MODEL_PLATFORM_PRIORITY.includes(provider)) return provider;
  const matched = MODEL_PLATFORM_PRIORITY.find((platform) => MODEL_PLATFORM_MAP[platform]?.has(provider));
  return matched || "OpenRouter";
};
const getModelsForProvider = (catalog = [], provider = "") => {
  const filtered = catalog.filter((model) => getModelPlatform(model) === provider);
  return filtered.length ? filtered : catalog;
};
const getInstancesForProvider = (provider = "") => {
  const filtered = EC2_INSTANCES.filter((instance) => getInfraProvider(instance) === provider);
  return filtered.length ? filtered : EC2_INSTANCES;
};
const getStorageTypesForProvider = (provider = "") => {
  const options = INFRA_STORAGE_TYPES[provider];
  return Array.isArray(options) && options.length ? options : ["Standard SSD"];
};
const getDefaultStorageType = (provider = "") => getStorageTypesForProvider(provider)[0] || "Standard SSD";
const normalizeStorageTypeForProvider = (provider = "", storageType = "") => {
  const options = getStorageTypesForProvider(provider);
  return options.includes(storageType) ? storageType : getDefaultStorageType(provider);
};
const getDailyRateFromMonthly = (monthlyAmount = 0) => Number(monthlyAmount || 0) / 30;
const getInfraInstanceCount = (value = 1) => Math.max(1, Number(value || 1));
const getPerInstanceStorage = (value = 100) => Math.max(0, Number(value || 0));
const getInfraTotalDailyRate = ({ monthlyCost = 0, instanceCount = 1 } = {}) =>
  Math.round(getDailyRateFromMonthly(monthlyCost) * getInfraInstanceCount(instanceCount) * 100) / 100;
const calculateInfraEstimate = ({ monthlyCost = 0, instanceCount = 1, days = 0 } = {}) =>
  Math.round(getInfraTotalDailyRate({ monthlyCost, instanceCount }) * Number(days || 0) * 100) / 100;
const getInclusiveDayCount = (start = "", end = "") => {
  if (!start || !end) return 0;
  const startTs = new Date(`${start}T00:00:00`).getTime();
  const endTs = new Date(`${end}T00:00:00`).getTime();
  if (Number.isNaN(startTs) || Number.isNaN(endTs) || endTs < startTs) return 0;
  return Math.floor((endTs - startTs) / MS_PER_DAY) + 1;
};
const formatBudgetTypeOptionLabel = (value = "") => (value === "RnD" ? "Sample" : value);
const formatRetryDateTime = (value = "") => {
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

// Seed cost/task from the model catalog (~4K in + 1K out per trajectory) — user can override.
const seedCostPerTask = (model) => {
  if (!model) return 0.05;
  return Math.round((model.pricePer1kIn * 4 + model.pricePer1kOut * 1) * 10000) / 10000;
};

const emptyModelItem = (modelCatalog = BEDROCK_MODELS, totalTrajectories = 0) => {
  const defaultPlatform = MODEL_PLATFORM_PRIORITY[0];
  const providerModels = getModelsForProvider(modelCatalog, defaultPlatform);
  const m = providerModels[0] || modelCatalog[0] || BEDROCK_MODELS[0];
  const costPerTask = seedCostPerTask(m);
  return {
    id: uid(),
    modelId: m.id,
    provider: getModelPlatform(m),
    usageTag: "Trajectory building",
    costPerTask,
    estCost: Math.round(costPerTask * totalTrajectories * 100) / 100,
  };
};
const emptyInfraItem = (days = 30) => {
  const inst = EC2_INSTANCES[0];
  const monthly = Math.round(inst.hourly * HOURS_PER_MONTH * 100) / 100;
  const provider = getInfraProvider(inst);
  return {
    id: uid(),
    provider,
    instance: inst.code,
    instanceCount: 1,
    monthlyCost: monthly,
    storageType: getDefaultStorageType(provider),
    perInstanceStorage: 100,
    estCost: calculateInfraEstimate({ monthlyCost: monthly, instanceCount: 1, days }),
  };
};
const emptySubItem = () => {
  const s = SUBSCRIPTION_CATALOG[0];
  return { id: uid(), subscription: s.name, pricePerSeat: s.monthly, seats: 1, members: [], estCost: s.monthly };
};
const emptyGeneralItem = () => ({
  id: uid(),
  label: "",
  note: "",
  estCost: 0,
});

const emptyPhase = (n, start, end) => ({
  id: `p${n}`,
  name: `Phase ${n}`,
  tasks: 100,
  trajectories: 3,
  start: start || todayISO(),
  end: end || plusDaysISO(14),
});

const BudgetBuilder = ({ embeddedProjectId = "", onClose = null, onSubmitted = null }) => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const editReviewId = params.get("edit");
  const requestedProjectId = embeddedProjectId || params.get("projectId") || params.get("project") || "";
  const requestedBudgetType = normalizeBudgetType(params.get("budgetType") || "");
  const requestedPhaseId = params.get("phaseId") || "";
  const requestedSampleIteration = Math.max(Number(params.get("sampleIteration") || 1), 1);
  const requestedSourceDeliveryId = params.get("sourceDeliveryId") || null;
  const { visibleProjects: allVisibleProjects, submitBudget, budgetReviews, budgets, role, user, modelCatalog, addCustomModel } = useApp();
  const isRnd = role === "R&D";
  const testingInfraPrefillAppliedRef = useRef(false);

  const [step, setStep] = useState(1); // 1=Details, 2=Budget Items, 3=Preview

  // Prefill from a returned review, if applicable
  const returnedReview = useMemo(() => {
    if (!editReviewId) return null;
    return budgetReviews.find((r) => r.id === editReviewId) || BUDGET_REVIEWS.find((r) => r.id === editReviewId) || null;
  }, [editReviewId, budgetReviews]);
  const visibleProjects = useMemo(() => {
    const activeProjects = isRnd ? allVisibleProjects : allVisibleProjects.filter((project) => isProjectInTpmLane(project));
    const pinnedProjectId = returnedReview?.projectId || requestedProjectId;
    if (pinnedProjectId && !activeProjects.some((project) => project.id === pinnedProjectId)) {
      const pinnedProject = allVisibleProjects.find((project) => project.id === pinnedProjectId);
      return pinnedProject ? [pinnedProject, ...activeProjects] : activeProjects;
    }
    return activeProjects;
  }, [allVisibleProjects, isRnd, requestedProjectId, returnedReview]);
  const modelProviderOptions = useMemo(
    () => MODEL_PLATFORM_PRIORITY.filter((platform) => getModelsForProvider(modelCatalog, platform).length > 0),
    [modelCatalog]
  );
  const infraProviderOptions = useMemo(
    () => MODEL_PLATFORM_PRIORITY.filter((platform) => getInstancesForProvider(platform).length > 0),
    []
  );

  // ---- Step 1: Details ----
  const [projectId, setProjectId] = useState(
    returnedReview?.projectId
    || (visibleProjects.some((project) => project.id === requestedProjectId) ? requestedProjectId : "")
    || visibleProjects[0]?.id
    || ""
  );
  const [priority, setPriority] = useState("Medium");
  const [teamType, setTeamType] = useState(returnedReview?.teamType || (isRnd ? "R&D" : "Technical"));
  const showReworkOption = requestedBudgetType === "Rework" || normalizeBudgetType(returnedReview?.budgetType) === "Rework";
  const budgetTypeOptions = useMemo(
    () => (
      teamType === "R&D"
        ? ["Testing", "RnD", ...(showReworkOption ? ["Rework"] : [])]
        : ["Production"]
    ),
    [showReworkOption, teamType]
  );
  const initialBudgetType =
    returnedReview?.budgetType
    || (["Testing", "RnD", "Rework", "Production"].includes(requestedBudgetType) ? requestedBudgetType : null)
    || (teamType === "R&D" ? "Testing" : "Production");
  const [budgetType, setBudgetType] = useState(initialBudgetType);
  const effectiveBudgetType = teamType === "R&D"
    ? (budgetTypeOptions.includes(budgetType) ? budgetType : (budgetTypeOptions[0] || "Testing"))
    : "Production";
  const isDirectCostBudget = DIRECT_COST_BUDGET_TYPES.includes(effectiveBudgetType);
  const isReworkBudget = effectiveBudgetType === "Rework";
  const usesRndWorkflow = teamType === "R&D";
  // R&D locked to single phase
  const [deliveryMode, setDeliveryMode] = useState("single");

  const [singleStart, setSingleStart] = useState(todayISO());
  const [singleEnd, setSingleEnd] = useState(plusDaysISO(30));
  const [singlePhase, setSinglePhase] = useState({ tasks: 500, trajectories: 3 });
  const [phases, setPhases] = useState([
    { ...emptyPhase(1), start: todayISO(), end: plusDaysISO(15) },
    { ...emptyPhase(2), start: plusDaysISO(16), end: plusDaysISO(30) },
  ]);

  // ---- Step 2: Budget items ----
  const [selectedTypes, setSelectedTypes] = useState({ models: true, infra: true, subs: true, general: false });
  const [activeTab, setActiveTab] = useState("models");
  const [models, setModels] = useState([emptyModelItem(modelCatalog, DIRECT_COST_BUDGET_TYPES.includes(initialBudgetType) ? 0 : 500 * 3)]);
  const [infra, setInfra] = useState([emptyInfraItem()]);
  const [subs, setSubs] = useState([emptySubItem()]);
  const [general, setGeneral] = useState([]);
  const [generalMode, setGeneralMode] = useState("table");
  const [generalTableHeaders, setGeneralTableHeaders] = useState(DEFAULT_GENERAL_BUDGET_HEADERS);
  const [generalTableRows, setGeneralTableRows] = useState([]);
  const selectedProject = useMemo(
    () => visibleProjects.find((project) => project.id === projectId) || null,
    [visibleProjects, projectId]
  );
  const subscriptionMemberPool = useMemo(() => {
    const coreMembers = [
      ...(selectedProject?.tpm ? [{ name: selectedProject.tpm, role: "TPM", email: selectedProject.tpmEmail || "" }] : []),
      ...((selectedProject?.plMembers || []).map((name) => ({ name, role: "Project Lead", email: "" }))),
      ...((selectedProject?.qlMembers || []).map((name) => ({ name, role: "Quality Lead", email: "" }))),
      ...((selectedProject?.rndMembers || []).map((name) => ({ name, role: "R&D", email: "" }))),
    ];
    const roster = [
      ...(selectedProject?.teamMembers || []),
      ...(selectedProject?.kickoffMail?.recipients || []),
      ...coreMembers,
    ];
    const seen = new Set();
    return roster.reduce((acc, member, index) => {
      const key = String(member?.email || member?.id || member?.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) return acc;
      seen.add(key);
      acc.push({
        id: member?.id || member?.email || `${member?.name || "member"}-${index}`,
        name: member?.name || "Unknown member",
        role: member?.role || "Member",
        email: member?.email || "",
      });
      return acc;
    }, []);
  }, [selectedProject]);

  // If prefilling from a returned review, hydrate reasonable defaults
  useEffect(() => {
    if (!returnedReview) return;
    const proj = visibleProjects.find((p) => p.id === returnedReview.projectId);
    if (proj) setProjectId(proj.id);
    const hydratedBudgetType = normalizeBudgetType(returnedReview.budgetType || initialBudgetType);
    if (budgetTypeOptions.includes(hydratedBudgetType)) setBudgetType(hydratedBudgetType);
    if (returnedReview.teamType && TEAM_TYPE_OPTIONS.includes(returnedReview.teamType)) setTeamType(returnedReview.teamType);
    setPriority(
      returnedReview.urgency === "High"
        ? "High"
        : returnedReview.urgency === "Low"
          ? "Low"
          : "Medium"
    );

    const reviewPhases = Array.isArray(returnedReview.requestedPhases) ? returnedReview.requestedPhases : [];
    if (reviewPhases.length > 1 && !DIRECT_COST_BUDGET_TYPES.includes(hydratedBudgetType)) {
      setDeliveryMode("multiple");
      setPhases(reviewPhases.map((phase, index) => ({
        id: phase.id || `p${index + 1}`,
        name: phase.name || `Phase ${index + 1}`,
        tasks: Number(phase.tasks || 0),
        trajectories: Number(phase.trajectories || 0),
        start: phase.start || todayISO(),
        end: phase.end || plusDaysISO(14),
      })));
    } else {
      const phase = reviewPhases[0] || null;
      setDeliveryMode("single");
      if (phase?.start) setSingleStart(phase.start);
      if (phase?.end) setSingleEnd(phase.end);
      setSinglePhase({
        tasks: Number(phase?.tasks || returnedReview.tasks || 0),
        trajectories: Number(phase?.trajectories || 0),
      });
    }

    const reviewItems = returnedReview.items || {};
    const hasModelLines = Array.isArray(reviewItems.models) && reviewItems.models.length > 0;
    const hasInfraLines = Array.isArray(reviewItems.infra) && reviewItems.infra.length > 0;
    const hasSubLines = Array.isArray(reviewItems.subs) && reviewItems.subs.length > 0;
    const hasGeneralLines = Array.isArray(reviewItems.misc) && reviewItems.misc.length > 0;
    const generalTableState = parseGeneralBudgetTable(reviewItems.misc || []);
    const nextModels = hasModelLines
      ? reviewItems.models.map((line) => {
          const meta = modelCatalog.find((entry) => entry.id === line.modelId) || line.meta || modelCatalog[0] || BEDROCK_MODELS[0];
          return {
            id: line.id || uid(),
            modelId: line.modelId || meta?.id || modelCatalog[0]?.id || BEDROCK_MODELS[0]?.id,
            provider: line.platform || getModelPlatform({ ...meta, provider: line.provider || meta?.provider }) || modelProviderOptions[0] || "",
            usageTag: line.usageTag || "Trajectory building",
            costPerTask: Number(line.costPerTask || seedCostPerTask(meta)),
            estCost: Number(line.estCost || line.amount || 0),
          };
        })
      : [emptyModelItem(modelCatalog, DIRECT_COST_BUDGET_TYPES.includes(hydratedBudgetType) ? 0 : 500 * 3)];
    const nextInfra = hasInfraLines
      ? reviewItems.infra.map((line) => {
          const meta = EC2_INSTANCES.find((entry) => entry.code === (line.instance || line.meta?.code)) || line.meta || EC2_INSTANCES[0];
          const monthlyCost = Number(line.monthlyCost || line.meta?.monthlyCost || line.estCost || line.amount || 0);
          const provider = line.provider || line.meta?.provider || getInfraProvider(meta);
          return {
            id: line.id || uid(),
            provider,
            instance: line.instance || meta?.code || EC2_INSTANCES[0].code,
            instanceCount: getInfraInstanceCount(line.instanceCount || line.meta?.instanceCount || 1),
            monthlyCost,
            storageType: normalizeStorageTypeForProvider(
              provider,
              line.storageType || line.meta?.storageType || ""
            ),
            perInstanceStorage: getPerInstanceStorage(
              line.perInstanceStorage || line.meta?.perInstanceStorage || 100
            ),
            estCost: Number(line.estCost || line.amount || monthlyCost || 0),
          };
        })
      : [emptyInfraItem()];
    const nextSubs = hasSubLines
      ? reviewItems.subs.map((line) => {
          const meta = SUBSCRIPTION_CATALOG.find((entry) => entry.name === line.subscription) || SUBSCRIPTION_CATALOG[0];
          return {
            id: line.id || uid(),
            subscription: line.subscription || meta?.name || SUBSCRIPTION_CATALOG[0].name,
            pricePerSeat: Number(line.pricePerSeat || meta?.monthly || line.estCost || line.amount || 0),
            seats: Number(line.seats || Math.max(line.members?.length || 0, 1)),
            members: Array.isArray(line.members) ? line.members : [],
            estCost: Number(line.estCost || line.amount || 0),
          };
        })
      : [emptySubItem()];
    const nextGeneral = hasGeneralLines
      ? reviewItems.misc.filter((line) => !isGeneralBudgetTableLine(line)).map((line) => ({
          id: line.id || uid(),
          label: line.label || line.optionLabel || "General request",
          note: line.note || line.detail || "",
          estCost: Number(line.estCost || line.amount || 0),
        }))
      : [];
    const nextGeneralTableRows = generalTableState.rows.length
      ? generalTableState.rows
      : nextGeneral.map((line) => ({
          id: line.id || uid(),
          phaseId: "",
          phaseName: "",
          estCost: Number(line.estCost || 0),
          cells: {
            [DEFAULT_GENERAL_BUDGET_HEADERS[0]]: line.label || "",
            [DEFAULT_GENERAL_BUDGET_HEADERS[1]]: line.note || "",
          },
        }));

    setModels(nextModels);
    setInfra(nextInfra);
    setSubs(nextSubs);
    setGeneral(nextGeneral);
    setGeneralMode("table");
    setGeneralTableHeaders(generalTableState.rows.length ? generalTableState.headers : DEFAULT_GENERAL_BUDGET_HEADERS);
    setGeneralTableRows(nextGeneralTableRows);

    const nextSelectedTypes = {
      models: hasModelLines || Number(returnedReview.aiCost || 0) > 0,
      infra: hasInfraLines || Number(returnedReview.infraCost || 0) > 0,
      subs: hasSubLines || Number(returnedReview.subsCost || 0) > 0,
      general: hasGeneralLines || Number(returnedReview.miscCost || 0) > 0,
    };
    setSelectedTypes(nextSelectedTypes);
    setActiveTab(["models", "infra", "subs", "general"].find((key) => nextSelectedTypes[key]) || "models");
    toast.info("Returned budget loaded — edit and resubmit", {
      description: returnedReview.ctoComment || "Address CTO comments below",
    });
  }, [returnedReview, visibleProjects, modelCatalog, modelProviderOptions, budgetTypeOptions, initialBudgetType]);

  const project = visibleProjects.find((p) => p.id === projectId);
  const budgetRetryAt = project?.budgetRetryAvailableAt || project?.budgetRejection?.retryAt || "";
  const budgetRetryAtTs = budgetRetryAt ? new Date(budgetRetryAt).getTime() : 0;
  const budgetRetryLockActive = Boolean(project?.budgetRejection) && Number.isFinite(budgetRetryAtTs) && budgetRetryAtTs > Date.now();
  const budgetRetryLabel = formatRetryDateTime(budgetRetryAt);
  const generalPhaseOptions = useMemo(() => (
    deliveryMode === "single"
      ? [{
          id: "p1",
          name: isDirectCostBudget ? `${formatBudgetTypeOptionLabel(effectiveBudgetType)} budget` : "Delivery",
        }]
      : phases.map((phase, index) => ({
          id: phase.id || `p${index + 1}`,
          name: phase.name || `Phase ${index + 1}`,
        }))
  ), [deliveryMode, effectiveBudgetType, isDirectCostBudget, phases]);

  useEffect(() => {
    if (!visibleProjects.length) {
      if (projectId) setProjectId("");
      return;
    }
    if (!visibleProjects.some((entry) => entry.id === projectId)) {
      setProjectId(visibleProjects[0]?.id || "");
    }
  }, [visibleProjects, projectId]);

  useEffect(() => {
    if (!embeddedProjectId) return;
    if (projectId === embeddedProjectId) return;
    if (visibleProjects.some((entry) => entry.id === embeddedProjectId)) {
      setProjectId(embeddedProjectId);
    }
  }, [embeddedProjectId, projectId, visibleProjects]);

  useEffect(() => {
    if (teamType !== "R&D") return;
    if (budgetTypeOptions.includes(budgetType)) return;
    setBudgetType(budgetTypeOptions[0] || "Testing");
  }, [budgetType, budgetTypeOptions, teamType]);

  useEffect(() => {
    if (!project || returnedReview || !requestedPhaseId) return;
    const requestedPhase = (project.phases || []).find((phase) => phase.id === requestedPhaseId);
    if (!requestedPhase) return;
    const [phaseStart, phaseEnd] = splitPhaseDates(requestedPhase.dates);
    setSinglePhase((current) => ({
      tasks: Number(requestedPhase.totalTasks || requestedPhase.tasks || current.tasks || 0),
      trajectories: Number(requestedPhase.trajectoriesPerTask || current.trajectories || 0),
    }));
    if (phaseStart) setSingleStart(phaseStart);
    if (phaseEnd) setSingleEnd(phaseEnd);
  }, [project, requestedPhaseId, returnedReview]);

  useEffect(() => {
    if (returnedReview || effectiveBudgetType !== "RnD" || !requestedSourceDeliveryId || !projectId || testingInfraPrefillAppliedRef.current) return;
    const latestTestingBudget = budgets
      .filter((entry) => entry.projectId === projectId && normalizeBudgetType(entry.budgetType) === "Testing")
      .sort((left, right) => new Date(right.submittedAt || 0).getTime() - new Date(left.submittedAt || 0).getTime())[0];
    const testingInfraLines = Array.isArray(latestTestingBudget?.items?.infra) ? latestTestingBudget.items.infra : [];
    if (!testingInfraLines.length) return;

    setInfra(testingInfraLines.map((line, index) => {
      const meta = EC2_INSTANCES.find((entry) => entry.code === (line.instance || line.meta?.code)) || line.meta || EC2_INSTANCES[0];
      const monthlyCost = Number(line.monthlyCost || line.meta?.monthlyCost || line.estCost || line.amount || 0);
      const provider = line.provider || line.meta?.provider || getInfraProvider(meta);
      return {
        id: line.id || `prefill-infra-${index + 1}`,
        provider,
        instance: line.instance || meta?.code || EC2_INSTANCES[0].code,
        instanceCount: getInfraInstanceCount(line.instanceCount || line.meta?.instanceCount || 1),
        monthlyCost,
        storageType: normalizeStorageTypeForProvider(
          provider,
          line.storageType || line.meta?.storageType || ""
        ),
        perInstanceStorage: getPerInstanceStorage(
          line.perInstanceStorage || line.meta?.perInstanceStorage || 100
        ),
        estCost: Number(line.estCost || line.amount || monthlyCost || 0),
      };
    }));
    setSelectedTypes((current) => ({ ...current, infra: true }));
    testingInfraPrefillAppliedRef.current = true;
  }, [budgets, effectiveBudgetType, projectId, requestedSourceDeliveryId, returnedReview]);

  const budgetDurationDays = useMemo(() => {
    if (deliveryMode === "single") return getInclusiveDayCount(singleStart, singleEnd);
    return phases.reduce((sum, phase) => sum + getInclusiveDayCount(phase.start, phase.end), 0);
  }, [deliveryMode, singleEnd, singleStart, phases]);

  // Trajectories drive model volume (tasks × trajectories × costPerTraj)
  const totalTrajectories = useMemo(() => {
    if (isDirectCostBudget) return 0;
    if (deliveryMode === "single") return Number(singlePhase.tasks || 0) * Number(singlePhase.trajectories || 0);
    return phases.reduce((s, p) => s + Number(p.tasks || 0) * Number(p.trajectories || 0), 0);
  }, [deliveryMode, singlePhase, phases, isDirectCostBudget]);

  const totalTasks = useMemo(() => {
    if (isDirectCostBudget) return 0;
    if (deliveryMode === "single") return Number(singlePhase.tasks || 0);
    return phases.reduce((s, p) => s + Number(p.tasks || 0), 0);
  }, [deliveryMode, singlePhase, phases, isDirectCostBudget]);

  const modelPricingUnits = useMemo(() => {
    if (isDirectCostBudget) return 0;
    return totalTrajectories > 0 ? totalTrajectories : totalTasks;
  }, [isDirectCostBudget, totalTasks, totalTrajectories]);

  // Recompute model estCost whenever total trajectory volume changes (keeps user-entered costPerTask)
  useEffect(() => {
    if (isDirectCostBudget) return;
    setModels((rows) => rows.map((r) => {
      const meta = modelCatalog.find((m) => m.id === r.modelId) || modelCatalog[0] || BEDROCK_MODELS[0];
      return {
        ...r,
        provider: r.provider || getModelPlatform(meta),
        estCost: Math.round(Number(r.costPerTask || 0) * modelPricingUnits * 100) / 100,
      };
    }));
  }, [modelCatalog, modelPricingUnits, isDirectCostBudget]);

  useEffect(() => {
    setInfra((rows) => rows.map((row) => {
      const provider = row.provider || getInfraProvider(EC2_INSTANCES.find((instance) => instance.code === row.instance) || EC2_INSTANCES[0]);
      const providerInstances = getInstancesForProvider(provider);
      const meta = providerInstances.find((instance) => instance.code === row.instance) || providerInstances[0] || EC2_INSTANCES[0];
      const monthlyCost = Number(row.monthlyCost || 0);
      const instanceCount = getInfraInstanceCount(row.instanceCount || 1);
      return {
        ...row,
        provider,
        instance: meta.code,
        instanceCount,
        storageType: normalizeStorageTypeForProvider(provider, row.storageType || ""),
        perInstanceStorage: getPerInstanceStorage(row.perInstanceStorage || 100),
        estCost: calculateInfraEstimate({ monthlyCost, instanceCount, days: budgetDurationDays }),
      };
    }));
    setSubs((rows) => rows.map((row) => ({
      ...row,
      estCost: Math.round((Number(row.pricePerSeat || 0) * Number(row.seats || 1) * budgetDurationDays / 30) * 100) / 100,
    })));
  }, [budgetDurationDays]);

  useEffect(() => {
    if ((isDirectCostBudget || usesRndWorkflow) && deliveryMode !== "single") setDeliveryMode("single");
  }, [isDirectCostBudget, usesRndWorkflow, deliveryMode]);

  useEffect(() => {
    setGeneralTableRows((rows) => rows.map((row) => {
      const matchedPhase = generalPhaseOptions.find((option) => option.id === row.phaseId) || generalPhaseOptions[0] || null;
      return {
        ...row,
        phaseId: row.phaseId || matchedPhase?.id || "",
        phaseName: matchedPhase?.name || row.phaseName || "",
      };
    }));
  }, [generalPhaseOptions]);

  const generalTablePreviewLines = useMemo(
    () => serializeGeneralBudgetTableRows(generalTableRows, generalTableHeaders, generalPhaseOptions),
    [generalTableRows, generalTableHeaders, generalPhaseOptions]
  );
  const generalCostSectionHeaders = useMemo(
    () => getGeneralBudgetCostHeaders(generalTableHeaders),
    [generalTableHeaders]
  );
  const hasGeneralCostSections = generalCostSectionHeaders.length > 0;
  const generalPhaseTotals = useMemo(() => {
    const totalsByPhase = generalTablePreviewLines.reduce((acc, row) => {
      const phaseId = row.phaseId || generalPhaseOptions[0]?.id || "p1";
      const phaseName = row.phaseName || generalPhaseOptions.find((option) => option.id === phaseId)?.name || "Delivery";
      acc[phaseId] = acc[phaseId] || { phaseId, phaseName, total: 0 };
      acc[phaseId].total += Number(row.amount || row.estCost || 0);
      return acc;
    }, {});
    return Object.values(totalsByPhase);
  }, [generalPhaseOptions, generalTablePreviewLines]);

  const totals = useMemo(() => {
    const m = selectedTypes.models ? models.reduce((s, x) => s + Number(x.estCost || 0), 0) : 0;
    const i = selectedTypes.infra ? infra.reduce((s, x) => s + Number(x.estCost || 0), 0) : 0;
    const su = selectedTypes.subs ? subs.reduce((s, x) => s + Number(x.estCost || 0), 0) : 0;
    const g = selectedTypes.general ? sumGeneralBudgetRows(generalTableRows, generalTableHeaders) : 0;
    return { models: m, infra: i, subs: su, general: g, total: m + i + su + g };
  }, [models, infra, subs, generalTableHeaders, generalTableRows, selectedTypes]);

  const updateRow = (setter) => (id, key, v) => setter((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: v } : r)));
  const removeRow = (setter) => (id) => setter((r) => r.filter((x) => x.id !== id));

  const updateModelRow = (id, key, v) => {
    setModels((rows) => rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [key]: v };
      if (key === "provider") {
        const providerModels = getModelsForProvider(modelCatalog, next.provider);
        const meta = providerModels.find((model) => model.id === next.modelId) || providerModels[0] || modelCatalog[0] || BEDROCK_MODELS[0];
        next.modelId = meta.id;
        next.provider = getModelPlatform(meta);
        next.costPerTask = seedCostPerTask(meta);
      }
      if (key === "modelId") {
        const meta = modelCatalog.find((m) => m.id === next.modelId) || modelCatalog[0] || BEDROCK_MODELS[0];
        next.provider = getModelPlatform(meta);
        next.costPerTask = seedCostPerTask(meta);
      }
      if (isDirectCostBudget) {
        if (key === "estCost") next.estCost = Number(v) || 0;
        return next;
      }
      next.estCost = Math.round(Number(next.costPerTask || 0) * modelPricingUnits * 100) / 100;
      return next;
    }));
  };
  const handleModelSelect = (rowId, value) => {
    if (value === ADD_CUSTOM_MODEL_OPTION) {
      const created = promptForCustomModel(addCustomModel);
      if (!created) return;
      setModels((rows) => rows.map((row) => {
        if (row.id !== rowId) return row;
        const next = {
          ...row,
          modelId: created.id,
          provider: getModelPlatform(created),
          costPerTask: seedCostPerTask(created),
        };
        if (!isDirectCostBudget) {
          next.estCost = Math.round(Number(next.costPerTask || 0) * modelPricingUnits * 100) / 100;
        }
        return next;
      }));
      toast.success("Custom model added", {
        description: `${created.name} · ${created.provider} is now available across the workspace.`,
      });
      return;
    }
    updateModelRow(rowId, "modelId", value);
  };
  const updateInfraRow = (id, key, v) => {
    setInfra((rows) => rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [key]: v };
      if (key === "instanceCount") next.instanceCount = getInfraInstanceCount(v);
      if (key === "perInstanceStorage") next.perInstanceStorage = getPerInstanceStorage(v);
      if (key === "storageType") {
        next.storageType = normalizeStorageTypeForProvider(next.provider || "", String(v || ""));
      }
      if (key === "provider") {
        const providerInstances = getInstancesForProvider(next.provider);
        const meta = providerInstances[0] || EC2_INSTANCES[0];
        next.instance = meta.code;
        next.monthlyCost = Math.round(meta.hourly * HOURS_PER_MONTH * 100) / 100;
        next.storageType = normalizeStorageTypeForProvider(next.provider, next.storageType || "");
      }
      if (key === "instance") {
        const inst = EC2_INSTANCES.find((x) => x.code === next.instance) || EC2_INSTANCES[0];
        next.provider = getInfraProvider(inst);
        next.monthlyCost = Math.round(inst.hourly * HOURS_PER_MONTH * 100) / 100;
        next.storageType = normalizeStorageTypeForProvider(next.provider, next.storageType || "");
      }
      next.estCost = calculateInfraEstimate({
        monthlyCost: Number(next.monthlyCost || 0),
        instanceCount: getInfraInstanceCount(next.instanceCount || 1),
        days: budgetDurationDays,
      });
      return next;
    }));
  };
  const updateSubRow = (id, key, v) => {
    setSubs((rows) => rows.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, [key]: v };
      if (key === "subscription") {
        const s = SUBSCRIPTION_CATALOG.find((x) => x.name === next.subscription) || SUBSCRIPTION_CATALOG[0];
        next.pricePerSeat = s.monthly;
      }
      if (["subscription", "seats", "pricePerSeat"].includes(key)) {
        next.estCost = Math.round((Number(next.pricePerSeat || 0) * Number(next.seats || 1) * budgetDurationDays / 30) * 100) / 100;
      }
      return next;
    }));
  };
  const updateSubMembers = (id, members) => {
    setSubs((rows) => rows.map((r) => {
      if (r.id !== id) return r;
      return { ...r, members, seats: Math.max(members.length, 1) };
    }));
  };
  const updateGeneralRow = (id, key, v) => {
    setGeneral((rows) => rows.map((row) => (
      row.id === id
        ? { ...row, [key]: key === "estCost" ? (Number(v) || 0) : v }
        : row
    )));
  };
  const remapGeneralTableRows = (rows, previousHeaders, nextHeaders) => rows.map((row) => {
    const nextRow = {
      ...row,
      cells: Object.fromEntries(nextHeaders.flatMap((header, index) => {
        const previousHeader = previousHeaders[index];
        const stableKey = getGeneralBudgetColumnCellKey(index);
        const value = row.cells?.[stableKey] ?? (previousHeader ? (row.cells?.[previousHeader] || "") : "");
        return [
          [header, value],
          [stableKey, value],
        ];
      })),
    };
    return {
      ...nextRow,
      estCost: calculateGeneralBudgetRowTotal(nextRow, nextHeaders),
    };
  });
  const applyGeneralTableHeaders = (nextHeadersInput) => {
    setGeneralTableHeaders((currentHeaders) => {
      const nextHeaders = normalizeGeneralBudgetHeaders(nextHeadersInput);
      setGeneralTableRows((rows) => remapGeneralTableRows(rows, currentHeaders, nextHeaders));
      return nextHeaders;
    });
  };
  const updateGeneralTableHeader = (index, value) => {
    setGeneralTableHeaders((currentHeaders) => {
      const nextHeaders = [...currentHeaders];
      nextHeaders[index] = value;
      setGeneralTableRows((rows) => remapGeneralTableRows(rows, currentHeaders, nextHeaders));
      return nextHeaders;
    });
  };
  const addGeneralCostSection = () => {
    applyGeneralTableHeaders([...generalTableHeaders, `Cost section ${generalCostSectionHeaders.length + 1}`]);
  };
  const addGeneralTableRow = () => {
    const defaultPhase = generalPhaseOptions[0] || {};
    setGeneralTableRows((rows) => [
      ...rows,
      buildEmptyGeneralBudgetTableRow({
        phaseId: defaultPhase.id || "",
        phaseName: defaultPhase.name || "",
        headers: generalTableHeaders,
      }),
    ]);
  };
  const updateGeneralTableRow = (id, key, value, columnIndex = -1) => {
    setGeneralTableRows((rows) => rows.map((row) => {
      if (row.id !== id) return row;
      if (key === "phaseId") {
        const phaseMeta = generalPhaseOptions.find((option) => option.id === value) || null;
        return {
          ...row,
          phaseId: value,
          phaseName: phaseMeta?.name || row.phaseName || "",
        };
      }
      if (key === "estCost") {
        return { ...row, estCost: Number(value) || 0 };
      }
      const nextRow = {
          ...row,
          cells: {
            ...row.cells,
            ...(columnIndex >= 0 ? { [getGeneralBudgetColumnCellKey(columnIndex)]: value } : {}),
            [key]: value,
          },
      };
      return {
        ...nextRow,
        estCost: calculateGeneralBudgetRowTotal(nextRow, generalTableHeaders),
      };
    }));
  };
  const removeGeneralTableRow = (id) => setGeneralTableRows((rows) => rows.filter((row) => row.id !== id));
  const switchGeneralMode = (nextMode) => {
    setGeneralMode(nextMode);
    if (nextMode === "requests" && general.length === 0) {
      setGeneral([emptyGeneralItem()]);
    }
    if (nextMode === "table" && generalTableRows.length === 0) {
      const defaultPhase = generalPhaseOptions[0] || {};
      setGeneralTableRows([
        buildEmptyGeneralBudgetTableRow({
          phaseId: defaultPhase.id || "",
          phaseName: defaultPhase.name || "",
          headers: generalTableHeaders,
        }),
      ]);
    }
  };
  const toggleBudgetType = (key) => {
    const currentlyEnabled = selectedTypes[key];
    if (!currentlyEnabled) {
      if (key === "general") {
        if (generalMode === "table" && generalTableRows.length === 0) {
          const defaultPhase = generalPhaseOptions[0] || {};
          setGeneralTableRows([
            buildEmptyGeneralBudgetTableRow({
              phaseId: defaultPhase.id || "",
              phaseName: defaultPhase.name || "",
              headers: generalTableHeaders,
            }),
          ]);
        }
        if (generalMode === "requests" && general.length === 0) setGeneral([emptyGeneralItem()]);
      }
      setActiveTab(key);
    } else if (activeTab === key) {
      const fallback = ["models", "infra", "subs", "general"].find((entry) => entry !== key && selectedTypes[entry]);
      if (fallback) setActiveTab(fallback);
    }
    setSelectedTypes((state) => ({ ...state, [key]: !state[key] }));
  };

  const distributedPhases = useMemo(() => {
    const baseTotal = totals.models + totals.infra + totals.subs;
    if (deliveryMode === "single") {
      return [{
        id: "p1",
        name: isDirectCostBudget ? `${formatBudgetTypeOptionLabel(effectiveBudgetType)} budget` : "Delivery",
        start: singleStart,
        end: singleEnd,
        budget: baseTotal + totals.general,
        tasks: isDirectCostBudget ? 0 : Number(singlePhase.tasks),
        trajectories: isDirectCostBudget ? 0 : Number(singlePhase.trajectories),
      }];
    }
    const tablePhaseTotals = Object.fromEntries(generalPhaseTotals.map((entry) => [entry.phaseId, entry.total]));
    const totalTraj = phases.reduce((sum, phase) => {
      const weightedTraj = Number(phase.tasks || 0) * Number(phase.trajectories || 0);
      return sum + (weightedTraj > 0 ? weightedTraj : Number(phase.tasks || 0) || 1);
    }, 0) || 1;
    let distributedBase = 0;
    return phases.map((p, index) => {
      const traj = Number(p.tasks || 0) * Number(p.trajectories || 0);
      const shareUnits = traj > 0 ? traj : Number(p.tasks || 0) || 1;
      const baseBudget = index === phases.length - 1
        ? Math.max(0, Math.round((baseTotal - distributedBase) * 100) / 100)
        : Math.max(0, Math.round(((shareUnits / totalTraj) * baseTotal) * 100) / 100);
      distributedBase += baseBudget;
      return { ...p, budget: baseBudget + Number(tablePhaseTotals[p.id] || 0) };
    });
  }, [
    deliveryMode,
    effectiveBudgetType,
    generalPhaseTotals,
    isDirectCostBudget,
    phases,
    singleEnd,
    singlePhase,
    singleStart,
    totals.general,
    totals.infra,
    totals.models,
    totals.subs,
  ]);

  const canProceedDetails = () => {
    if (!projectId) { toast.error("Select a project"); return false; }
    if (deliveryMode === "single") {
      if (!isDirectCostBudget) {
        if (!singlePhase.tasks || Number(singlePhase.tasks) <= 0) { toast.error("Enter number of tasks"); return false; }
      }
      if (!singleStart || !singleEnd) { toast.error("Set start and end date"); return false; }
    } else {
      if (!phases.length) { toast.error("Add at least one phase"); return false; }
      for (const p of phases) {
        if (!p.name || !p.start || !p.end) { toast.error(`Complete ${p.name || "phase"} details`); return false; }
        if (!p.tasks || Number(p.tasks) <= 0) { toast.error(`Enter tasks for ${p.name}`); return false; }
      }
    }
    return true;
  };
  const canProceedItems = () => {
    if (!selectedTypes.models && !selectedTypes.infra && !selectedTypes.subs && !selectedTypes.general) { toast.error("Select at least one budget type"); return false; }
    if (selectedTypes.general) {
      const populatedRows = normalizeGeneralBudgetRows(generalTableRows, generalTableHeaders)
        .filter((row) => Object.values(row.cells || {}).some((value) => String(value || "").trim()) || Number(row.estCost || 0) > 0);
      if (!populatedRows.length) { toast.error("Add at least one general budget table row"); return false; }
      if (generalPhaseOptions.length > 1 && populatedRows.some((row) => !row.phaseId)) {
        toast.error("Assign a phase to each general budget row");
        return false;
      }
    }
    if (totals.total <= 0) { toast.error("Add at least one budget item"); return false; }
    return true;
  };

  const doSubmit = () => {
    const items = {
      models: selectedTypes.models ? models.map((m) => {
        const meta = modelCatalog.find((x) => x.id === m.modelId);
        return {
          ...m,
          platform: m.provider,
          meta: meta ? { ...meta, platform: getModelPlatform(meta) } : meta,
        };
      }) : [],
      infra: selectedTypes.infra ? infra.map((i) => {
        const meta = EC2_INSTANCES.find((x) => x.code === i.instance) || EC2_INSTANCES[0];
        return {
          ...i,
          provider: i.provider || getInfraProvider(meta),
          days: budgetDurationDays,
          meta: {
            ...withInfraProvider(meta),
            monthlyCost: Number(i.monthlyCost || 0),
            instanceCount: getInfraInstanceCount(i.instanceCount || 1),
            storageType: normalizeStorageTypeForProvider(i.provider || getInfraProvider(meta), i.storageType || ""),
            perInstanceStorage: getPerInstanceStorage(i.perInstanceStorage || 100),
          },
        };
      }) : [],
      subs: selectedTypes.subs ? subs.map((entry) => ({ ...entry, days: budgetDurationDays })) : [],
      misc: selectedTypes.general ? generalTablePreviewLines : [],
    };
    submitBudget({
      projectId,
      projectName: project?.name || projectId,
      budgetType: effectiveBudgetType,
      priority,
      teamType,
      totalTasks: Number(totalTasks),
      totalTrajectories,
      delivery: { mode: deliveryMode, singleStart, singleEnd },
      phases: distributedPhases,
      items,
      totals,
      resubmitOfReviewId: returnedReview?.id || null,
      sampleIteration: isReworkBudget ? requestedSampleIteration : 1,
      sourceDeliveryId: requestedSourceDeliveryId,
    });
    toast.success(returnedReview ? "Budget resubmitted to CTO" : "Request sent to CTO", {
      description: `${project?.name || "Project"} · ${fmtCurrency(totals.total, { compact: false })} · awaiting review before tasks and delivery unlock`,
    });
    if (typeof onSubmitted === "function") {
      onSubmitted();
      return;
    }
    if (typeof onClose === "function") {
      onClose();
      return;
    }
    nav(projectId ? `/projects/${projectId}?tab=budget` : "/projects");
  };

  const stepPill = (n, label, active, done) => (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
        done ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : active ? "bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300" : "bg-white/[0.04] border-white/10 text-zinc-500"
      }`}>
        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
      </div>
      <span className={`text-xs font-medium ${done ? "text-emerald-300" : active ? "text-fuchsia-300" : "text-zinc-500"}`}>{label}</span>
    </div>
  );

  if (budgetRetryLockActive) {
    return (
      <div className="space-y-6" data-testid="page-budget-builder-locked">
        <div>
          {!embeddedProjectId && (
            <Link to={`/projects/${projectId}`} className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back to project
            </Link>
          )}
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ClipboardCheck className="w-3 h-3" /> {isRnd ? "R&D Portal · Budget Builder" : "Budget Builder"}
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">
            {project?.name || "Budget Builder"}
          </h1>
        </div>

        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-5">
          <div className="text-sm font-semibold text-red-200">
            This budget was rejected and cannot be raised again yet.
          </div>
          <div className="mt-2 text-sm text-zinc-200 leading-relaxed">
            Raise the next budget after <span className="font-semibold text-white">{budgetRetryLabel || "the retry window opens"}</span>.
            {project?.budgetRejection?.note ? ` Note from approver: ${project.budgetRejection.note}` : ""}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-budget-builder">
      {/* Header */}
      <div>
        <div>
          {!embeddedProjectId && (
            <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back</Link>
          )}
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-fuchsia-400">
            <ClipboardCheck className="w-3 h-3" /> {isRnd ? "R&D Portal · Budget Builder" : "Budget Builder"}
          </div>
          <h1 className="mt-1 font-display font-semibold text-3xl tracking-tight text-white">
            {project?.name || "New budget"}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Running total <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(totals.total, { compact: false })}</span> · {deliveryMode === "single" ? "Single phase" : `${phases.length} phases`} · {isDirectCostBudget ? <span className="text-zinc-300">{formatBudgetTypeOptionLabel(effectiveBudgetType)} direct-cost estimate</span> : totalTrajectories > 0 ? <><span className="text-zinc-300 tabular">{totalTrajectories.toLocaleString()}</span> trajectories</> : <><span className="text-zinc-300 tabular">{totalTasks.toLocaleString()}</span> task-based estimate</>}
          </p>
        </div>
      </div>

      {/* Returned review banner */}
      {returnedReview && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 flex items-start gap-3" data-testid="bb-returned-banner">
          <MessageSquareWarning className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-zinc-200 leading-relaxed">
            <div className="text-amber-200 font-semibold uppercase tracking-widest text-[10px] mb-0.5">Returned by CTO — please revise</div>
            <div><span className="text-white font-semibold">Comment:</span> {returnedReview.ctoComment || "—"}</div>
            <div className="text-[11px] text-zinc-400 mt-1">Original ask: <span className="text-white tabular">{fmtCurrency(returnedReview.requestedBudget, { compact: false })}</span> · Returned {new Date(returnedReview.ctoAt || Date.now()).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="bg-[#12121A] rounded-2xl border border-white/5 p-4 flex items-center gap-4 flex-wrap" data-testid="bb-stepper">
        {stepPill(1, "Details", step === 1, step > 1)}
        <div className="flex-1 h-px bg-white/10 min-w-[40px]" />
        {stepPill(2, "Budget Items", step === 2, step > 2)}
        <div className="flex-1 h-px bg-white/10 min-w-[40px]" />
        {stepPill(3, "Preview & Submit", step === 3, false)}
      </div>

      {/* Step 1 — Details */}
      {step === 1 && (
        <Card title="1. Basic Budget Details" testid="bb-step-details">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Project *">
              {embeddedProjectId ? (
                <div className="h-10 px-3 rounded-lg bg-white/[0.02] border border-white/10 text-sm text-zinc-100 flex items-center">
                  {project?.name || selectedProject?.name || "Selected project"}
                </div>
              ) : (
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} data-testid="bb-project" className={ipStyle}>
                  <option value="" disabled>{visibleProjects.length ? "Select a project" : "— No projects assigned to you yet —"}</option>
                  {visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.client ? ` · ${p.client}` : ""}</option>)}
                </select>
              )}
            </Field>
            <Field label="Priority *">
              <select value={priority} onChange={(e) => setPriority(e.target.value)} data-testid="bb-priority" className={ipStyle}>
                {["Low", "Medium", "High", "Critical"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Team type *" hint="Which delivery pool this budget belongs to">
              <select value={teamType} onChange={(e) => setTeamType(e.target.value)} data-testid="bb-team-type" className={ipStyle}>
                {TEAM_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamType === "R&D" ? (
              <Field label="Budget type *" hint="Testing first, then Sample delivery. Rework appears only after changes are asked.">
                <select
                  value={budgetType}
                  onChange={(e) => setBudgetType(e.target.value)}
                  data-testid="bb-budget-type"
                  className={ipStyle}
                >
                  {budgetTypeOptions.map((b) => <option key={b} value={b}>{formatBudgetTypeOptionLabel(b)}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Budget type" hint={!isRnd ? "Choose R&D budget to switch this request into the R&D budget flow." : undefined}>
                <select
                  value="Production"
                  onChange={(e) => {
                    if (e.target.value === "RnD") {
                      setTeamType("R&D");
                      setBudgetType("Testing");
                      return;
                    }
                    setBudgetType("Production");
                  }}
                  data-testid="bb-budget-type"
                  className={ipStyle}
                >
                  <option value="Production">Production</option>
                  {!isRnd && <option value="RnD">R&D budget</option>}
                </select>
              </Field>
            )}
          </div>

          {!usesRndWorkflow && (
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Project delivery</div>
              <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
                <button
                  onClick={() => setDeliveryMode("single")}
                  data-testid="bb-delivery-single"
                  className={`px-4 py-1.5 rounded-md text-xs font-medium ${deliveryMode === "single" ? "bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]" : "text-zinc-400 hover:text-zinc-100"}`}
                >
                  Single phase
                </button>
                <button
                  onClick={() => setDeliveryMode("multiple")}
                  data-testid="bb-delivery-multiple"
                  className={`px-4 py-1.5 rounded-md text-xs font-medium ${deliveryMode === "multiple" ? "bg-fuchsia-500 text-white shadow-[0_0_20px_rgba(232,25,184,0.35)]" : "text-zinc-400 hover:text-zinc-100"}`}
                >
                  Multiple phases
                </button>
              </div>
            </div>
          )}

          {deliveryMode === "single" && (
            <div className="mt-4 space-y-3" data-testid="bb-single-phase">
              {!isDirectCostBudget && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Number of tasks *">
                      <input type="number" min="1" value={singlePhase.tasks} onChange={(e) => setSinglePhase((s) => ({ ...s, tasks: e.target.value }))} data-testid="bb-single-tasks" className={ipStyle + " tabular"} />
                    </Field>
                    <Field label="Est. trajectories / task (optional)">
                      <input type="number" min="0" value={singlePhase.trajectories} onChange={(e) => setSinglePhase((s) => ({ ...s, trajectories: e.target.value }))} data-testid="bb-single-trajectories" className={ipStyle + " tabular"} />
                    </Field>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2 text-[11px] text-zinc-400" data-testid="bb-single-total-trajectories">
                    Total trajectories · <span className="text-fuchsia-300 font-semibold tabular">{(Number(singlePhase.tasks || 0) * Number(singlePhase.trajectories || 0)).toLocaleString()}</span>
                  </div>
                  {Number(singlePhase.trajectories || 0) === 0 && (
                    <div className="text-[11px] text-zinc-500">
                      No trajectories entered. Model-cost math will use task count only for this budget.
                    </div>
                  )}
                </>
              )}
              {isDirectCostBudget && (
                <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.05] px-3 py-2 text-[11px] text-sky-200" data-testid="bb-direct-cost-note">
                  {formatBudgetTypeOptionLabel(effectiveBudgetType)} budgets are raised as direct cost estimates. No task count or trajectory count is required here; add only model, infra, and subscription costs in the next step.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Start Date *">
                  <input type="date" value={singleStart} onChange={(e) => setSingleStart(e.target.value)} data-testid="bb-single-start" className={ipStyle} />
                </Field>
                <Field label="End Date *">
                  <input type="date" value={singleEnd} onChange={(e) => setSingleEnd(e.target.value)} data-testid="bb-single-end" className={ipStyle} />
                </Field>
              </div>
              <div className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2 text-[11px] text-zinc-400">
                Total days · <span className="text-fuchsia-300 font-semibold tabular">{budgetDurationDays.toLocaleString()}</span>
              </div>
            </div>
          )}

          {deliveryMode === "multiple" && !usesRndWorkflow && (
            <div className="mt-4 space-y-3" data-testid="bb-multi-phases">
              <div className="text-[11px] text-zinc-500">Multiple phases deliver the project batch-by-batch. Each phase drives its own trajectory count → total updates automatically.</div>
              {phases.map((ph, i) => (
                <div key={ph.id} data-testid={`bb-phase-${ph.id}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25">Phase {i + 1}</span>
                    {phases.length > 1 && (
                      <button
                        onClick={() => setPhases((r) => r.filter((x) => x.id !== ph.id))}
                        data-testid={`bb-phase-remove-${ph.id}`}
                        className="w-7 h-7 rounded-md text-red-400 hover:bg-red-500/15 flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Field label="Phase name">
                      <input value={ph.name} onChange={(e) => updateRow(setPhases)(ph.id, "name", e.target.value)} data-testid={`bb-phase-name-${ph.id}`} className={ipStyle} />
                    </Field>
                    <Field label="Tasks">
                      <input type="number" min="0" value={ph.tasks} onChange={(e) => updateRow(setPhases)(ph.id, "tasks", e.target.value)} data-testid={`bb-phase-tasks-${ph.id}`} className={ipStyle + " tabular"} />
                    </Field>
                    <Field label="Trajectories / task (optional)">
                      <input type="number" min="0" value={ph.trajectories} onChange={(e) => updateRow(setPhases)(ph.id, "trajectories", e.target.value)} data-testid={`bb-phase-traj-${ph.id}`} className={ipStyle + " tabular"} />
                    </Field>
                    <Field label="Sub-total trajectories">
                      <div className={ipStyle + " tabular flex items-center text-fuchsia-300"}>{(Number(ph.tasks || 0) * Number(ph.trajectories || 0)).toLocaleString()}</div>
                    </Field>
                    <Field label="Start *">
                      <input type="date" value={ph.start} onChange={(e) => updateRow(setPhases)(ph.id, "start", e.target.value)} data-testid={`bb-phase-start-${ph.id}`} className={ipStyle} />
                    </Field>
                    <Field label="End *">
                      <input type="date" value={ph.end} onChange={(e) => updateRow(setPhases)(ph.id, "end", e.target.value)} data-testid={`bb-phase-end-${ph.id}`} className={ipStyle} />
                    </Field>
                    <Field label="Total days">
                      <div className={ipStyle + " tabular flex items-center text-fuchsia-300"}>{getInclusiveDayCount(ph.start, ph.end).toLocaleString()}</div>
                    </Field>
                  </div>
                </div>
              ))}
              <Button
                onClick={() => setPhases((r) => [...r, emptyPhase(r.length + 1, plusDaysISO(r.length * 15 + 1), plusDaysISO(r.length * 15 + 15))])}
                variant="outline"
                data-testid="bb-add-phase"
                className="w-full h-10 rounded-lg border-dashed border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-300 hover:bg-fuchsia-500/10 gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Add phase
              </Button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <div className="text-xs text-zinc-400">
                {isDirectCostBudget
                  ? `${formatBudgetTypeOptionLabel(effectiveBudgetType)} estimate · direct cost only · ${budgetDurationDays.toLocaleString()} days`
                  : totalTrajectories > 0
                    ? <>Total trajectories: <span className="text-fuchsia-300 font-semibold tabular">{totalTrajectories.toLocaleString()}</span> · {totalTasks.toLocaleString()} tasks · {budgetDurationDays.toLocaleString()} days</>
                    : <>{totalTasks.toLocaleString()} tasks · trajectories optional for this budget · {budgetDurationDays.toLocaleString()} days</>}
            </div>
            <Button
              onClick={() => canProceedDetails() && setStep(2)}
              data-testid="bb-next-1"
              className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            >
              Next step <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2 — Budget Items */}
      {step === 2 && (
        <Card title="2. Budget Items" subtitle={isDirectCostBudget ? `${formatBudgetTypeOptionLabel(effectiveBudgetType)} estimate · direct model, infra, and subscription costing` : `${modelPricingUnits.toLocaleString()} pricing units · costs auto-update from step 1`} testid="bb-step-items">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Budget types</div>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { k: "models", label: "Models", desc: isDirectCostBudget ? "Direct model-cost estimate" : "AI models · cost = provider × trajectories" },
                { k: "infra", label: "Infrastructure", desc: "Enter monthly $ — daily cost auto-shown" },
                { k: "subs", label: "Subscriptions", desc: "$ per seat + assign members" },
                { k: "general", label: "General", desc: "Freelancers, tools, APIs, datasets, licenses, and other external project costs" },
              ].map((t) => {
                const on = selectedTypes[t.k];
                return (
                  <button
                    key={t.k}
                    onClick={() => toggleBudgetType(t.k)}
                    data-testid={`bb-type-${t.k}`}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      on ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-zinc-100"
                    }`}
                    title={t.desc}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 border-b border-white/5 flex items-center gap-4">
            {[
              { k: "models", label: "Models" },
              { k: "infra", label: "Infrastructure" },
              { k: "subs", label: "Subscriptions" },
              { k: "general", label: "General" },
            ].filter((t) => selectedTypes[t.k]).map((t) => (
              <button
                key={t.k}
                onClick={() => setActiveTab(t.k)}
                data-testid={`bb-tab-${t.k}`}
                className={`px-2 pb-3 text-sm font-medium transition-colors relative ${
                  activeTab === t.k ? "text-fuchsia-300" : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {t.label}
                {activeTab === t.k && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-fuchsia-500" />}
              </button>
            ))}
          </div>

          {/* Models */}
          {activeTab === "models" && selectedTypes.models && (
            <div className="mt-4" data-testid="bb-pane-models">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-fuchsia-300" />
                  <div className="text-sm font-semibold text-white">{isDirectCostBudget ? "AI Models · direct estimate" : "AI Models"}</div>
                  <span className="text-[11px] text-zinc-500">
                    {isDirectCostBudget ? "· enter the model-cost estimate directly" : "· choose provider first, then the matching model"}
                  </span>
                </div>
                <Button size="sm" onClick={() => setModels((r) => [...r, emptyModelItem(modelCatalog, isDirectCostBudget ? 0 : modelPricingUnits)])} data-testid="bb-add-model" className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add model
                </Button>
              </div>
              <div className="space-y-1.5">
                <div className={`grid ${isDirectCostBudget ? "grid-cols-[.9fr_1.45fr_1fr_1fr_28px]" : "grid-cols-[.9fr_1.3fr_1fr_1fr_1fr_28px]"} gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pb-1 border-b border-white/5`}>
                  <span>Provider</span>
                  <span>Model</span>
                  <span>Usage tag</span>
                  {!isDirectCostBudget && <span className="text-right">Cost / task ($)</span>}
                  <span className="text-right">Est. cost</span>
                  <span />
                </div>
                {models.map((r) => {
                  const providerModels = getModelsForProvider(modelCatalog, r.provider || modelProviderOptions[0] || "");
                  const meta = providerModels.find((m) => m.id === r.modelId) || modelCatalog.find((m) => m.id === r.modelId) || providerModels[0] || modelCatalog[0];
                  return (
                    <div key={r.id} data-testid={`bb-row-model-${r.id}`} className={`grid ${isDirectCostBudget ? "grid-cols-[.9fr_1.45fr_1fr_1fr_28px]" : "grid-cols-[.9fr_1.3fr_1fr_1fr_1fr_28px]"} gap-2 items-center py-1`}>
                      <select
                        value={r.provider || modelProviderOptions[0] || ""}
                        onChange={(e) => updateModelRow(r.id, "provider", e.target.value)}
                        data-testid={`bb-model-provider-${r.id}`}
                        className={rowInp}
                      >
                        {modelProviderOptions.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                      </select>
                      <select value={meta?.id || r.modelId} onChange={(e) => handleModelSelect(r.id, e.target.value)} data-testid={`bb-model-select-${r.id}`} className={rowInp}>
                        {providerModels.map((m) => <option key={m.id} value={m.id}>{buildModelOptionLabel(m)}</option>)}
                        <option value={ADD_CUSTOM_MODEL_OPTION}>+ Add new model...</option>
                      </select>
                      <select
                        value={r.usageTag || "Trajectory building"}
                        onChange={(e) => updateModelRow(r.id, "usageTag", e.target.value)}
                        data-testid={`bb-model-usage-tag-${r.id}`}
                        className={rowInp}
                      >
                        <option value="Trajectory building">Trajectory building</option>
                        <option value="QC checks">QC checks</option>
                      </select>
                      {!isDirectCostBudget && (
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={r.costPerTask}
                          onChange={(e) => updateModelRow(r.id, "costPerTask", e.target.value)}
                          data-testid={`bb-model-cost-per-task-${r.id}`}
                          className={rowInp + " tabular text-right"}
                        />
                      )}
                      {isDirectCostBudget ? (
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={r.estCost}
                          onChange={(e) => updateModelRow(r.id, "estCost", e.target.value)}
                          data-testid={`bb-model-estimate-${r.id}`}
                          className={rowInp + " tabular text-right"}
                        />
                      ) : (
                      <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-fuchsia-300 tabular text-right leading-8" data-testid={`bb-model-est-cost-${r.id}`}>{fmtCurrency(r.estCost, { compact: false })}</div>
                      )}
                      <RemoveBtn onClick={() => removeRow(setModels)(r.id)} testid={`bb-model-remove-${r.id}`} />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                {isDirectCostBudget
                  ? <>Direct model-cost total: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(totals.models, { compact: false })}</span></>
                  : totalTrajectories > 0
                    ? <>Formula: <span className="text-fuchsia-300 font-semibold tabular">{totalTasks.toLocaleString()}</span> tasks × <span className="text-fuchsia-300 font-semibold tabular">{deliveryMode === "single" ? singlePhase.trajectories : "avg"}</span> trajectories/task × cost/task · Total models: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(totals.models, { compact: false })}</span></>
                    : <>Formula: <span className="text-fuchsia-300 font-semibold tabular">{totalTasks.toLocaleString()}</span> tasks × cost/task · Total models: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(totals.models, { compact: false })}</span></>}
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Tag each model as <span className="text-zinc-300 font-medium">Trajectory building</span> or <span className="text-zinc-300 font-medium">QC checks</span> so review and delivery screens can track what the model budget is meant for.
              </div>
            </div>
          )}

          {/* Infra */}
          {activeTab === "infra" && selectedTypes.infra && (
            <div className="mt-4" data-testid="bb-pane-infra">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-fuchsia-300" />
                  <div className="text-sm font-semibold text-white">Infrastructure · monthly spend</div>
                  <span className="text-[11px] text-zinc-500">· provider, instance count, storage type, and total cost kept in one clean card</span>
                </div>
                <Button size="sm" onClick={() => setInfra((r) => [...r, emptyInfraItem(budgetDurationDays)])} data-testid="bb-add-infra" className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add instance
                </Button>
              </div>
              <div className="space-y-1.5">
                <div className="grid grid-cols-[.85fr_1.55fr_1fr_.7fr_.9fr_.9fr_28px] gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pb-1 border-b border-white/5">
                  <span>Provider</span><span>Infra instance</span><span className="text-right">Monthly cost ($)</span><span className="text-right">Days</span><span className="text-right">≈ $/day</span><span className="text-right">Est. cost</span><span />
                </div>
                {infra.map((r) => {
                  const provider = r.provider || infraProviderOptions[0] || getInfraProvider(EC2_INSTANCES[0]);
                  const providerInstances = getInstancesForProvider(provider);
                  const storageOptions = getStorageTypesForProvider(provider);
                  const perDay = getInfraTotalDailyRate({
                    monthlyCost: Number(r.monthlyCost || 0),
                    instanceCount: getInfraInstanceCount(r.instanceCount || 1),
                  });
                  return (
                    <div key={r.id} data-testid={`bb-row-infra-${r.id}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="grid grid-cols-1 md:grid-cols-[.85fr_1.6fr_.9fr_.7fr_28px] gap-2 items-end">
                        <CompactField label="Provider">
                          <select value={provider} onChange={(e) => updateInfraRow(r.id, "provider", e.target.value)} data-testid={`bb-infra-provider-${r.id}`} className={`${rowInp} w-full`}>
                            {infraProviderOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </CompactField>
                        <CompactField label="Infra instance">
                          <select value={r.instance} onChange={(e) => updateInfraRow(r.id, "instance", e.target.value)} data-testid={`bb-infra-select-${r.id}`} className={`${rowInp} w-full`}>
                            {providerInstances.map((i) => <option key={i.code} value={i.code}>{i.code} · {i.family} · {i.vCPU} vCPU · {i.memoryGiB} GiB</option>)}
                          </select>
                        </CompactField>
                        <CompactField label="Monthly cost / instance ($)">
                          <input type="number" min="0" step="10" value={r.monthlyCost} onChange={(e) => updateInfraRow(r.id, "monthlyCost", e.target.value)} data-testid={`bb-infra-monthly-${r.id}`} className={`${rowInp} w-full tabular text-right`} />
                        </CompactField>
                        <CompactField label="No. of instances">
                          <input type="number" min="1" step="1" value={r.instanceCount || 1} onChange={(e) => updateInfraRow(r.id, "instanceCount", e.target.value)} data-testid={`bb-infra-count-${r.id}`} className={`${rowInp} w-full tabular text-right`} />
                        </CompactField>
                        <div className="flex items-end justify-end h-full">
                          <RemoveBtn onClick={() => removeRow(setInfra)(r.id)} testid={`bb-infra-remove-${r.id}`} />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_.65fr_.8fr_.85fr] gap-2 items-end">
                        <CompactField label="Storage type">
                          <select value={normalizeStorageTypeForProvider(provider, r.storageType || "")} onChange={(e) => updateInfraRow(r.id, "storageType", e.target.value)} data-testid={`bb-infra-storage-type-${r.id}`} className={`${rowInp} w-full`}>
                            {storageOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </CompactField>
                        <CompactField label="Per instance storage (GB)">
                          <input type="number" min="0" step="10" value={r.perInstanceStorage ?? 100} onChange={(e) => updateInfraRow(r.id, "perInstanceStorage", e.target.value)} data-testid={`bb-infra-storage-size-${r.id}`} className={`${rowInp} w-full tabular text-right`} />
                        </CompactField>
                        <CompactField label="Days">
                          <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-fuchsia-300 tabular text-right leading-8">{budgetDurationDays.toLocaleString()}</div>
                        </CompactField>
                        <CompactField label="≈ $/day">
                          <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-zinc-300 tabular text-right leading-8">{fmtCurrency(perDay, { compact: false })}</div>
                        </CompactField>
                        <CompactField label="Est. cost">
                          <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-fuchsia-300 tabular text-right leading-8">{fmtCurrency(r.estCost, { compact: false })}</div>
                        </CompactField>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                Total infrastructure: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(totals.infra, { compact: false })}</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Duration comes from the selected phase dates: <span className="text-zinc-300 font-medium">{budgetDurationDays.toLocaleString()} days</span>.
              </div>
            </div>
          )}

          {/* Subs */}
          {activeTab === "subs" && selectedTypes.subs && (
            <div className="mt-4" data-testid="bb-pane-subs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-fuchsia-300" />
                  <div className="text-sm font-semibold text-white">Subscriptions · seat-based</div>
                  <span className="text-[11px] text-zinc-500">· choose the project members who should get access to each subscription</span>
                </div>
                <Button size="sm" onClick={() => setSubs((r) => [...r, emptySubItem()])} data-testid="bb-add-sub" className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Add subscription
                </Button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-[1.25fr_.78fr_.55fr_.72fr_.9fr_1.35fr_28px] gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pb-1 border-b border-white/5">
                  <span>Subscription</span>
                  <span className="text-right">Price / seat / month ($)</span>
                  <span className="text-right">Seats</span>
                  <span className="text-right">Days</span>
                  <span className="text-right">Est. cost</span>
                  <span>Members</span>
                  <span />
                </div>
                {subs.map((r) => (
                  <div key={r.id} data-testid={`bb-row-sub-${r.id}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="grid grid-cols-[1.25fr_.78fr_.55fr_.72fr_.9fr_1.35fr_28px] gap-2 items-start">
                      <select value={r.subscription} onChange={(e) => updateSubRow(r.id, "subscription", e.target.value)} data-testid={`bb-sub-select-${r.id}`} className={rowInp}>
                        {SUBSCRIPTION_CATALOG.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                      <input type="number" min="0" step="1" value={r.pricePerSeat} onChange={(e) => updateSubRow(r.id, "pricePerSeat", e.target.value)} data-testid={`bb-sub-price-${r.id}`} className={rowInp + " tabular text-right"} title="$ per seat / month" />
                      <input type="number" min="1" value={r.seats} onChange={(e) => updateSubRow(r.id, "seats", e.target.value)} className={rowInp + " tabular text-right"} title="Seats" />
                      <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-fuchsia-300 tabular text-right leading-8">{budgetDurationDays.toLocaleString()}</div>
                      <div className="h-8 px-2 rounded-md bg-white/[0.02] border border-white/5 text-xs text-fuchsia-300 tabular text-right leading-8">{fmtCurrency(r.estCost, { compact: false })}</div>
                      <div data-testid={`bb-sub-members-${r.id}`}>
                        {subscriptionMemberPool.length === 0 ? (
                          <div className="min-h-[72px] rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-500">
                            Add members to this project first. The current project roster will appear here for subscription access selection.
                          </div>
                        ) : (
                          <>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  data-testid={`bb-sub-member-trigger-${r.id}`}
                                  className="w-full min-h-[40px] rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-left text-xs text-zinc-100 hover:bg-white/[0.07] transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate">{r.members.length ? `${r.members.length} member${r.members.length === 1 ? "" : "s"} selected` : "Select members"}</span>
                                    <span className="text-zinc-500"><UserPlus className="w-3.5 h-3.5" /></span>
                                  </div>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="start"
                                className="w-[320px] max-h-72 overflow-y-auto border border-white/10 bg-[#12121A] text-zinc-100"
                              >
                                {subscriptionMemberPool.map((member) => {
                                  const checked = r.members.includes(member.name);
                                  const subtitle = member.email || member.role || "Project member";
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={member.id}
                                      checked={checked}
                                      onSelect={(event) => event.preventDefault()}
                                      onCheckedChange={(nextChecked) => updateSubMembers(
                                        r.id,
                                        nextChecked
                                          ? Array.from(new Set([...r.members, member.name]))
                                          : r.members.filter((entry) => entry !== member.name)
                                      )}
                                      className="items-start gap-2 py-2 text-xs"
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate">{member.name}</div>
                                        <div className="truncate text-[10px] text-zinc-500">{subtitle}</div>
                                      </div>
                                    </DropdownMenuCheckboxItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <div className="mt-1 text-[11px] text-zinc-500 leading-relaxed">
                              {r.members.length
                                ? `Selected: ${r.members.join(", ")}`
                                : "Choose one or more members to allocate this subscription."}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="pt-1">
                        <RemoveBtn onClick={() => removeRow(setSubs)(r.id)} testid={`bb-sub-remove-${r.id}`} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                Total subscriptions: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(totals.subs, { compact: false })}</span>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Subscription estimates are prorated over <span className="text-zinc-300 font-medium">{budgetDurationDays.toLocaleString()} days</span>.
              </div>
            </div>
          )}

          {/* General */}
      {activeTab === "general" && selectedTypes.general && (
            <div className="mt-4" data-testid="bb-pane-general">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-fuchsia-300" />
                  <div className="text-sm font-semibold text-white">General budget requests</div>
                  <span className="text-[11px] text-zinc-500">· freelancers, external tools, datasets, APIs, licenses, and other operational asks</span>
                </div>
              </div>
              {!usesRndWorkflow && (
                <div className="mb-3 rounded-xl border border-sky-500/20 bg-sky-500/[0.05] px-3 py-2 text-[11px] text-sky-200">
                  Use the phases created in step 1 for TPM or ops asks. Add one or more cost sections here and each row will auto-sum into the phase total and project total budget.
                </div>
              )}
              {generalMode === "requests" ? (
                <>
                  <div className="flex justify-end mb-3">
                    <Button size="sm" onClick={() => setGeneral((rows) => [...rows, emptyGeneralItem()])} data-testid="bb-add-general" className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1">
                      <Plus className="w-3 h-3" /> Add request
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-[1.1fr_1.6fr_.9fr_28px] gap-2 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 pb-1 border-b border-white/5">
                      <span>Expense / request title</span>
                      <span>Vendor / note</span>
                      <span className="text-right">Cost ($)</span>
                      <span />
                    </div>
                    {general.map((row) => (
                      <div key={row.id} data-testid={`bb-row-general-${row.id}`} className="grid grid-cols-[1.1fr_1.6fr_.9fr_28px] gap-2 items-center py-1">
                        <input
                          value={row.label}
                          onChange={(e) => updateGeneralRow(row.id, "label", e.target.value)}
                          data-testid={`bb-general-label-${row.id}`}
                          placeholder="e.g. Fiverr task, external dataset"
                          className={rowInp}
                        />
                        <input
                          value={row.note}
                          onChange={(e) => updateGeneralRow(row.id, "note", e.target.value)}
                          data-testid={`bb-general-note-${row.id}`}
                          placeholder="Vendor, purpose, or dependency note"
                          className={rowInp}
                        />
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={row.estCost}
                          onChange={(e) => updateGeneralRow(row.id, "estCost", e.target.value)}
                          data-testid={`bb-general-cost-${row.id}`}
                          className={rowInp + " tabular text-right"}
                        />
                        <RemoveBtn onClick={() => removeRow(setGeneral)(row.id)} testid={`bb-general-remove-${row.id}`} />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Table headers</div>
                        <div className="text-[11px] text-zinc-500 mt-1">Create the columns you need, add cost sections, then add phase-wise rows underneath.</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          type="button"
                          onClick={addGeneralCostSection}
                          data-testid="bb-general-add-cost-header"
                          className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add cost section
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => applyGeneralTableHeaders([...generalTableHeaders, `Column ${generalTableHeaders.length + 1}`])}
                          data-testid="bb-general-add-header"
                          className="h-8 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-200 text-xs gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add header
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {generalTableHeaders.map((header, index) => (
                        <div key={`general-header-${index}`} className="flex items-center gap-1">
                          <input
                            value={header}
                            onChange={(e) => updateGeneralTableHeader(index, e.target.value)}
                            onBlur={() => applyGeneralTableHeaders(generalTableHeaders)}
                            data-testid={`bb-general-header-${index}`}
                            className={`${rowInp} min-w-[150px] ${isGeneralBudgetCostHeader(header) ? "tabular text-right" : ""}`}
                          />
                          {generalTableHeaders.length > 1 && (
                            <button
                              type="button"
                              onClick={() => applyGeneralTableHeaders(generalTableHeaders.filter((_, headerIndex) => headerIndex !== index))}
                              data-testid={`bb-general-remove-header-${index}`}
                              className="w-7 h-7 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-300 flex items-center justify-center"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button size="sm" onClick={addGeneralTableRow} data-testid="bb-add-general-table-row" className="h-8 rounded-md bg-fuchsia-500/15 hover:bg-fuchsia-500/25 border border-fuchsia-500/25 text-fuchsia-300 text-xs gap-1">
                      <Plus className="w-3 h-3" /> Add row
                    </Button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
                          <th className="py-2 px-3 text-left">Phase</th>
                          {generalTableHeaders.map((header) => (
                            <th key={header} className={`py-2 px-3 ${isGeneralBudgetCostHeader(header) ? "text-right" : "text-left"}`}>{header}</th>
                          ))}
                          <th className="py-2 px-3 text-right">{hasGeneralCostSections ? "Total ($)" : "Cost ($)"}</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {generalTableRows.map((row) => (
                          <tr key={row.id} data-testid={`bb-row-general-table-${row.id}`} className="border-b border-white/5 last:border-b-0">
                            <td className="py-2 px-3">
                              <select
                                value={row.phaseId || generalPhaseOptions[0]?.id || ""}
                                onChange={(e) => updateGeneralTableRow(row.id, "phaseId", e.target.value)}
                                data-testid={`bb-general-phase-${row.id}`}
                                className={`${rowInp} w-full`}
                              >
                                {generalPhaseOptions.map((option) => (
                                  <option key={option.id} value={option.id}>{option.name}</option>
                                ))}
                              </select>
                            </td>
                            {generalTableHeaders.map((header, index) => (
                              <td key={`${row.id}-${index}`} className="py-2 px-3">
                                <input
                                  type={isGeneralBudgetCostHeader(header) ? "number" : "text"}
                                  min={isGeneralBudgetCostHeader(header) ? "0" : undefined}
                                  step={isGeneralBudgetCostHeader(header) ? "10" : undefined}
                                  value={row.cells?.[getGeneralBudgetColumnCellKey(index)] ?? row.cells?.[header] ?? ""}
                                  onChange={(e) => updateGeneralTableRow(row.id, header, e.target.value, index)}
                                  data-testid={`bb-general-cell-${row.id}-${header}`}
                                  className={`${rowInp} w-full ${isGeneralBudgetCostHeader(header) ? "tabular text-right" : ""}`}
                                />
                              </td>
                            ))}
                            <td className="py-2 px-3">
                              {hasGeneralCostSections ? (
                                <div
                                  data-testid={`bb-general-table-cost-${row.id}`}
                                  className={`${rowInp} w-full tabular text-right bg-white/[0.02] border-white/5 text-fuchsia-300 flex items-center justify-end`}
                                >
                                  {fmtCurrency(row.estCost, { compact: false })}
                                </div>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  step="10"
                                  value={row.estCost}
                                  onChange={(e) => updateGeneralTableRow(row.id, "estCost", e.target.value)}
                                  data-testid={`bb-general-table-cost-${row.id}`}
                                  className={`${rowInp} w-full tabular text-right`}
                                />
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <RemoveBtn onClick={() => removeGeneralTableRow(row.id)} testid={`bb-general-table-remove-${row.id}`} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {generalPhaseTotals.map((entry) => (
                      <div key={entry.phaseId} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                        <div className="text-zinc-500">{entry.phaseName}</div>
                        <div className="text-white font-semibold tabular">{fmtCurrency(entry.total, { compact: false })}</div>
                      </div>
                    ))}
                    <div className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/[0.06] px-3 py-2 text-xs">
                      <div className="text-zinc-400">General total</div>
                      <div className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(totals.general, { compact: false })}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                      <div className="text-zinc-400">Project total budget</div>
                      <div className="text-white font-semibold tabular">{fmtCurrency(totals.total, { compact: false })}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-2 text-[11px] text-zinc-500">
                Total general requests: <span className="text-fuchsia-300 font-semibold tabular">{fmtCurrency(totals.general, { compact: false })}</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button onClick={() => setStep(1)} variant="outline" data-testid="bb-back-2" className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Previous
            </Button>
            <Button
              onClick={() => canProceedItems() && setStep(3)}
              data-testid="bb-next-2"
              className="h-9 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)]"
            >
              Next step <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3 — Preview */}
      {step === 3 && (
        <div className="space-y-4">
          <Card title="3. Preview & Submit" subtitle="Final review before submitting" testid="bb-step-preview">
            <div className={`grid grid-cols-2 ${isDirectCostBudget ? "md:grid-cols-4" : "md:grid-cols-5"} gap-3 mb-4`}>
              <MiniStat label="Total budget" value={fmtCurrency(totals.total, { compact: false })} tone="magenta" />
              {!isDirectCostBudget && <MiniStat label="Trajectories" value={totalTrajectories.toLocaleString()} />}
              <MiniStat label={isDirectCostBudget ? "Budget type" : "Tasks"} value={isDirectCostBudget ? formatBudgetTypeOptionLabel(effectiveBudgetType) : totalTasks.toLocaleString()} />
              <MiniStat label="Team type" value={teamType} />
              <MiniStat label="Delivery" value={deliveryMode === "single" ? "Single phase" : `${phases.length} phases`} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <BudgetCategoryAccordion
                sections={[
                  selectedTypes.models ? {
                    id: "models",
                    title: "Models",
                    total: totals.models,
                    subtitle: `${models.length} line${models.length === 1 ? "" : "s"}`,
                    rows: models.map((row) => {
                      const meta = modelCatalog.find((entry) => entry.id === row.modelId) || null;
                      return {
                        id: row.id,
                        title: meta ? buildModelOptionLabel(meta) : row.modelId || "Model line",
                        subtitle: `${row.provider || meta?.provider || "Provider"} · ${row.usageTag || "Model usage"}`,
                        detail: !isDirectCostBudget ? `Cost / task ${Number(row.costPerTask || 0).toLocaleString()}` : "Direct model-cost entry",
                        amount: Number(row.estCost || 0),
                      };
                    }),
                  } : null,
                  selectedTypes.infra ? {
                    id: "infra",
                    title: "Infrastructure",
                    total: totals.infra,
                    subtitle: `${infra.length} line${infra.length === 1 ? "" : "s"}`,
                    rows: infra.map((row) => ({
                      id: row.id,
                      title: row.instance || "Infra line",
                      subtitle: `${row.provider || "Provider"} · ${budgetDurationDays.toLocaleString()} days`,
                      detail: `${Number(row.instanceCount || 1).toLocaleString()} instance${Number(row.instanceCount || 1) === 1 ? "" : "s"} · ${row.storageType || "Storage"} · ${Number(row.perInstanceStorage || 0).toLocaleString()} GB / instance · ${fmtCurrency(Number(row.monthlyCost || 0), { compact: false })}/month each`,
                      amount: Number(row.estCost || 0),
                    })),
                  } : null,
                  selectedTypes.subs ? {
                    id: "subs",
                    title: "Subscriptions",
                    total: totals.subs,
                    subtitle: `${subs.length} line${subs.length === 1 ? "" : "s"}`,
                    rows: subs.map((row) => ({
                      id: row.id,
                      title: row.subscription || "Subscription line",
                      subtitle: row.members.length ? row.members.join(", ") : "No members selected yet",
                      detail: `${Number(row.seats || 0).toLocaleString()} seat${Number(row.seats || 0) === 1 ? "" : "s"} · ${fmtCurrency(Number(row.pricePerSeat || 0), { compact: false })}/seat/month`,
                      amount: Number(row.estCost || 0),
                    })),
                  } : null,
                  selectedTypes.general ? {
                    id: "general",
                    title: "General",
                    total: totals.general,
                    subtitle: `${generalTablePreviewLines.length} row${generalTablePreviewLines.length === 1 ? "" : "s"}`,
                    rows: generalTablePreviewLines.map((row) => ({
                      id: row.id,
                      title: row.optionLabel || row.label || "General line",
                      subtitle: row.phaseName || "Project-wide",
                      detail: row.note || "",
                      amount: Number(row.amount || row.estCost || 0),
                    })),
                  } : null,
                ].filter(Boolean)}
              />
              <SummaryCard title="Phase summary" rows={distributedPhases.map((p) => ({ id: p.id, k: `${p.name} · ${p.start || ""} → ${p.end || ""}`, v: p.budget }))} />
            </div>
            {selectedTypes.general && generalMode === "table" && (
              <div className="mt-4">
                <GeneralBudgetTableCard
                  lines={generalTablePreviewLines}
                  title="General budget table preview"
                  subtitle="This phase-wise table is what CTO and CFO will review."
                  testid="bb-general-table-preview"
                />
              </div>
            )}
            <div className="mt-4 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-4 flex items-start gap-3 text-xs">
              <Sparkles className="w-4 h-4 text-fuchsia-300 mt-0.5 flex-shrink-0" />
              <div className="text-zinc-300">
                <span className="text-fuchsia-200 font-semibold">AI insight: </span>
                Model spend ({fmtCurrency(totals.models, { compact: false })}) is <span className="text-fuchsia-300 font-semibold">{totals.total ? Math.round((totals.models / totals.total) * 100) : 0}%</span> of total. {isDirectCostBudget ? "This estimate is set up as a direct pre-delivery budget, so approvals will review model, infra, and subscription cost only." : totalTrajectories > 5000 ? "High trajectory count — consider a cheaper primary model to reduce variance." : "Trajectory-driven estimate is balanced against the selected infrastructure mix."}
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <Button onClick={() => setStep(2)} variant="outline" data-testid="bb-back-3" className="h-9 rounded-lg border-white/10 bg-white/[0.04] text-zinc-200 gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Previous
            </Button>
            <Button onClick={doSubmit} data-testid="bb-submit" className="h-10 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white gap-2 shadow-[0_0_20px_rgba(232,25,184,0.35)] px-5">
              <Send className="w-4 h-4" /> {returnedReview ? "Resubmit budget" : "Submit budget"}
            </Button>
          </div>
        </div>
      )}
      {user && null}
    </div>
  );
};

const ipStyle = "w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40";
const rowInp = "h-8 px-2 rounded-md bg-white/[0.04] border border-white/10 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40";

const Card = ({ title, subtitle, children, testid }) => (
  <div className="bg-[#12121A] rounded-2xl border border-white/5 p-5" data-testid={testid}>
    <div className="mb-4">
      <div className="font-display font-semibold text-lg text-white">{title}</div>
      {subtitle && <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>}
    </div>
    {children}
  </div>
);

const Field = ({ label, hint, children }) => (
  <div>
    <div className="flex items-baseline justify-between mb-1.5">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      {hint && <div className="text-[10px] text-zinc-600">{hint}</div>}
    </div>
    {children}
  </div>
);

const CompactField = ({ label, children }) => (
  <div>
    <div className="mb-1 text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
    {children}
  </div>
);

const RemoveBtn = ({ onClick, testid }) => (
  <button onClick={onClick} data-testid={testid} className="w-7 h-7 rounded-md hover:bg-red-500/20 text-zinc-500 hover:text-red-300 flex items-center justify-center">
    <Trash2 className="w-3 h-3" />
  </button>
);

const MiniStat = ({ label, value, tone = "neutral" }) => {
  const tones = { positive: "text-emerald-300", negative: "text-red-300", warning: "text-amber-300", neutral: "text-white", magenta: "text-fuchsia-300" };
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular ${tones[tone]}`}>{value}</div>
    </div>
  );
};

const BudgetCategoryAccordion = ({ sections }) => (
  <div className="bg-[#0F0F17] rounded-xl border border-white/5 p-4">
    <div className="text-[13px] font-semibold text-white mb-2">Category summary</div>
    {sections.length === 0 ? (
      <div className="text-xs text-zinc-500">No items</div>
    ) : (
      <Accordion type="multiple" className="w-full">
        {sections.map((section) => (
          <AccordionItem key={section.id} value={section.id} className="border-white/5">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex w-full items-center justify-between gap-3 pr-3">
                <div className="text-left">
                  <div className="text-xs font-semibold text-white">{section.title}</div>
                  <div className="text-[11px] text-zinc-500">{section.subtitle}</div>
                </div>
                <div className="text-xs font-semibold text-white tabular">{fmtCurrency(section.total, { compact: false })}</div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-0">
              <div className="space-y-2">
                {section.rows.map((row) => (
                  <div key={row.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white">{row.title}</div>
                        {row.subtitle && <div className="mt-0.5 text-[11px] text-zinc-500">{row.subtitle}</div>}
                        {row.detail && <div className="mt-1 text-[11px] text-zinc-400">{row.detail}</div>}
                      </div>
                      <div className="text-xs font-semibold text-fuchsia-300 tabular">{fmtCurrency(row.amount, { compact: false })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    )}
  </div>
);

const SummaryCard = ({ title, rows }) => (
  <div className="bg-[#0F0F17] rounded-xl border border-white/5 p-4">
    <div className="text-[13px] font-semibold text-white mb-2">{title}</div>
    <div className="space-y-1.5">
      {rows.length === 0 && <div className="text-xs text-zinc-500">No items</div>}
      {rows.map((r, i) => (
        <div key={r.id || `${r.k}-${i}`} className="flex items-center justify-between text-xs">
          <span className="text-zinc-300 truncate flex-1 mr-2">{r.k}</span>
          <span className="text-white font-semibold tabular">{fmtCurrency(r.v, { compact: false })}</span>
        </div>
      ))}
    </div>
  </div>
);

// AlertTriangle used inline where needed via imports; keep exported default only.

export default BudgetBuilder;
