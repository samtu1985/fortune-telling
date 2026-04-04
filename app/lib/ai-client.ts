import type { MasterAIConfig } from "./ai-settings";

interface AIRequestOptions {
  systemPrompt: string;
  messages: { role: string; content: string | object[] }[];
  reasoningDepth?: string;
  maxCompletionTokens?: number;
}

/**
 * Build fetch params for chat completion APIs.
 * Handles OpenAI-compatible (BytePlus, OpenAI, Google, custom) and Anthropic Messages API.
 */
export function buildRequest(config: MasterAIConfig, options: AIRequestOptions) {
  const { systemPrompt, messages, reasoningDepth, maxCompletionTokens = 4096 } = options;

  // Anthropic uses a completely different API format
  if (config.provider === "anthropic") {
    return buildAnthropicRequest(config, options);
  }

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

  return { url: config.apiUrl, headers, body, isAnthropic: false };
}

function buildAnthropicRequest(config: MasterAIConfig, options: AIRequestOptions) {
  const { systemPrompt, messages, reasoningDepth, maxCompletionTokens = 4096 } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey,
    "anthropic-version": "2023-06-01",
  };

  // Convert messages: merge consecutive same-role, ensure alternating user/assistant
  const anthropicMessages: { role: string; content: string }[] = [];
  for (const msg of messages) {
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    const role = msg.role === "user" ? "user" : "assistant";
    const last = anthropicMessages[anthropicMessages.length - 1];
    if (last && last.role === role) {
      last.content += "\n\n" + content;
    } else {
      anthropicMessages.push({ role, content });
    }
  }

  const body: Record<string, unknown> = {
    model: config.modelId,
    system: systemPrompt,
    messages: anthropicMessages,
    max_tokens: maxCompletionTokens,
    stream: true,
  };

  // Extended thinking for Claude
  if (reasoningDepth && reasoningDepth !== "off") {
    const budgetMap: Record<string, number> = { high: 10000, medium: 5000, low: 2000 };
    body.thinking = {
      type: "enabled",
      budget_tokens: budgetMap[reasoningDepth] || 5000,
    };
    // When thinking is enabled, max_tokens must be larger than budget
    body.max_tokens = maxCompletionTokens + (budgetMap[reasoningDepth] || 5000);
  }

  return { url: config.apiUrl, headers, body, isAnthropic: true };
}

/**
 * Parse an SSE line from either OpenAI or Anthropic streaming format,
 * returning { content?, reasoning?, done? }.
 */
export function parseSSELine(
  data: string,
  isAnthropic: boolean
): { content?: string; reasoning?: string; done?: boolean } | null {
  if (data === "[DONE]") return { done: true };

  try {
    const parsed = JSON.parse(data);

    if (isAnthropic) {
      // Anthropic SSE events:
      // content_block_delta with type "text_delta" → content
      // content_block_delta with type "thinking_delta" → reasoning
      // message_stop → done
      if (parsed.type === "message_stop") return { done: true };
      if (parsed.type === "content_block_delta") {
        if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
          return { content: parsed.delta.text };
        }
        if (parsed.delta?.type === "thinking_delta" && parsed.delta.thinking) {
          return { reasoning: parsed.delta.thinking };
        }
      }
      return null;
    }

    // OpenAI-compatible format
    const delta = parsed.choices?.[0]?.delta;
    if (!delta) return null;
    const result: { content?: string; reasoning?: string } = {};
    if (delta.content) result.content = delta.content;
    if (delta.reasoning_content) result.reasoning = delta.reasoning_content;
    if (Object.keys(result).length > 0) return result;
    return null;
  } catch {
    return null;
  }
}
