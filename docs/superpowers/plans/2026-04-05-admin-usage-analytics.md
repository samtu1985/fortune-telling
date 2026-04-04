# Admin Usage Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track API usage per user (calls, tokens, models) and display analytics in the admin panel with time range filtering.

**Architecture:** New `api_usage` DB table logs each AI call. SSE parser extracts token counts from provider responses. Admin API aggregates by user and time range. Admin page gets a new "Usage" tab with summary cards and detail table.

**Tech Stack:** Drizzle ORM (Neon Postgres), existing Next.js API routes, pure HTML/CSS (no chart library)

---

### Task 1: Add `api_usage` table to DB schema

**Files:**
- Modify: `app/lib/db/schema.ts`

- [ ] **Step 1: Add the apiUsage table definition**

Add after the `aiSettings` table (line 79) in `app/lib/db/schema.ts`:

```typescript
// ─── API Usage ──────────────────────────────────────────
export const apiUsage = pgTable("api_usage", {
  id: serial("id").primaryKey(),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  masterType: varchar("master_type", { length: 20 }).notNull(),
  mode: varchar("mode", { length: 10 }).notNull(), // "single" | "multi"
  provider: varchar("provider", { length: 50 }).notNull(),
  modelId: varchar("model_id", { length: 100 }).notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Push schema to database**

Run: `npx drizzle-kit push`

Expected: Table `api_usage` created in Neon.

- [ ] **Step 3: Commit**

```bash
git add app/lib/db/schema.ts
git commit -m "feat: add api_usage table for tracking AI call metrics"
```

---

### Task 2: Extend SSE parser to extract token usage

**Files:**
- Modify: `app/lib/ai-client.ts`

- [ ] **Step 1: Update parseSSELine return type and add usage parsing**

In `app/lib/ai-client.ts`, change the `parseSSELine` function signature and implementation:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/lib/ai-client.ts
git commit -m "feat: extract token usage from SSE responses (OpenAI + Anthropic)"
```

---

### Task 3: Create usage logging module

**Files:**
- Create: `app/lib/usage.ts`

- [ ] **Step 1: Create the logUsage function**

Create `app/lib/usage.ts`:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/lib/usage.ts
git commit -m "feat: add logUsage module for fire-and-forget usage tracking"
```

---

### Task 4: Wire usage logging into divine route

**Files:**
- Modify: `app/api/divine/route.ts`

- [ ] **Step 1: Add imports and get user email**

At the top of `app/api/divine/route.ts`, add imports:

```typescript
import { auth } from "@/app/lib/auth";
import { logUsage } from "@/app/lib/usage";
```

Inside the `POST` function, after parsing the body, add:

```typescript
  const session = await auth();
  const userEmail = session?.user?.email || "unknown";
```

- [ ] **Step 2: Accumulate usage and log after stream**

Inside the `ReadableStream.start()` callback, before `let buffer = ""`, add:

```typescript
      let totalInput = 0;
      let totalOutput = 0;
```

Inside the SSE parsing loop, after `if (result.done)` block, add:

```typescript
          if (result.usage) {
            totalInput += result.usage.input;
            totalOutput += result.usage.output;
            continue;
          }
```

After the `while (true)` loop ends (after line `}`), before `controller.close()`, add:

```typescript
      // Log usage (fire-and-forget)
      logUsage({
        userEmail,
        masterType: type,
        mode: "single",
        provider: config.provider,
        modelId: config.modelId,
        inputTokens: totalInput,
        outputTokens: totalOutput,
      });
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/divine/route.ts
git commit -m "feat: log API usage in divine route (single mode)"
```

---

### Task 5: Wire usage logging into divine-multi route

**Files:**
- Modify: `app/api/divine-multi/route.ts`

- [ ] **Step 1: Add imports and get user email**

At the top of `app/api/divine-multi/route.ts`, add imports:

```typescript
import { auth } from "@/app/lib/auth";
import { logUsage } from "@/app/lib/usage";
```

Inside the `POST` function, after parsing the body, add:

```typescript
  const session = await auth();
  const userEmail = session?.user?.email || "unknown";
```

- [ ] **Step 2: Accumulate usage and log after stream**

Inside the `ReadableStream.start()` callback, after `let buffer = ""`, add:

```typescript
      let totalInput = 0;
      let totalOutput = 0;
```

Inside the SSE parsing loop, after `if (result.done)` block, add:

```typescript
            if (result.usage) {
              totalInput += result.usage.input;
              totalOutput += result.usage.output;
              continue;
            }
```

In the `finally` block (after `clearInterval(keepalive)`), add:

```typescript
        // Log usage (fire-and-forget)
        logUsage({
          userEmail,
          masterType: master,
          mode: "multi",
          provider: config.provider,
          modelId: config.modelId,
          inputTokens: totalInput,
          outputTokens: totalOutput,
        });
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/divine-multi/route.ts
git commit -m "feat: log API usage in divine-multi route (multi mode)"
```

---

### Task 6: Create admin usage query API

**Files:**
- Create: `app/api/admin/usage/route.ts`

- [ ] **Step 1: Create the GET handler**

Create `app/api/admin/usage/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";
import { db } from "@/app/lib/db";
import { apiUsage, users } from "@/app/lib/db/schema";
import { gte, sql, eq } from "drizzle-orm";

const RANGE_DAYS: Record<string, number> = {
  "1d": 1,
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

async function checkAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.email === ADMIN_EMAIL;
}

export async function GET(request: NextRequest) {
  if (!(await checkAdmin())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const range = request.nextUrl.searchParams.get("range") || "1m";
  const days = RANGE_DAYS[range] || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Aggregate by user
    const rows = await db
      .select({
        userEmail: apiUsage.userEmail,
        calls: sql<number>`count(*)::int`,
        inputTokens: sql<number>`coalesce(sum(${apiUsage.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${apiUsage.outputTokens}), 0)::int`,
        models: sql<string>`string_agg(distinct ${apiUsage.modelId}, ',')`,
      })
      .from(apiUsage)
      .where(gte(apiUsage.createdAt, since))
      .groupBy(apiUsage.userEmail)
      .orderBy(sql`count(*) desc`);

    // Get user names
    const allUsers = await db
      .select({ email: users.email, name: users.name, image: users.image })
      .from(users);
    const userMap = new Map(allUsers.map((u) => [u.email, u]));

    let totalCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const byUser = rows.map((row) => {
      totalCalls += row.calls;
      totalInputTokens += row.inputTokens;
      totalOutputTokens += row.outputTokens;

      const user = userMap.get(row.userEmail);
      // Build model count map
      const modelList = (row.models || "").split(",").filter(Boolean);
      const models: Record<string, number> = {};
      for (const m of modelList) {
        models[m] = (models[m] || 0) + 1;
      }

      return {
        email: row.userEmail,
        name: user?.name || null,
        image: user?.image || null,
        calls: row.calls,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        models,
      };
    });

    return Response.json({
      range,
      summary: { totalCalls, totalInputTokens, totalOutputTokens },
      byUser,
    });
  } catch (e) {
    console.error("[admin/usage] Failed:", e);
    return Response.json({ error: "Failed to query usage data" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/usage/route.ts
git commit -m "feat: add admin usage query API with time range filtering"
```

---

### Task 7: Add i18n keys for usage tab

**Files:**
- Modify: `app/lib/i18n.ts`

- [ ] **Step 1: Add usage translation keys to all 4 locales**

Add the following keys to each locale in `app/lib/i18n.ts`:

**zh-Hant:**
```typescript
    "admin.usageTab": "使用量統計",
    "admin.totalCalls": "API 呼叫次數",
    "admin.totalInputTokens": "Input Tokens",
    "admin.totalOutputTokens": "Output Tokens",
    "admin.usageUser": "使用者",
    "admin.usageCalls": "呼叫次數",
    "admin.usageModels": "使用模型",
    "admin.noUsageData": "此區間無使用紀錄",
    "admin.range1d": "1D",
    "admin.range1w": "1W",
    "admin.range1m": "1M",
    "admin.range3m": "3M",
    "admin.range6m": "6M",
    "admin.range1y": "1Y",
```

**zh-Hans:**
```typescript
    "admin.usageTab": "使用量统计",
    "admin.totalCalls": "API 调用次数",
    "admin.totalInputTokens": "Input Tokens",
    "admin.totalOutputTokens": "Output Tokens",
    "admin.usageUser": "用户",
    "admin.usageCalls": "调用次数",
    "admin.usageModels": "使用模型",
    "admin.noUsageData": "此区间无使用记录",
    "admin.range1d": "1D",
    "admin.range1w": "1W",
    "admin.range1m": "1M",
    "admin.range3m": "3M",
    "admin.range6m": "6M",
    "admin.range1y": "1Y",
```

**en:**
```typescript
    "admin.usageTab": "Usage",
    "admin.totalCalls": "API Calls",
    "admin.totalInputTokens": "Input Tokens",
    "admin.totalOutputTokens": "Output Tokens",
    "admin.usageUser": "User",
    "admin.usageCalls": "Calls",
    "admin.usageModels": "Models",
    "admin.noUsageData": "No usage data in this range",
    "admin.range1d": "1D",
    "admin.range1w": "1W",
    "admin.range1m": "1M",
    "admin.range3m": "3M",
    "admin.range6m": "6M",
    "admin.range1y": "1Y",
```

**ja:**
```typescript
    "admin.usageTab": "使用量",
    "admin.totalCalls": "API呼び出し回数",
    "admin.totalInputTokens": "Input Tokens",
    "admin.totalOutputTokens": "Output Tokens",
    "admin.usageUser": "ユーザー",
    "admin.usageCalls": "呼び出し回数",
    "admin.usageModels": "使用モデル",
    "admin.noUsageData": "この期間の使用データはありません",
    "admin.range1d": "1D",
    "admin.range1w": "1W",
    "admin.range1m": "1M",
    "admin.range3m": "3M",
    "admin.range6m": "6M",
    "admin.range1y": "1Y",
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/i18n.ts
git commit -m "feat: add i18n keys for usage analytics tab"
```

---

### Task 8: Add usage tab to admin page

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Add "usage" to the Tab type and state**

Find the `type Tab` definition and change it from `"users" | "ai"` to:

```typescript
type Tab = "users" | "ai" | "usage";
```

- [ ] **Step 2: Add usage state variables**

After the existing state declarations, add:

```typescript
  const [usageRange, setUsageRange] = useState("1m");
  const [usageData, setUsageData] = useState<{
    summary: { totalCalls: number; totalInputTokens: number; totalOutputTokens: number };
    byUser: { email: string; name: string | null; image: string | null; calls: number; inputTokens: number; outputTokens: number; models: Record<string, number> }[];
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
```

- [ ] **Step 3: Add usage fetch function**

Add a `fetchUsage` callback:

```typescript
  const fetchUsage = useCallback(async (range: string) => {
    setUsageLoading(true);
    try {
      const res = await fetch(`/api/admin/usage?range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setUsageData(data);
      }
    } catch (e) {
      console.error("[admin] Failed to fetch usage:", e);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "usage") {
      fetchUsage(usageRange);
    }
  }, [activeTab, usageRange, fetchUsage]);
```

- [ ] **Step 4: Add a token formatting helper inside the component**

```typescript
  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };
```

- [ ] **Step 5: Add the usage tab button**

In the tabs section, after the AI tab button, add a third tab button:

```tsx
          <button
            onClick={() => setActiveTab("usage")}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === "usage"
                ? "text-gold"
                : "text-stone/60 hover:text-stone"
            }`}
          >
            {t("admin.usageTab")}
            {activeTab === "usage" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
```

- [ ] **Step 6: Add the usage tab content**

Inside the tab content section (after the AI settings section), add:

```tsx
        {activeTab === "usage" && (
          <>
            {/* Time range selector */}
            <div className="flex justify-center gap-1 mb-6">
              {(["1d", "1w", "1m", "3m", "6m", "1y"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setUsageRange(r)}
                  className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                    usageRange === r
                      ? "bg-gold/20 text-gold border border-gold/30"
                      : "text-stone/60 hover:text-stone border border-transparent"
                  }`}
                >
                  {t(`admin.range${r}` as string)}
                </button>
              ))}
            </div>

            {usageLoading ? (
              <div className="text-center py-12">
                <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              </div>
            ) : usageData ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="rounded-lg border border-gold/10 p-4 text-center" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
                    <p className="text-2xl font-bold text-gold">{usageData.summary.totalCalls}</p>
                    <p className="text-xs text-stone/60 mt-1">{t("admin.totalCalls")}</p>
                  </div>
                  <div className="rounded-lg border border-gold/10 p-4 text-center" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
                    <p className="text-2xl font-bold text-gold">{formatTokens(usageData.summary.totalInputTokens)}</p>
                    <p className="text-xs text-stone/60 mt-1">{t("admin.totalInputTokens")}</p>
                  </div>
                  <div className="rounded-lg border border-gold/10 p-4 text-center" style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}>
                    <p className="text-2xl font-bold text-gold">{formatTokens(usageData.summary.totalOutputTokens)}</p>
                    <p className="text-xs text-stone/60 mt-1">{t("admin.totalOutputTokens")}</p>
                  </div>
                </div>

                {/* User detail table */}
                {usageData.byUser.length === 0 ? (
                  <p className="text-center text-stone/60 py-12">{t("admin.noUsageData")}</p>
                ) : (
                  <div className="space-y-3">
                    {usageData.byUser.map((user) => (
                      <div
                        key={user.email}
                        className="rounded-lg border border-gold/10 p-4"
                        style={{ backgroundColor: "rgba(var(--glass-rgb), 0.02)" }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          {user.image ? (
                            <img src={user.image} alt="" className="w-8 h-8 rounded-full border border-gold/20" />
                          ) : (
                            <div className="w-8 h-8 rounded-full border border-gold/20 bg-gold/10 flex items-center justify-center text-xs text-gold">
                              {user.name?.[0] || "?"}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-cream font-medium truncate">{user.name || user.email}</p>
                            <p className="text-xs text-stone/50 truncate">{user.email}</p>
                          </div>
                          <span className="text-lg font-bold text-gold">{user.calls}</span>
                          <span className="text-xs text-stone/50">{t("admin.usageCalls")}</span>
                        </div>
                        <div className="flex gap-4 text-xs text-stone/60">
                          <span>Input: <span className="text-cream">{formatTokens(user.inputTokens)}</span></span>
                          <span>Output: <span className="text-cream">{formatTokens(user.outputTokens)}</span></span>
                        </div>
                        {Object.keys(user.models).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {Object.keys(user.models).map((model) => (
                              <span key={model} className="text-[10px] px-2 py-0.5 rounded-full border border-gold/15 text-stone/60">
                                {model}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
```

- [ ] **Step 7: Verify TypeScript compiles and build succeeds**

Run: `npx tsc --noEmit && npx next build`

Expected: No errors, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: add usage analytics tab to admin panel"
```

---

### Task 9: Push schema and deploy

- [ ] **Step 1: Push DB schema to Neon**

Run: `npx drizzle-kit push`

Expected: `api_usage` table created.

- [ ] **Step 2: Push all commits to remote**

```bash
git push
```

Expected: Vercel auto-deploys.
