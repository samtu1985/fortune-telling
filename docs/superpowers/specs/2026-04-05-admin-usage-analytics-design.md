# Admin Usage Analytics

Add API usage tracking and analytics dashboard to the admin panel.

## Database

New `api_usage` table in Drizzle schema:

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| userEmail | varchar, not null | Caller email |
| masterType | varchar, not null | bazi / ziwei / zodiac |
| mode | varchar, not null | "single" or "multi" |
| provider | varchar, not null | anthropic / openai / byteplus / google / custom |
| modelId | varchar, not null | Actual model ID used |
| inputTokens | integer, default 0 | From SSE response |
| outputTokens | integer, default 0 | From SSE response |
| createdAt | timestamptz, default now | Call timestamp |

No foreign key to users table — use email directly for simpler aggregation queries.

## SSE Parser Changes

Extend `parseSSELine()` return type in `app/lib/ai-client.ts` to include:

```typescript
usage?: { input: number; output: number }
```

### OpenAI-compatible format (BytePlus, OpenAI, Google, Custom)

Token usage arrives in the final SSE chunk when `stream_options.include_usage` is true:

```json
{"usage": {"prompt_tokens": 100, "completion_tokens": 50}}
```

Parse from `parsed.usage.prompt_tokens` and `parsed.usage.completion_tokens`.

### Anthropic format

Token usage arrives in `message_delta` event:

```json
{"type": "message_delta", "usage": {"input_tokens": 100, "output_tokens": 50}}
```

Parse from `parsed.usage.input_tokens` and `parsed.usage.output_tokens`.

## Usage Logging

New module `app/lib/usage.ts`:

```typescript
async function logUsage(params: {
  userEmail: string;
  masterType: string;
  mode: "single" | "multi";
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void>
```

Fire-and-forget — errors logged but never block the response.

## API Route Changes

### `app/api/divine/route.ts`

1. Get user email from `auth()` session at the start of POST handler.
2. Accumulate `usage` from `parseSSELine()` during streaming.
3. After stream completes, call `logUsage()` with mode `"single"`.

### `app/api/divine-multi/route.ts`

Same approach, mode `"multi"`. Each master call logs separately.

## Query API

### `GET /api/admin/usage`

**Auth:** Admin only (same `checkAdmin()` pattern as other admin routes).

**Query params:**
- `range`: `1d` | `1w` | `1m` | `3m` | `6m` | `1y` (default `1m`)

**Response:**

```json
{
  "range": "1m",
  "summary": {
    "totalCalls": 150,
    "totalInputTokens": 500000,
    "totalOutputTokens": 200000
  },
  "byUser": [
    {
      "email": "user@example.com",
      "name": "User Name",
      "calls": 50,
      "inputTokens": 120000,
      "outputTokens": 80000,
      "models": { "claude-sonnet-4-6": 30, "seed-2-0-pro": 20 }
    }
  ]
}
```

`byUser` sorted by `calls` descending. `name` joined from users table.

Range mapping:
- `1d` → last 24 hours
- `1w` → last 7 days
- `1m` → last 30 days
- `3m` → last 90 days
- `6m` → last 180 days
- `1y` → last 365 days

## Admin Frontend

New tab in `app/admin/page.tsx`: add `"usage"` to the tab type.

### Layout

1. **Time range selector** — horizontal button group: 1D | 1W | 1M | 3M | 6M | 1Y
2. **Summary cards** — 3 cards in a row:
   - Total API Calls
   - Total Input Tokens (formatted with K/M suffix)
   - Total Output Tokens (formatted with K/M suffix)
3. **User detail table** — columns:
   - User (avatar + name + email)
   - Calls
   - Input Tokens
   - Output Tokens
   - Models Used (comma-separated badges)

All i18n keys added for the new UI strings.

No chart library — pure HTML/CSS with the existing design system.

## Files Changed

- `app/lib/db/schema.ts` — add `apiUsage` table
- `app/lib/ai-client.ts` — extend `parseSSELine()` to return usage
- `app/lib/usage.ts` — new: `logUsage()` function
- `app/api/divine/route.ts` — add auth, accumulate usage, log after stream
- `app/api/divine-multi/route.ts` — same
- `app/api/admin/usage/route.ts` — new: query API
- `app/admin/page.tsx` — add usage tab with summary + table
- `app/lib/i18n.ts` — add usage-related translation keys

## Migration

Run `drizzle-kit push` after schema change to create the `api_usage` table in Neon.
