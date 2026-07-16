export const buildProjectBudgetBuilderHref = (projectId, options = {}) => {
  if (!projectId) return "/projects";

  const params = new URLSearchParams({
    tab: "budget",
    builder: "1",
  });

  Object.entries(options).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  return `/projects/${projectId}?${params.toString()}`;
};
