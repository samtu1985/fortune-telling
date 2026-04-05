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
    stream: true,
    stream_options: { include_usage: true },
  };

  // Google Gemini uses max_tokens; others use max_completion_tokens
  if (config.provider === "google") {
    body.max_tokens = maxCompletionTokens;
  } else {
    body.max_completion_tokens = maxCompletionTokens;
  }

  // BytePlus Seed models support thinking/reasoning
  if (config.provider === "byteplus") {
    const depth = config.reasoningDepth || reasoningDepth || "high";
    body.thinking = { type: depth === "off" ? "disabled" : "enabled" };
    if (depth !== "off") {
      body.reasoning_effort = depth;
    }
  }

  // Google Gemini 3/2.5 models support thinking via reasoning_effort
  // Maps to thinkingLevel (Gemini 3) or thinkingBudget (Gemini 2.5)
  // via the OpenAI-compatible endpoint
  if (config.provider === "google") {
    const effort = config.effort || config.reasoningDepth || "high";
    if (effort !== "off") {
      body.reasoning_effort = effort;
    }
  }

  return { url: config.apiUrl, headers, body, isAnthropic: false };
}

function buildAnthropicRequest(config: MasterAIConfig, options: AIRequestOptions) {
  const { systemPrompt, messages, maxCompletionTokens = 4096 } = options;

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

  // Ensure messages start with a user message (Anthropic requirement)
  if (anthropicMessages.length > 0 && anthropicMessages[0].role !== "user") {
    anthropicMessages.unshift({ role: "user", content: "請開始分析。" });
  }

  let finalMaxTokens = maxCompletionTokens;

  const body: Record<string, unknown> = {
    model: config.modelId,
    system: systemPrompt,
    messages: anthropicMessages,
    stream: true,
  };

  // Apply thinking config from admin settings
  const thinkingMode = config.thinkingMode || "disabled";

  if (thinkingMode === "adaptive") {
    // New-style: adaptive thinking + effort level (Opus 4.6, Sonnet 4.6)
    body.thinking = { type: "adaptive" };
    if (config.effort) {
      body.output_config = { effort: config.effort };
    }
  } else if (thinkingMode === "enabled") {
    // Legacy: fixed budget (older models: Sonnet 4, Opus 4, etc.)
    const budget = config.thinkingBudget || 5000;
    body.thinking = { type: "enabled", budget_tokens: budget };
    // max_tokens must be > budget_tokens
    if (finalMaxTokens <= budget) {
      finalMaxTokens = budget + maxCompletionTokens;
    }
  }

  body.max_tokens = finalMaxTokens;

  return { url: config.apiUrl, headers, body, isAnthropic: true };
}

/**
 * Parse an SSE line from either OpenAI or Anthropic streaming format,
 * returning { content?, reasoning?, done?, usage? }.
 */
export function parseSSELine(
  data: string,
  isAnthropic: boolean
): { content?: string; reasoning?: string; done?: boolean; usage?: { input: number; output: number } } | null {
  if (data === "[DONE]") return { done: true };

  try {
    const parsed = JSON.parse(data);

    if (isAnthropic) {
      if (parsed.type === "error") {
        const errMsg = parsed.error?.message || "Anthropic API 錯誤";
        return { content: `\n\n[錯誤] ${errMsg}`, done: true };
      }
      if (parsed.type === "message_stop") return { done: true };
      // Anthropic sends usage in message_delta event
      if (parsed.type === "message_delta" && parsed.usage) {
        return {
          usage: {
            input: parsed.usage.input_tokens || 0,
            output: parsed.usage.output_tokens || 0,
          },
        };
      }
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

    // OpenAI-compatible: usage arrives in the final chunk
    if (parsed.usage) {
      return {
        usage: {
          input: parsed.usage.prompt_tokens || 0,
          output: parsed.usage.completion_tokens || 0,
        },
      };
    }

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
