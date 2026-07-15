// Static catalogs for BudgetBuilder dropdowns — EC2 instance types + AWS Bedrock foundation models.
// Kept static because they are AWS SKU lists, not user data.

export const PLATFORM_PROVIDERS = ["AWS", "OpenAI", "OpenRouter", "GCP", "Moonshot"];

// Popular infra instance types with indicative on-demand $/hour mocks.
export const EC2_INSTANCES = [
  // AWS
  { provider: "AWS", code: "t3.medium", family: "General purpose", vCPU: 2, memoryGiB: 4, hourly: 0.0416 },
  { provider: "AWS", code: "t3.large", family: "General purpose", vCPU: 2, memoryGiB: 8, hourly: 0.0832 },
  { provider: "AWS", code: "m5.xlarge", family: "General purpose", vCPU: 4, memoryGiB: 16, hourly: 0.192 },
  { provider: "AWS", code: "c6i.xlarge", family: "Compute optimized", vCPU: 4, memoryGiB: 8, hourly: 0.17 },
  { provider: "AWS", code: "r5.2xlarge", family: "Memory optimized", vCPU: 8, memoryGiB: 64, hourly: 0.504 },
  { provider: "AWS", code: "g5.2xlarge", family: "GPU", vCPU: 8, memoryGiB: 32, hourly: 1.212, gpu: "1x NVIDIA A10G" },
  { provider: "AWS", code: "trn1.2xlarge", family: "AWS Trainium", vCPU: 8, memoryGiB: 32, hourly: 1.343, gpu: "1x AWS Trainium" },
  // GCP
  { provider: "GCP", code: "e2-standard-4", family: "General purpose", vCPU: 4, memoryGiB: 16, hourly: 0.134 },
  { provider: "GCP", code: "n2-standard-8", family: "General purpose", vCPU: 8, memoryGiB: 32, hourly: 0.379 },
  { provider: "GCP", code: "c3-standard-8", family: "Compute optimized", vCPU: 8, memoryGiB: 32, hourly: 0.42 },
  { provider: "GCP", code: "a2-highgpu-1g", family: "GPU", vCPU: 12, memoryGiB: 85, hourly: 3.67, gpu: "1x NVIDIA A100" },
  { provider: "GCP", code: "g2-standard-8", family: "GPU", vCPU: 8, memoryGiB: 32, hourly: 1.18, gpu: "1x NVIDIA L4" },
  // OpenAI
  { provider: "OpenAI", code: "priority-processing", family: "Hosted API throughput", vCPU: 0, memoryGiB: 0, hourly: 1.85 },
  { provider: "OpenAI", code: "reserved-capacity", family: "Dedicated capacity", vCPU: 0, memoryGiB: 0, hourly: 4.75 },
  { provider: "OpenAI", code: "batch-processing", family: "Background inference", vCPU: 0, memoryGiB: 0, hourly: 0.92 },
  // OpenRouter
  { provider: "OpenRouter", code: "shared-routing", family: "Hosted routing", vCPU: 0, memoryGiB: 0, hourly: 0.78 },
  { provider: "OpenRouter", code: "priority-routing", family: "Priority routing", vCPU: 0, memoryGiB: 0, hourly: 1.46 },
  { provider: "OpenRouter", code: "dedicated-routing-cluster", family: "Dedicated routing", vCPU: 0, memoryGiB: 0, hourly: 3.24 },
  // Moonshot
  { provider: "Moonshot", code: "kimi-standard-cluster", family: "Hosted inference", vCPU: 0, memoryGiB: 0, hourly: 0.88 },
  { provider: "Moonshot", code: "kimi-long-context-cluster", family: "Long-context inference", vCPU: 0, memoryGiB: 0, hourly: 1.52 },
  { provider: "Moonshot", code: "kimi-vision-cluster", family: "Vision inference", vCPU: 0, memoryGiB: 0, hourly: 1.94 },
];

// Foundation model catalog used across budgeting, task logging, IT provisioning, and top-up flows.
// Pricing values are indicative per-1K token mocks for workspace calculations.
export const BEDROCK_MODELS = [
  // AI21 Labs
  { id: "ai21.jamba-1-5-large", name: "Jamba 1.5 Large", provider: "AI21", modality: "Chat", pricePer1kIn: 0.002, pricePer1kOut: 0.008 },
  { id: "ai21.jamba-1-5-mini", name: "Jamba 1.5 Mini", provider: "AI21", modality: "Chat", pricePer1kIn: 0.0007, pricePer1kOut: 0.0028 },
  // Anthropic
  { id: "anthropic.claude-sonnet-5", name: "Claude Sonnet 5", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.004, pricePer1kOut: 0.02 },
  { id: "anthropic.claude-mythos-5", name: "Claude Mythos 5", provider: "Anthropic", modality: "Reasoning", pricePer1kIn: 0.01, pricePer1kOut: 0.05 },
  { id: "anthropic.claude-fable-5", name: "Claude Fable 5", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.0025, pricePer1kOut: 0.0125 },
  { id: "anthropic.claude-opus-4-8", name: "Claude Opus 4.8", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.015, pricePer1kOut: 0.075 },
  { id: "anthropic.claude-opus-4-7", name: "Claude Opus 4.7", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.014, pricePer1kOut: 0.07 },
  { id: "anthropic.claude-opus-4-6", name: "Claude Opus 4.6", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.013, pricePer1kOut: 0.065 },
  { id: "anthropic.claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.003, pricePer1kOut: 0.015 },
  { id: "anthropic.claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.0008, pricePer1kOut: 0.004 },
  { id: "anthropic.claude-opus-4-5", name: "Claude Opus 4.5", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.012, pricePer1kOut: 0.06 },
  { id: "anthropic.claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.0028, pricePer1kOut: 0.014 },
  { id: "anthropic.claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.0025, pricePer1kOut: 0.0125 },
  { id: "anthropic.claude-opus-4-1", name: "Claude Opus 4.1", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.01, pricePer1kOut: 0.05 },
  { id: "anthropic.claude-3-5-haiku", name: "Claude 3.5 Haiku", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.001, pricePer1kOut: 0.005 },
  { id: "anthropic.claude-3-haiku", name: "Claude 3 Haiku", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.0007, pricePer1kOut: 0.0035 },
  { id: "anthropic.claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic", modality: "Chat", pricePer1kIn: 0.003, pricePer1kOut: 0.015 },
  // Amazon
  { id: "amazon.nova-multimodal-embeddings-v1", name: "Nova Multimodal Embeddings", provider: "Amazon", modality: "Embedding", pricePer1kIn: 0.00012, pricePer1kOut: 0 },
  { id: "amazon.nova-2-lite", name: "Nova 2 Lite", provider: "Amazon", modality: "Multimodal", pricePer1kIn: 0.00008, pricePer1kOut: 0.00032 },
  { id: "amazon.nova-2-sonic", name: "Nova 2 Sonic", provider: "Amazon", modality: "Audio", pricePer1kIn: 0.0002, pricePer1kOut: 0.0008 },
  { id: "amazon.titan-text-premier", name: "Titan Text Premier", provider: "Amazon", modality: "Chat", pricePer1kIn: 0.0005, pricePer1kOut: 0.0015 },
  { id: "amazon.titan-embed-g1-text", name: "Titan Embeddings G1 - Text", provider: "Amazon", modality: "Embedding", pricePer1kIn: 0.00003, pricePer1kOut: 0 },
  { id: "amazon.titan-embed-g1-text-v2", name: "Titan Embeddings G1 - Text v2", provider: "Amazon", modality: "Embedding", pricePer1kIn: 0.000025, pricePer1kOut: 0 },
  { id: "amazon.titan-image-generator-g1-v2", name: "Titan Image Generator G1 v2", provider: "Amazon", modality: "Image", pricePer1kIn: 0.09, pricePer1kOut: 0 },
  { id: "amazon.titan-multimodal-embeddings-g1", name: "Titan Multimodal Embeddings G1", provider: "Amazon", modality: "Embedding", pricePer1kIn: 0.00006, pricePer1kOut: 0 },
  { id: "amazon.titan-embed-text-v2", name: "Titan Embeddings v2", provider: "Amazon", modality: "Embedding", pricePer1kIn: 0.00002, pricePer1kOut: 0 },
  { id: "amazon.nova-premier", name: "Nova Premier", provider: "Amazon", modality: "Multimodal", pricePer1kIn: 0.0025, pricePer1kOut: 0.01 },
  { id: "amazon.nova-pro", name: "Nova Pro", provider: "Amazon", modality: "Multimodal", pricePer1kIn: 0.0008, pricePer1kOut: 0.0032 },
  { id: "amazon.nova-lite", name: "Nova Lite", provider: "Amazon", modality: "Multimodal", pricePer1kIn: 0.00006, pricePer1kOut: 0.00024 },
  { id: "amazon.nova-micro", name: "Nova Micro", provider: "Amazon", modality: "Chat", pricePer1kIn: 0.000035, pricePer1kOut: 0.00014 },
  { id: "amazon.nova-sonic", name: "Nova Sonic", provider: "Amazon", modality: "Audio", pricePer1kIn: 0.00018, pricePer1kOut: 0.00072 },
  { id: "amazon.nova-canvas", name: "Nova Canvas", provider: "Amazon", modality: "Image", pricePer1kIn: 0.08, pricePer1kOut: 0 },
  { id: "amazon.nova-reel", name: "Nova Reel", provider: "Amazon", modality: "Video", pricePer1kIn: 0.12, pricePer1kOut: 0 },
  // Meta
  { id: "meta.llama-4-maverick-17b", name: "Llama 4 Maverick 17B Instruct", provider: "Meta", modality: "Multimodal", pricePer1kIn: 0.0018, pricePer1kOut: 0.0072 },
  { id: "meta.llama-4-scout-17b", name: "Llama 4 Scout 17B Instruct", provider: "Meta", modality: "Multimodal", pricePer1kIn: 0.0014, pricePer1kOut: 0.0056 },
  { id: "meta.llama-3-3-70b", name: "Llama 3.3 70B Instruct", provider: "Meta", modality: "Chat", pricePer1kIn: 0.00072, pricePer1kOut: 0.00072 },
  { id: "meta.llama-3-2-90b", name: "Llama 3.2 90B Instruct", provider: "Meta", modality: "Multimodal", pricePer1kIn: 0.002, pricePer1kOut: 0.008 },
  { id: "meta.llama-3-2-11b", name: "Llama 3.2 11B Instruct", provider: "Meta", modality: "Multimodal", pricePer1kIn: 0.00055, pricePer1kOut: 0.0022 },
  { id: "meta.llama-3-2-3b", name: "Llama 3.2 3B Instruct", provider: "Meta", modality: "Chat", pricePer1kIn: 0.00015, pricePer1kOut: 0.0006 },
  { id: "meta.llama-3-2-1b", name: "Llama 3.2 1B Instruct", provider: "Meta", modality: "Chat", pricePer1kIn: 0.00008, pricePer1kOut: 0.00032 },
  { id: "meta.llama-3-1-405b", name: "Llama 3.1 405B", provider: "Meta", modality: "Chat", pricePer1kIn: 0.00532, pricePer1kOut: 0.016 },
  { id: "meta.llama-3-1-70b", name: "Llama 3.1 70B", provider: "Meta", modality: "Chat", pricePer1kIn: 0.00099, pricePer1kOut: 0.00099 },
  { id: "meta.llama-3-1-8b", name: "Llama 3.1 8B Instruct", provider: "Meta", modality: "Chat", pricePer1kIn: 0.00018, pricePer1kOut: 0.00072 },
  { id: "meta.llama-3-70b", name: "Llama 3 70B Instruct", provider: "Meta", modality: "Chat", pricePer1kIn: 0.0009, pricePer1kOut: 0.0009 },
  { id: "meta.llama-3-8b", name: "Llama 3 8B Instruct", provider: "Meta", modality: "Chat", pricePer1kIn: 0.00012, pricePer1kOut: 0.00048 },
  // Cohere
  { id: "cohere.rerank-3-5", name: "Rerank 3.5", provider: "Cohere", modality: "Rerank", pricePer1kIn: 0.0002, pricePer1kOut: 0 },
  { id: "cohere.embed-multilingual-v3", name: "Embed Multilingual v3", provider: "Cohere", modality: "Embedding", pricePer1kIn: 0.0001, pricePer1kOut: 0 },
  { id: "cohere.embed-v4", name: "Embed v4", provider: "Cohere", modality: "Embedding", pricePer1kIn: 0.00012, pricePer1kOut: 0 },
  // DeepSeek
  { id: "deepseek.deepseek-v3-2", name: "DeepSeek V3.2", provider: "DeepSeek", modality: "Chat", pricePer1kIn: 0.0009, pricePer1kOut: 0.0036 },
  { id: "deepseek.deepseek-v3-1", name: "DeepSeek V3.1", provider: "DeepSeek", modality: "Chat", pricePer1kIn: 0.00075, pricePer1kOut: 0.003 },
  { id: "deepseek.deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek", modality: "Reasoning", pricePer1kIn: 0.0012, pricePer1kOut: 0.0048 },
  // Mistral
  { id: "mistral.mistral-large-2", name: "Mistral Large 2", provider: "Mistral", modality: "Chat", pricePer1kIn: 0.004, pricePer1kOut: 0.012 },
  { id: "mistral.mistral-large-3", name: "Mistral Large 3", provider: "Mistral", modality: "Chat", pricePer1kIn: 0.0045, pricePer1kOut: 0.0135 },
  { id: "mistral.mistral-small", name: "Mistral Small", provider: "Mistral", modality: "Chat", pricePer1kIn: 0.0006, pricePer1kOut: 0.0024 },
  { id: "mistral.ministral-14b-3-0", name: "Ministral 14B 3.0", provider: "Mistral", modality: "Chat", pricePer1kIn: 0.0009, pricePer1kOut: 0.0036 },
  { id: "mistral.mixtral-8x7b", name: "Mixtral 8x7B", provider: "Mistral", modality: "Chat", pricePer1kIn: 0.00045, pricePer1kOut: 0.0007 },
  // Cohere
  { id: "cohere.command-r-plus", name: "Command R+", provider: "Cohere", modality: "Chat", pricePer1kIn: 0.003, pricePer1kOut: 0.015 },
  { id: "cohere.command-r", name: "Command R", provider: "Cohere", modality: "Chat", pricePer1kIn: 0.0005, pricePer1kOut: 0.0015 },
  { id: "cohere.embed-english-v3", name: "Embed English v3", provider: "Cohere", modality: "Embedding", pricePer1kIn: 0.0001, pricePer1kOut: 0 },
  // OpenAI
  { id: "openai.gpt-5-5", name: "GPT-5.5", provider: "OpenAI", modality: "Reasoning", pricePer1kIn: 0.0035, pricePer1kOut: 0.014 },
  { id: "openai.gpt-5-4", name: "GPT-5.4", provider: "OpenAI", modality: "Reasoning", pricePer1kIn: 0.003, pricePer1kOut: 0.012 },
  { id: "openai.gpt-4o", name: "GPT-4o", provider: "OpenAI", modality: "Multimodal", pricePer1kIn: 0.005, pricePer1kOut: 0.015 },
  { id: "openai.gpt-4-1", name: "GPT-4.1", provider: "OpenAI", modality: "Chat", pricePer1kIn: 0.002, pricePer1kOut: 0.008 },
  { id: "openai.gpt-4-1-mini", name: "GPT-4.1 Mini", provider: "OpenAI", modality: "Chat", pricePer1kIn: 0.0004, pricePer1kOut: 0.0016 },
  { id: "openai.o3-mini", name: "o3-mini", provider: "OpenAI", modality: "Reasoning", pricePer1kIn: 0.0011, pricePer1kOut: 0.0044 },
  // Google
  { id: "google.gemma-4-31b", name: "Gemma 4 31B", provider: "Google", modality: "Chat", pricePer1kIn: 0.0015, pricePer1kOut: 0.006 },
  { id: "google.gemma-4-26b-a4b", name: "Gemma 4 26B-A4B", provider: "Google", modality: "Chat", pricePer1kIn: 0.0012, pricePer1kOut: 0.0048 },
  { id: "google.gemma-4-e2b", name: "Gemma 4 E2B", provider: "Google", modality: "Chat", pricePer1kIn: 0.0007, pricePer1kOut: 0.0028 },
  { id: "google.gemma-3-12b-it", name: "Gemma 3 12B IT", provider: "Google", modality: "Chat", pricePer1kIn: 0.00045, pricePer1kOut: 0.0018 },
  { id: "google.gemma-3-27b-pt", name: "Gemma 3 27B PT", provider: "Google", modality: "Chat", pricePer1kIn: 0.0007, pricePer1kOut: 0.0028 },
  { id: "google.gemma-3-4b-it", name: "Gemma 3 4B IT", provider: "Google", modality: "Chat", pricePer1kIn: 0.00018, pricePer1kOut: 0.00072 },
  { id: "google.gemini-2-5-pro", name: "Gemini 2.5 Pro", provider: "Google", modality: "Multimodal", pricePer1kIn: 0.0025, pricePer1kOut: 0.01 },
  { id: "google.gemini-2-5-flash", name: "Gemini 2.5 Flash", provider: "Google", modality: "Multimodal", pricePer1kIn: 0.00035, pricePer1kOut: 0.0014 },
  { id: "google.gemini-1-5-pro", name: "Gemini 1.5 Pro", provider: "Google", modality: "Multimodal", pricePer1kIn: 0.00125, pricePer1kOut: 0.005 },
  // MiniMax
  { id: "minimax.m2-5", name: "MiniMax M2.5", provider: "MiniMax", modality: "Chat", pricePer1kIn: 0.0018, pricePer1kOut: 0.0072 },
  { id: "minimax.m2-1", name: "MiniMax M2.1", provider: "MiniMax", modality: "Chat", pricePer1kIn: 0.0012, pricePer1kOut: 0.0048 },
  { id: "minimax.m2", name: "MiniMax M2", provider: "MiniMax", modality: "Chat", pricePer1kIn: 0.0009, pricePer1kOut: 0.0036 },
  // xAI
  { id: "xai.grok-4-3", name: "Grok 4.3", provider: "xAI", modality: "Chat", pricePer1kIn: 0.0025, pricePer1kOut: 0.01 },
  { id: "xai.grok-2", name: "Grok-2", provider: "xAI", modality: "Chat", pricePer1kIn: 0.002, pricePer1kOut: 0.01 },
  { id: "xai.grok-2-mini", name: "Grok-2 Mini", provider: "xAI", modality: "Chat", pricePer1kIn: 0.0005, pricePer1kOut: 0.002 },
  // Moonshot AI
  { id: "moonshot.kimi-k2-5", name: "Kimi K2.5", provider: "Moonshot AI", modality: "Reasoning", pricePer1kIn: 0.002, pricePer1kOut: 0.008 },
  { id: "moonshot.kimi-k2-thinking", name: "Kimi K2 Thinking", provider: "Moonshot AI", modality: "Reasoning", pricePer1kIn: 0.0022, pricePer1kOut: 0.0088 },
  { id: "moonshot.kimi-k2", name: "Kimi K2", provider: "Moonshot AI", modality: "Reasoning", pricePer1kIn: 0.0018, pricePer1kOut: 0.0072 },
  { id: "moonshot.kimi-1-5-long-context", name: "Kimi 1.5 Long Context", provider: "Moonshot AI", modality: "Chat", pricePer1kIn: 0.0007, pricePer1kOut: 0.0028 },
  { id: "moonshot.kimi-1-5-vision", name: "Kimi 1.5 Vision", provider: "Moonshot AI", modality: "Multimodal", pricePer1kIn: 0.0012, pricePer1kOut: 0.0048 },
  // NVIDIA
  { id: "nvidia.nemotron-nano-12b-v2-vl", name: "Nemotron Nano 12B v2 VL", provider: "NVIDIA", modality: "Multimodal", pricePer1kIn: 0.0009, pricePer1kOut: 0.0036 },
  { id: "nvidia.nemotron-nano-9b-v2", name: "Nemotron Nano 9B v2", provider: "NVIDIA", modality: "Chat", pricePer1kIn: 0.0007, pricePer1kOut: 0.0028 },
  { id: "nvidia.nemotron-3-super-120b", name: "Nemotron 3 Super 120B", provider: "NVIDIA", modality: "Chat", pricePer1kIn: 0.0022, pricePer1kOut: 0.0088 },
  // Z.AI / GLM
  { id: "zai.glm-5", name: "GLM 5", provider: "Z.AI", modality: "Reasoning", pricePer1kIn: 0.0018, pricePer1kOut: 0.0072 },
  { id: "zai.glm-4-7", name: "GLM 4.7", provider: "Z.AI", modality: "Chat", pricePer1kIn: 0.0012, pricePer1kOut: 0.0048 },
  { id: "zai.glm-4-7-flash", name: "GLM 4.7 Flash", provider: "Z.AI", modality: "Chat", pricePer1kIn: 0.0003, pricePer1kOut: 0.0012 },
  { id: "zhipu.glm-4-5", name: "GLM-4.5", provider: "Zhipu AI", modality: "Chat", pricePer1kIn: 0.0015, pricePer1kOut: 0.006 },
  { id: "zhipu.glm-4-5-air", name: "GLM-4.5 Air", provider: "Zhipu AI", modality: "Chat", pricePer1kIn: 0.0005, pricePer1kOut: 0.002 },
  { id: "zhipu.glm-4-air", name: "GLM-4 Air", provider: "Zhipu AI", modality: "Chat", pricePer1kIn: 0.00035, pricePer1kOut: 0.0014 },
  { id: "zhipu.glm-4-flash", name: "GLM-4 Flash", provider: "Zhipu AI", modality: "Chat", pricePer1kIn: 0.0001, pricePer1kOut: 0.0004 },
  // Stability
  { id: "stability.stable-image-ultra", name: "Stable Image Ultra", provider: "Stability AI", modality: "Image", pricePer1kIn: 0.14, pricePer1kOut: 0 },
  { id: "stability.stable-image-fast-upscale", name: "Stable Image Fast Upscale", provider: "Stability AI", modality: "Image", pricePer1kIn: 0.03, pricePer1kOut: 0 },
  { id: "stability.stable-image-inpaint", name: "Stable Image Inpaint", provider: "Stability AI", modality: "Image", pricePer1kIn: 0.06, pricePer1kOut: 0 },
  { id: "stability.stable-image-outpaint", name: "Stable Image Outpaint", provider: "Stability AI", modality: "Image", pricePer1kIn: 0.06, pricePer1kOut: 0 },
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
