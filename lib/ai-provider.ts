import { getDecryptedApiKeys } from "@/lib/actions/api-keys";

/**
 * Resolve an API key for a given provider.
 * Priority: user-provided key (encrypted in DB) > platform env var.
 */

export async function getAnthropicApiKey(userId: string): Promise<string | undefined> {
  const keys = await getDecryptedApiKeys(userId);
  return keys.anthropicKey ?? process.env.ANTHROPIC_API_KEY ?? undefined;
}

export async function getGeminiApiKey(userId: string): Promise<string | undefined> {
  const keys = await getDecryptedApiKeys(userId);
  return keys.googleGeminiKey ?? process.env.GOOGLE_GEMINI_API_KEY ?? undefined;
}

export async function getHuggingFaceApiKey(userId: string): Promise<string | undefined> {
  const keys = await getDecryptedApiKeys(userId);
  return keys.huggingfaceKey ?? process.env.HUGGINGFACE_API_KEY ?? undefined;
}

export async function getNvidiaApiKey(userId: string): Promise<string | undefined> {
  const keys = await getDecryptedApiKeys(userId);
  return keys.nvidiaKey ?? process.env.NVIDIA_API_KEY ?? undefined;
}

/**
 * Get Ollama config. Returns null if not configured.
 * Ollama exposes an OpenAI-compatible API at /v1.
 */
export async function getOllamaConfig(userId: string): Promise<{ baseUrl: string; model: string } | null> {
  const keys = await getDecryptedApiKeys(userId);
  if (!keys.ollamaUrl) return null;
  return {
    baseUrl: keys.ollamaUrl.replace(/\/$/, ""),
    model: keys.ollamaModel || "llama3",
  };
}

/**
 * Get LM Studio config. Returns null if not configured.
 * LM Studio exposes an OpenAI-compatible API at /v1.
 */
export async function getLmStudioConfig(userId: string): Promise<{ baseUrl: string; model: string } | null> {
  const keys = await getDecryptedApiKeys(userId);
  if (!keys.lmStudioUrl) return null;
  return {
    baseUrl: keys.lmStudioUrl.replace(/\/$/, ""),
    model: keys.lmStudioModel || "local-model",
  };
}
