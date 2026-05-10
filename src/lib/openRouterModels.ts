type PricingValue = number | "variable" | "free";

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  modality: string;
  input_modalities: string[];
  output_modalities: string[];
  tokenizer: string;
  pricing: {
    prompt: PricingValue;
    completion: PricingValue;
    image?: number;
    audio?: number;
    web_search?: number;
    input_cache_read?: number;
    input_cache_write?: number;
  };
  max_completion_tokens: number | null;
  is_moderated: boolean;
  supported_parameters: string[];
}

const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
if (!API_KEY) {
  throw new Error(
    "VITE_OPENROUTER_API_KEY is not set. Add it to your .env file before starting the app."
  );
}

let cache: { data: OpenRouterModel[]; expiresAt: number } | null = null;

function normalizePricing(value: string | undefined): PricingValue {
  if (value === "-1") return "variable";
  if (value === "0") return "free";
  return parseFloat(value ?? "0");
}

function normalizeOptionalPricing(value: string | undefined): number | undefined {
  if (value === undefined || value === null || value === "-1" || value === "0") return undefined;
  return parseFloat(value);
}

function mapModel(raw: Record<string, any>): OpenRouterModel {
  const pricing: OpenRouterModel["pricing"] = {
    prompt: normalizePricing(raw.pricing?.prompt),
    completion: normalizePricing(raw.pricing?.completion),
  };
  const optFields = [
    "image",
    "audio",
    "web_search",
    "input_cache_read",
    "input_cache_write",
  ] as const;
  for (const field of optFields) {
    const v = normalizeOptionalPricing(raw.pricing?.[field]);
    if (v !== undefined) pricing[field] = v;
  }

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    context_length: raw.context_length,
    modality: raw.architecture?.modality ?? "",
    input_modalities: raw.architecture?.input_modalities ?? [],
    output_modalities: raw.architecture?.output_modalities ?? [],
    tokenizer: raw.architecture?.tokenizer ?? "",
    pricing,
    max_completion_tokens: raw.top_provider?.max_completion_tokens ?? null,
    is_moderated: raw.top_provider?.is_moderated ?? false,
    supported_parameters: raw.supported_parameters ?? [],
  };
}

export function invalidateModelsCache(): void {
  cache = null;
}

export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.data;
  }

  const response = await fetch("https://openrouter.ai/api/v1/models/user", {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${body}`);
  }

  const json = await response.json();
  const raw: Record<string, any>[] = json.data ?? [];

  const filtered = raw.filter(
    (m) => !m.id.startsWith("~") && !m.id.startsWith("openrouter/")
  );

  const mapped = filtered.map(mapModel);
  cache = { data: mapped, expiresAt: Date.now() + 5 * 60 * 1000 };
  return mapped;
}
