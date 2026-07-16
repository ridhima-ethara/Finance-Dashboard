export const buildProjectBudgetBuilderHref = (projectId, options = {}) => {
  if (!projectId) return "/projects";

  const params = new URLSearchParams({ projectId });

  Object.entries(options).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  return `/budget-builder?${params.toString()}`;
};
