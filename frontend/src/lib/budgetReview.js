const toAmount = (value) => Math.round(Number(value || 0) * 100) / 100;

const toText = (value) => String(value || "").trim();

const normalizeMembers = (members = []) =>
  (Array.isArray(members) ? members : [])
    .map((member) => toText(member))
    .filter(Boolean)
    .sort();

const serializeLine = (line = {}) => ({
  id: toText(line.id),
  modelId: toText(line.modelId),
  modelName: toText(line.modelName),
  provider: toText(line.provider || line.platform || line.meta?.platform || line.meta?.provider),
  label: toText(line.label || line.optionLabel || line.subscription || line.instance),
  name: toText(line.meta?.name),
  code: toText(line.meta?.code),
  family: toText(line.meta?.family),
  note: toText(line.note || line.detail),
  amount: toAmount(line.estCost || line.amount),
  seats: Math.round(Number(line.seats || 0)),
  members: normalizeMembers(line.members),
});

const serializeItems = (items = {}) => ({
  models: (Array.isArray(items.models) ? items.models : []).map(serializeLine),
  infra: (Array.isArray(items.infra) ? items.infra : []).map(serializeLine),
  subs: (Array.isArray(items.subs) ? items.subs : []).map(serializeLine),
  misc: (Array.isArray(items.misc) ? items.misc : []).map(serializeLine),
});

const serializePhase = (phase = {}) => ({
  id: toText(phase.id),
  name: toText(phase.name),
  infra: toAmount(phase.infra),
  model: toAmount(phase.model),
  subs: toAmount(phase.subs),
  total: toAmount(
    Number(phase.total || 0) || Number(phase.infra || 0) + Number(phase.model || 0) + Number(phase.subs || 0)
  ),
});

export const areBudgetItemsEqual = (left = {}, right = {}) =>
  JSON.stringify(serializeItems(left)) === JSON.stringify(serializeItems(right));

export const areBudgetPhasesEqual = (left = [], right = []) =>
  JSON.stringify((Array.isArray(left) ? left : []).map(serializePhase))
  === JSON.stringify((Array.isArray(right) ? right : []).map(serializePhase));

export const hasCtoModifiedBudgetReview = (review) => {
  if (!review) return false;
  if (typeof review.ctoModified === "boolean") return review.ctoModified;

  const requestedAmount = toAmount(review.requestedBudget);
  const modifiedAmount = toAmount(review.modifiedTotal || review.requestedBudget);
  if (modifiedAmount !== requestedAmount) return true;

  return !areBudgetItemsEqual(review.items || {}, review.modifiedItems || review.items || {});
};

export const getCtoForwardLabel = (review) =>
  hasCtoModifiedBudgetReview(review)
    ? "Modified & forwarded to CFO"
    : "Approved by CTO and forwarded to CFO";

const mapModelLine = (line, index) => ({
  id: line.id || `model-${index + 1}`,
  title: line.meta?.name || line.modelName || line.label || "Model allocation",
  detail: [line.provider || line.platform || line.meta?.platform || line.meta?.provider, line.usageTag]
    .filter(Boolean)
    .join(" · ") || "Requested model line",
  amount: toAmount(line.estCost || line.amount),
});

const mapInfraLine = (line, index) => ({
  id: line.id || `infra-${index + 1}`,
  title: line.meta?.code || line.instance || line.optionLabel || line.label || "Infrastructure allocation",
  detail: [
    line.provider || line.meta?.provider,
    line.meta?.family,
    Number(line.days || 0) > 0 ? `${Number(line.days)} days` : "",
  ].filter(Boolean).join(" · ") || "Requested infrastructure line",
  amount: toAmount(line.estCost || line.amount),
});

const mapSubscriptionLine = (line, index) => ({
  id: line.id || `subscription-${index + 1}`,
  title: line.subscription || line.optionLabel || line.label || "Subscription allocation",
  detail: [
    Array.isArray(line.members) && line.members.length ? line.members.join(", ") : "",
    Number(line.days || 0) > 0 ? `${Number(line.days)} days` : "",
  ].filter(Boolean).join(" · ") || "Requested subscription line",
  amount: toAmount(line.estCost || line.amount),
});

const mapGeneralLine = (line, index) => ({
  id: line.id || `general-${index + 1}`,
  title: line.optionLabel || line.label || "General request",
  detail: line.note || line.detail || "Requested general line",
  amount: toAmount(line.estCost || line.amount),
});

const buildSection = ({ key, title, lines = [], fallbackAmount = 0, mapLine, fallbackTitle, fallbackDetail }) => {
  const mappedLines = (Array.isArray(lines) ? lines : [])
    .map((line, index) => mapLine(line, index))
    .filter((line) => line.amount > 0 || line.title || line.detail);

  if (mappedLines.length) {
    return { key, title, lines: mappedLines };
  }

  if (toAmount(fallbackAmount) > 0) {
    return {
      key,
      title,
      lines: [{
        id: `${key}-summary`,
        title: fallbackTitle,
        detail: fallbackDetail,
        amount: toAmount(fallbackAmount),
      }],
    };
  }

  return { key, title, lines: [] };
};

export const buildBudgetReviewLineSections = (review) => {
  const items = review?.items || {};

  return [
    buildSection({
      key: "models",
      title: "Models",
      lines: items.models,
      fallbackAmount: review?.aiCost,
      mapLine: mapModelLine,
      fallbackTitle: "Model allocation",
      fallbackDetail: "Requested model cost",
    }),
    buildSection({
      key: "infra",
      title: "Infrastructure",
      lines: items.infra,
      fallbackAmount: review?.infraCost,
      mapLine: mapInfraLine,
      fallbackTitle: "Infrastructure allocation",
      fallbackDetail: "Requested infrastructure cost",
    }),
    buildSection({
      key: "subs",
      title: "Subscriptions",
      lines: items.subs,
      fallbackAmount: review?.subsCost,
      mapLine: mapSubscriptionLine,
      fallbackTitle: "Subscription allocation",
      fallbackDetail: "Requested subscription cost",
    }),
    buildSection({
      key: "misc",
      title: "General",
      lines: items.misc,
      fallbackAmount: review?.miscCost,
      mapLine: mapGeneralLine,
      fallbackTitle: "General request",
      fallbackDetail: "Requested general cost",
    }),
  ];
};
