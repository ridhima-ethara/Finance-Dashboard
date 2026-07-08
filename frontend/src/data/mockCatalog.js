// Static catalogs for BudgetBuilder dropdowns — EC2 instance types + AWS Bedrock foundation models.
// Kept static because they are AWS SKU lists, not user data.

// Popular EC2 instance types (compute-optimized, memory, GPU) with indicative on-demand $/hour (us-east-1).
export const EC2_INSTANCES = [
  // General purpose
  { code: "t3.medium", family: "General purpose", vCPU: 2, memoryGiB: 4, hourly: 0.0416 },
  { code: "t3.large", family: "General purpose", vCPU: 2, memoryGiB: 8, hourly: 0.0832 },
  { code: "t3.xlarge", family: "General purpose", vCPU: 4, memoryGiB: 16, hourly: 0.1664 },
  { code: "m5.large", family: "General purpose", vCPU: 2, memoryGiB: 8, hourly: 0.096 },
  { code: "m5.xlarge", family: "General purpose", vCPU: 4, memoryGiB: 16, hourly: 0.192 },
  { code: "m5.2xlarge", family: "General purpose", vCPU: 8, memoryGiB: 32, hourly: 0.384 },
  { code: "m6i.large", family: "General purpose", vCPU: 2, memoryGiB: 8, hourly: 0.096 },
  { code: "m6i.2xlarge", family: "General purpose", vCPU: 8, memoryGiB: 32, hourly: 0.384 },
  // Compute optimized
  { code: "c5.large", family: "Compute optimized", vCPU: 2, memoryGiB: 4, hourly: 0.085 },
  { code: "c5.xlarge", family: "Compute optimized", vCPU: 4, memoryGiB: 8, hourly: 0.17 },
  { code: "c5.2xlarge", family: "Compute optimized", vCPU: 8, memoryGiB: 16, hourly: 0.34 },
  { code: "c5.4xlarge", family: "Compute optimized", vCPU: 16, memoryGiB: 32, hourly: 0.68 },
  { code: "c6i.xlarge", family: "Compute optimized", vCPU: 4, memoryGiB: 8, hourly: 0.17 },
  // Memory optimized
  { code: "r5.large", family: "Memory optimized", vCPU: 2, memoryGiB: 16, hourly: 0.126 },
  { code: "r5.xlarge", family: "Memory optimized", vCPU: 4, memoryGiB: 32, hourly: 0.252 },
  { code: "r5.2xlarge", family: "Memory optimized", vCPU: 8, memoryGiB: 64, hourly: 0.504 },
  // GPU / accelerated
  { code: "g4dn.xlarge", family: "GPU", vCPU: 4, memoryGiB: 16, hourly: 0.526, gpu: "1x NVIDIA T4" },
  { code: "g4dn.2xlarge", family: "GPU", vCPU: 8, memoryGiB: 32, hourly: 0.752, gpu: "1x NVIDIA T4" },
  { code: "g5.xlarge", family: "GPU", vCPU: 4, memoryGiB: 16, hourly: 1.006, gpu: "1x NVIDIA A10G" },
  { code: "g5.2xlarge", family: "GPU", vCPU: 8, memoryGiB: 32, hourly: 1.212, gpu: "1x NVIDIA A10G" },
  { code: "g5.4xlarge", family: "GPU", vCPU: 16, memoryGiB: 64, hourly: 1.624, gpu: "1x NVIDIA A10G" },
  { code: "g5.12xlarge", family: "GPU", vCPU: 48, memoryGiB: 192, hourly: 5.672, gpu: "4x NVIDIA A10G" },
  { code: "p3.2xlarge", family: "GPU", vCPU: 8, memoryGiB: 61, hourly: 3.06, gpu: "1x NVIDIA V100" },
  { code: "p3.8xlarge", family: "GPU", vCPU: 32, memoryGiB: 244, hourly: 12.24, gpu: "4x NVIDIA V100" },
  { code: "p4d.24xlarge", family: "GPU", vCPU: 96, memoryGiB: 1152, hourly: 32.77, gpu: "8x NVIDIA A100" },
  { code: "p5.48xlarge", family: "GPU", vCPU: 192, memoryGiB: 2048, hourly: 98.32, gpu: "8x NVIDIA H100" },
  // Inferentia
  { code: "inf1.xlarge", family: "AWS Inferentia", vCPU: 4, memoryGiB: 8, hourly: 0.362, gpu: "1x AWS Inferentia" },
  { code: "inf2.xlarge", family: "AWS Inferentia", vCPU: 4, memoryGiB: 16, hourly: 0.758, gpu: "1x AWS Inferentia2" },
  { code: "trn1.2xlarge", family: "AWS Trainium", vCPU: 8, memoryGiB: 32, hourly: 1.343, gpu: "1x AWS Trainium" },
];

// AWS Bedrock foundation models — pricing per 1K tokens (indicative us-east-1).
export const BEDROCK_MODELS = [
  // Anthropic
  { id: "anthropic.claude-opus-4-8", name: "Claude Opus 4.8", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.015, pricePer1kOut: 0.075 },
  { id: "anthropic.claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.003, pricePer1kOut: 0.015 },
  { id: "anthropic.claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.0008, pricePer1kOut: 0.004 },
  { id: "anthropic.claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.003, pricePer1kOut: 0.015 },
  // Amazon
  { id: "amazon.titan-text-premier", name: "Titan Text Premier", provider: "Amazon", modality: "Chat", pricePer1kIn: 0.0005, pricePer1kOut: 0.0015 },
  { id: "amazon.titan-embed-text-v2", name: "Titan Embeddings v2", provider: "Amazon", modality: "Embedding", pricePer1kIn: 0.00002, pricePer1kOut: 0 },
  { id: "amazon.nova-pro", name: "Nova Pro", provider: "Amazon", modality: "Multimodal", pricePer1kIn: 0.0008, pricePer1kOut: 0.0032 },
  { id: "amazon.nova-lite", name: "Nova Lite", provider: "Amazon", modality: "Multimodal", pricePer1kIn: 0.00006, pricePer1kOut: 0.00024 },
  { id: "amazon.nova-micro", name: "Nova Micro", provider: "Amazon", modality: "Chat", pricePer1kIn: 0.000035, pricePer1kOut: 0.00014 },
  // Meta
  { id: "meta.llama-3-3-70b", name: "Llama 3.3 70B Instruct", provider: "Meta", modality: "Chat", pricePer1kIn: 0.00072, pricePer1kOut: 0.00072 },
  { id: "meta.llama-3-1-405b", name: "Llama 3.1 405B", provider: "Meta", modality: "Chat", pricePer1kIn: 0.00532, pricePer1kOut: 0.016 },
  { id: "meta.llama-3-1-70b", name: "Llama 3.1 70B", provider: "Meta", modality: "Chat", pricePer1kIn: 0.00099, pricePer1kOut: 0.00099 },
  // Mistral
  { id: "mistral.mistral-large-2", name: "Mistral Large 2", provider: "Mistral", modality: "Chat", pricePer1kIn: 0.004, pricePer1kOut: 0.012 },
  { id: "mistral.mixtral-8x7b", name: "Mixtral 8x7B", provider: "Mistral", modality: "Chat", pricePer1kIn: 0.00045, pricePer1kOut: 0.0007 },
  // Cohere
  { id: "cohere.command-r-plus", name: "Command R+", provider: "Cohere", modality: "Chat", pricePer1kIn: 0.003, pricePer1kOut: 0.015 },
  { id: "cohere.command-r", name: "Command R", provider: "Cohere", modality: "Chat", pricePer1kIn: 0.0005, pricePer1kOut: 0.0015 },
  { id: "cohere.embed-english-v3", name: "Embed English v3", provider: "Cohere", modality: "Embedding", pricePer1kIn: 0.0001, pricePer1kOut: 0 },
  // AI21
  { id: "ai21.jamba-1-5-large", name: "Jamba 1.5 Large", provider: "AI21", modality: "Chat", pricePer1kIn: 0.002, pricePer1kOut: 0.008 },
  // Stability
  { id: "stability.stable-image-ultra", name: "Stable Image Ultra", provider: "Stability AI", modality: "Image", pricePer1kIn: 0.14, pricePer1kOut: 0 },
];

// Default subscription catalog (for the Subscriptions tab)
export const SUBSCRIPTION_CATALOG = [
  { id: "claude-max", name: "Claude Max", monthly: 400 },
  { id: "chatgpt-team", name: "ChatGPT Team", monthly: 300 },
  { id: "cursor-pro", name: "Cursor Pro", monthly: 40 },
  { id: "github-enterprise", name: "GitHub Enterprise", monthly: 21 },
  { id: "figma-org", name: "Figma Organization", monthly: 45 },
  { id: "notion-plus", name: "Notion Plus", monthly: 15 },
  { id: "linear-standard", name: "Linear Standard", monthly: 12 },
];
