export const ADD_CUSTOM_MODEL_OPTION = "__add_custom_model__";

const sanitizeIdPart = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

export const buildModelOptionLabel = (model = {}) => {
  const name = String(model?.name || "").trim() || "Unnamed model";
  const provider = String(model?.provider || "").trim();
  return provider ? `${name} · ${provider}` : name;
};

export const buildCustomModelId = ({ name = "", provider = "Custom" } = {}) => {
  const providerPart = sanitizeIdPart(provider) || "custom";
  const namePart = sanitizeIdPart(name) || "model";
  return `custom.${providerPart}.${namePart}`;
};

const readPromptValue = (message, initialValue = "") => {
  if (typeof window === "undefined" || typeof window.prompt !== "function") return null;
  const nextValue = window.prompt(message, initialValue);
  if (nextValue === null) return null;
  return String(nextValue || "").trim();
};

const parsePromptNumber = (value) => {
  const parsed = Number(String(value || "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

export const promptForCustomModel = (addCustomModel, defaults = {}) => {
  if (typeof addCustomModel !== "function") return null;

  const name = readPromptValue("Enter the model name", defaults.name || "");
  if (!name) return null;

  const provider = readPromptValue("Enter the provider name", defaults.provider || "Custom");
  if (!provider) return null;

  const modality = readPromptValue(
    "Enter the modality (Chat, Multimodal, Embedding, Image, Video, Reasoning)",
    defaults.modality || "Chat"
  );
  if (!modality) return null;

  const inputPrice = readPromptValue("Input cost per 1K tokens ($)", defaults.pricePer1kIn ?? "0");
  if (inputPrice === null) return null;

  const outputPrice = readPromptValue("Output cost per 1K tokens ($)", defaults.pricePer1kOut ?? "0");
  if (outputPrice === null) return null;

  return addCustomModel({
    name,
    provider,
    modality,
    pricePer1kIn: parsePromptNumber(inputPrice),
    pricePer1kOut: parsePromptNumber(outputPrice),
  });
};
