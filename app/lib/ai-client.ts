import { type MasterAIConfig } from "./ai-settings";

interface AIRequestOptions {
  systemPrompt: string;
  messages: { role: string; content: string | object[] }[];
  reasoningDepth?: string;
  maxCompletionTokens?: number;
}

/**
 * Build fetch params for an OpenAI-compatible chat completions endpoint.
 * This works for BytePlus, OpenAI, Google (Gemini OpenAI-compat), and custom providers.
 * Anthropic is also supported via their OpenAI-compatible endpoint.
 */
export function buildRequest(config: MasterAIConfig, options: AIRequestOptions) {
  const { systemPrompt, messages, reasoningDepth, maxCompletionTokens = 4096 } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  const body: Record<string, unknown> = {
    model: config.modelId,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    max_completion_tokens: maxCompletionTokens,
    stream: true,
    stream_options: { include_usage: true },
  };

  // BytePlus Seed models support thinking/reasoning
  if (config.provider === "byteplus") {
    body.thinking = { type: reasoningDepth === "off" ? "disabled" : "enabled" };
    if (reasoningDepth && reasoningDepth !== "off") {
      body.reasoning_effort = reasoningDepth;
    }
  }

  return { url: config.apiUrl, headers, body };
}
