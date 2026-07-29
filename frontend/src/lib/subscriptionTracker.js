// Helpers to surface the imported subscription tracker (data/subscriptionTracker.js) in context.
import { SUBSCRIPTION_ALLOCATIONS } from "../data/subscriptionTracker";

const norm = (value) => String(value || "").trim().toLowerCase();
const compact = (value) => norm(value).replace(/[^a-z0-9]/g, "");
const firstToken = (value) => norm(value).split(/[\s\-,]+/)[0] || "";

// Match a project's tracker subscriptions by its internal name / client name (case-insensitive),
// falling back to the codename first token so e.g. "Talos-Safety" matches "Talos".
export const getProjectSubscriptions = (project) => {
  if (!project) return [];
  const projectNames = [project.name, project.clientProjectName, project.client, project.codeName, project.codename].filter(Boolean);
  const names = new Set(projectNames.map(compact).filter(Boolean));
  const tokens = new Set(projectNames.map(firstToken).filter(Boolean));
  return SUBSCRIPTION_ALLOCATIONS.filter((row) => {
    const rowProject = norm(row.project);
    if (!rowProject || rowProject === "unassigned") return false;
    if (names.has(compact(rowProject))) return true;
    return tokens.size > 0 && tokens.has(firstToken(row.project));
  });
};

const phaseNumber = (value) => {
  const match = norm(value).match(/(?:phase|batch|stage)?\s*(\d+)/);
  return match ? Number(match[1]) : null;
};

export const getPhaseSubscriptions = (rows = [], phase, phaseIndex = -1) => {
  if (!phase) return [];
  const phaseNames = [phase.name, phase.label, phase.title].map(compact).filter(Boolean);
  const expectedNumber = phaseNumber(phase.name) || (phaseIndex >= 0 ? phaseIndex + 1 : null);
  return rows.filter((row) => {
    if (phaseNames.includes(compact(row.phase))) return true;
    const rowNumber = phaseNumber(row.phase);
    return expectedNumber !== null && rowNumber === expectedNumber;
  });
};

// Roll member-level tracker rows into the shape consumed by the Budget Track cards.
export const groupSubscriptionAllocations = (rows = []) => {
  const grouped = new Map();
  rows.forEach((row, index) => {
    const key = compact(row.sub) || `subscription-${index}`;
    const current = grouped.get(key) || {
      id: `tracker-${key}`,
      label: row.sub || "Subscription",
      amount: 0,
      seats: 0,
      members: [],
      detail: "Subscription tracker · consumed",
      tracker: true,
    };
    current.amount += Number(row.amount || 0);
    current.seats += 1;
    current.members.push({ id: row.emp || row.email || `${key}-${index}`, name: row.name, email: row.email });
    grouped.set(key, current);
  });
  return Array.from(grouped.values());
};

export const getMemberSubscriptions = (email) => {
  const key = norm(email);
  if (!key) return [];
  return SUBSCRIPTION_ALLOCATIONS.filter((row) => norm(row.email) === key);
};

// Return only tracker cost that is not already represented by a member-level
// subscription allocation in an approved budget item.
export const getProjectSubscriptionBudget = (project, subscriptionItems = []) => {
  const rows = getProjectSubscriptions(project);
  const approvedAmountBySubscription = new Map();
  (subscriptionItems || []).forEach((item) => {
    const subscription = compact(item?.optionLabel || item?.subscription || item?.label);
    approvedAmountBySubscription.set(subscription, (approvedAmountBySubscription.get(subscription) || 0) + Number(item?.amount ?? item?.estCost ?? 0));
  });
  const approvedMembers = new Set((subscriptionItems || []).flatMap((item) => (
    (Array.isArray(item?.members) ? item.members : []).map((member) => {
      const person = typeof member === "string" ? member : member?.email || member?.name || member?.id;
      return `${compact(item?.optionLabel || item?.subscription || item?.label)}:${compact(person)}`;
    })
  )));
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const trackerBySubscription = new Map();
  const memberCoveredBySubscription = new Map();
  rows.forEach((row) => {
    const subscription = compact(row.sub);
    const amount = Number(row.amount || 0);
    trackerBySubscription.set(subscription, (trackerBySubscription.get(subscription) || 0) + amount);
    const key = `${subscription}:${compact(row.email || row.name || row.emp)}`;
    if (approvedMembers.has(key)) memberCoveredBySubscription.set(subscription, (memberCoveredBySubscription.get(subscription) || 0) + amount);
  });
  const addition = Array.from(trackerBySubscription.entries()).reduce((sum, [subscription, trackerAmount]) => (
    sum + Math.max(0, trackerAmount - Math.max(
      approvedAmountBySubscription.get(subscription) || 0,
      memberCoveredBySubscription.get(subscription) || 0
    ))
  ), 0);
  return { rows, total, addition };
};

// Roll a set of allocation rows up into { subscription, count, total } summaries.
export const summarizeSubscriptions = (rows = []) => {
  const map = new Map();
  rows.forEach((row) => {
    const entry = map.get(row.sub) || { subscription: row.sub, count: 0, total: 0 };
    entry.count += 1;
    entry.total += Number(row.amount || 0);
    map.set(row.sub, entry);
  });
  return Array.from(map.values()).sort((left, right) => right.count - left.count);
};
