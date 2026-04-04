import { db } from "./db";
import { apiUsage } from "./db/schema";

export async function logUsage(params: {
  userEmail: string;
  masterType: string;
  mode: "single" | "multi";
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  try {
    await db.insert(apiUsage).values({
      userEmail: params.userEmail,
      masterType: params.masterType,
      mode: params.mode,
      provider: params.provider,
      modelId: params.modelId,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
    });
  } catch (e) {
    console.error("[usage] Failed to log usage:", e);
  }
}
