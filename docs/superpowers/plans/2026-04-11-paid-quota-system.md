# Paid Quota + Stripe Payment System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce per-user quotas on divinations, let regular users buy credit top-ups via Stripe, give admins a Payment management page, and gate first-time logins with age verification.

**Architecture:** Four isolated subsystems — synchronous quota enforcement in `/api/divine*`, admin-managed `payment_packages` + Stripe Buy Button embeds for purchases, idempotent Stripe webhook for credit attribution, and admin dashboard reading local `purchases` table with live Stripe reconciliation.

**Tech Stack:** Next.js App Router (project uses a fork — see `node_modules/next/dist/docs/` before writing Next-specific code), Drizzle ORM, Neon Postgres, Stripe (new), Resend (existing email).

**Spec:** `docs/superpowers/specs/2026-04-11-paid-quota-system-design.md`

**Phases (each ships working software — pause & deploy between phases):**
- **Phase 1 (Tasks 1–8):** Schema + quota enforcement + age gate. Ships: regular users get blocked at quota limits, minors get gated, admins/ambassadors/friends bypass.
- **Phase 2 (Tasks 9–15):** Stripe integration + purchase flow + webhook. Ships: end-to-end purchase, credit grants, refund deductions, admin email notifications.
- **Phase 3 (Tasks 16–22):** Admin Payment tab (packages CRUD + dashboard + reconciliation) + end-user purchase history. Ships: full admin operations.

---

## File Structure

### Phase 1 — Quota & Age Gate

**New files:**
- `app/lib/quota.ts` — `isExempt`, `checkQuota`, `consumeQuota`, `QuotaCheck` type
- `app/lib/quota.test.ts` — unit tests
- `app/api/me/verify-age/route.ts` — POST handler for age verification
- `app/components/AgeVerificationModal.tsx` — blocking modal on first login
- `app/components/MinorWelcomeModal.tsx` — secondary modal for users under 18
- `drizzle/migrations/NNNN_quota_and_age.sql` — migration for new columns + backfill

**Modified files:**
- `app/lib/db/schema.ts` — add `birthDate`, `ageVerifiedAt`, `canPurchase` to users
- `app/api/divine/route.ts` — insert `checkQuota` / `consumeQuota`, replace manual `singleUsed++`
- `app/api/divine-multi/route.ts` — same, with `'multi'`
- `app/(protected)/layout.tsx` — render age modal when `ageVerifiedAt === null`

### Phase 2 — Stripe Purchase Flow

**New files:**
- `app/lib/stripe.ts` — Stripe SDK singleton + helpers
- `app/api/webhooks/stripe/route.ts` — idempotent webhook handler
- `app/api/webhooks/stripe/route.test.ts` — integration tests
- `app/api/packages/route.ts` — `GET` public list of active packages
- `app/components/PurchaseModal.tsx` — dynamic buy-button cards (premium design — use frontend-design skill)
- `app/components/ThanksForTryingModal.tsx` — minor-friendly copy, no purchase link
- `app/components/QuotaExhaustedGate.tsx` — client component that intercepts 402 and opens the right modal
- `drizzle/migrations/NNNN_payments_tables.sql` — packages + purchases + stripe_events tables

**Modified files:**
- `app/lib/db/schema.ts` — add `paymentPackages`, `purchases`, `stripeEvents` tables
- `app/lib/email.ts` — add `sendPurchaseAdminNotification`, `sendRefundAdminNotification`
- `app/(protected)/page.tsx` (and other places that call `/api/divine*`) — wrap fetch errors through `QuotaExhaustedGate`
- `package.json` — add `stripe` dependency

### Phase 3 — Admin Payment Tab + User History

**New files:**
- `app/api/admin/packages/route.ts` — GET (list) + POST (create)
- `app/api/admin/packages/[id]/route.ts` — PATCH + DELETE
- `app/api/admin/packages/verify/route.ts` — POST, calls Stripe to fetch price info
- `app/api/admin/payments/stats/route.ts` — GET, charts + stat cards
- `app/api/admin/payments/transactions/route.ts` — GET, paginated list
- `app/api/admin/payments/stripe-reconcile/route.ts` — GET, live Stripe call
- `app/api/admin/payments/connection/route.ts` — GET, returns env var presence only
- `app/api/me/purchases/route.ts` — GET, user's own history
- `app/components/admin/PaymentsTab.tsx` — sub-nav (packages | revenue)
- `app/components/admin/PackagesAdmin.tsx` — table + create/edit modal
- `app/components/admin/RevenueDashboard.tsx` — cards + charts + list + reconciliation
- `app/components/account/PurchaseHistory.tsx` — end-user history section

**Modified files:**
- `app/admin/page.tsx` — add `'payments'` to Tab type, render `<PaymentsTab />`
- End-user account page (location TBD during Phase 3 — grep for existing account settings page) — insert `<PurchaseHistory />`

---

# PHASE 1 — Quota Enforcement & Age Gate

## Task 1: Schema — add user columns + create migration file

**Files:**
- Modify: `app/lib/db/schema.ts:16-35`
- Create: `drizzle/migrations/NNNN_quota_and_age.sql` (NNNN = next unused number — run `ls drizzle/migrations` to check)

- [ ] **Step 1: Add columns to users table in schema.ts**

Add these three lines to the `users` pgTable definition, right after the existing `multiUsed` column:

```ts
  // Age verification + purchase gate
  birthDate: text("birth_date"),
  ageVerifiedAt: timestamp("age_verified_at", { withTimezone: true }),
  canPurchase: boolean("can_purchase").notNull().default(true),
```

(Note: `birthDate` uses `text` to match the existing `profiles.birthDate` convention in this codebase, not the Drizzle `date` type.)

- [ ] **Step 2: Generate/create migration SQL**

Check existing migrations: `ls drizzle/migrations/`. Create a new file with the next sequential number, e.g. `0001_quota_and_age.sql`:

```sql
-- Add age verification + purchase gate columns
ALTER TABLE "users" ADD COLUMN "birth_date" text;
ALTER TABLE "users" ADD COLUMN "age_verified_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN "can_purchase" boolean NOT NULL DEFAULT true;

-- Backfill quota for all regular approved users.
-- Exempt: admin email, ambassadors, friends.
-- Run with psql var: psql ... -v admin_email="'geektu@gmail.com'" -f ...
-- Or substitute ADMIN_EMAIL literal before applying.
UPDATE "users"
SET "single_credits" = 10,
    "multi_credits" = 2
WHERE "status" = 'approved'
  AND "is_ambassador" = false
  AND "is_friend" = false
  AND "email" <> 'geektu@gmail.com';  -- REPLACE with actual ADMIN_EMAIL at apply time
```

- [ ] **Step 3: Apply the migration**

```bash
npm run db:push   # or whatever command the repo uses — check package.json "scripts"
```

If `db:push` isn't present, use `npx drizzle-kit push` (the repo uses `drizzle-kit` per devDependencies). Verify in Neon console that the three columns exist and a regular user row has `single_credits=10, multi_credits=2`.

- [ ] **Step 4: Commit**

```bash
git add app/lib/db/schema.ts drizzle/migrations/0001_quota_and_age.sql
git commit -m "feat(db): add age + quota columns, backfill regular users to 10/2"
```

---

## Task 2: Write quota.ts helper with tests (TDD)

**Files:**
- Create: `app/lib/quota.ts`
- Create: `app/lib/quota.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
// app/lib/quota.test.ts
import { describe, it, expect } from "vitest";  // or jest — match repo's test runner
import { isExempt } from "./quota";

describe("isExempt", () => {
  const base = {
    id: 1, email: "user@example.com", isAmbassador: false, isFriend: false,
  } as any;

  it("returns true for admin email", () => {
    process.env.ADMIN_EMAIL = "admin@example.com";
    expect(isExempt({ ...base, email: "admin@example.com" })).toBe(true);
  });

  it("returns true for ambassadors", () => {
    expect(isExempt({ ...base, isAmbassador: true })).toBe(true);
  });

  it("returns true for friends", () => {
    expect(isExempt({ ...base, isFriend: true })).toBe(true);
  });

  it("returns false for regular users", () => {
    expect(isExempt(base)).toBe(false);
  });
});
```

First check `package.json` — does the repo have a test runner set up? If not, this plan assumes Vitest will be added. If the repo has zero tests today, skip the TDD tests for Phase 1 and add them in a follow-up — but still write `quota.ts` with the exact shape below.

- [ ] **Step 2: Create quota.ts with the minimal surface**

```ts
// app/lib/quota.ts
import { db } from "@/app/lib/db";
import { users } from "@/app/lib/db/schema";
import { sql, eq, and } from "drizzle-orm";

export type QuotaType = "single" | "multi";

export type QuotaCheck =
  | { ok: true; unlimited: true }
  | { ok: true; unlimited: false; remaining: number }
  | { ok: false; reason: "exhausted"; canPurchase: boolean };

export interface UserForQuota {
  id: number;
  email: string;
  isAmbassador: boolean;
  isFriend: boolean;
  singleCredits: number;
  multiCredits: number;
  singleUsed: number;
  multiUsed: number;
  canPurchase: boolean;
}

export function isExempt(user: Pick<UserForQuota, "email" | "isAmbassador" | "isFriend">): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && user.email === adminEmail) return true;
  if (user.isAmbassador) return true;
  if (user.isFriend) return true;
  return false;
}

export function checkQuota(user: UserForQuota, type: QuotaType): QuotaCheck {
  if (isExempt(user)) return { ok: true, unlimited: true };
  const credits = type === "single" ? user.singleCredits : user.multiCredits;
  const used = type === "single" ? user.singleUsed : user.multiUsed;
  const remaining = credits - used;
  if (remaining <= 0) {
    return { ok: false, reason: "exhausted", canPurchase: user.canPurchase };
  }
  return { ok: true, unlimited: false, remaining };
}

/**
 * Atomically consume one unit of quota. Returns true if consumed,
 * false if the user ran out between check and consume (race).
 * Exempt users always succeed and still bump the used counter for analytics.
 */
export async function consumeQuota(user: UserForQuota, type: QuotaType): Promise<boolean> {
  const exempt = isExempt(user);
  const usedCol = type === "single" ? "single_used" : "multi_used";
  const creditsCol = type === "single" ? "single_credits" : "multi_credits";

  // Conditional UPDATE: either the user is exempt, or used < credits.
  // Using raw SQL so the condition and increment happen atomically.
  const result = await db.execute(sql`
    UPDATE users
    SET ${sql.raw(`"${usedCol}"`)} = ${sql.raw(`"${usedCol}"`)} + 1
    WHERE id = ${user.id}
      AND (
        ${exempt ? sql`TRUE` : sql`${sql.raw(`"${usedCol}"`)} < ${sql.raw(`"${creditsCol}"`)}`}
      )
    RETURNING id
  `);
  return (result as any).rowCount > 0 || (Array.isArray(result) && result.length > 0);
}
```

**Note on raw SQL**: We use `db.execute` + `sql` template because the condition mixes a column-to-column comparison with a runtime branch. If the repo's Drizzle version exposes `.rowCount` differently, adjust the final `return` line to match (check `app/lib/db/index.ts` for how other routes read update results).

- [ ] **Step 3: Run tests (if present)**

```bash
npm test -- quota
```

Expected: all `isExempt` tests pass. If no test runner is set up, skip.

- [ ] **Step 4: Commit**

```bash
git add app/lib/quota.ts app/lib/quota.test.ts
git commit -m "feat(quota): add isExempt/checkQuota/consumeQuota helper"
```

---

## Task 3: Integrate quota check into /api/divine

**Files:**
- Modify: `app/api/divine/route.ts`

- [ ] **Step 1: Read the current route to find the auth resolution point and the existing singleUsed increment**

```bash
grep -n "singleUsed\|auth()\|getUser" app/api/divine/route.ts
```

Note the line numbers of:
1. Where the authenticated user object is obtained
2. Where `singleUsed` is currently incremented (spec said line 477)

- [ ] **Step 2: Add quota check right after user is loaded**

Import at the top of the file:

```ts
import { checkQuota, consumeQuota } from "@/app/lib/quota";
```

Immediately after the user is loaded (but before any expensive work like calling the AI provider), insert:

```ts
const quota = checkQuota(user, "single");
if (!quota.ok) {
  return Response.json(
    { error: "quota_exhausted", reason: quota.reason, canPurchase: quota.canPurchase },
    { status: 402 }
  );
}
```

- [ ] **Step 3: Replace the existing singleUsed increment with consumeQuota**

Find the existing update (probably `db.update(users).set({ singleUsed: ... })` or similar). Replace with:

```ts
const consumed = await consumeQuota(user, "single");
if (!consumed) {
  // Extremely rare race: another concurrent request consumed the last unit
  // between our check and consume. Refund-friendly behavior: return 402.
  return Response.json(
    { error: "quota_exhausted", reason: "exhausted", canPurchase: user.canPurchase },
    { status: 402 }
  );
}
```

**Important:** `consumeQuota` must run AFTER the AI call succeeds — if the AI call fails, we should NOT burn a credit. Place the consume call in the success path, immediately before returning the response to the client.

- [ ] **Step 4: Type the `user` object**

`checkQuota` expects `UserForQuota` fields. If the route currently fetches a narrower user, widen the `getUser` query or adapt — check `app/lib/users.ts` for what `getUser` returns, and make sure it includes `singleCredits, multiCredits, singleUsed, multiUsed, canPurchase, isAmbassador, isFriend`.

- [ ] **Step 5: Manual smoke test**

Start dev server, log in as a regular test user, hit the endpoint 11 times in a row. First 10 succeed, 11th returns HTTP 402 with body `{"error":"quota_exhausted","canPurchase":true}`.

- [ ] **Step 6: Commit**

```bash
git add app/api/divine/route.ts
git commit -m "feat(api): enforce single quota in /api/divine with 402 on exhaustion"
```

---

## Task 4: Integrate quota check into /api/divine-multi

**Files:**
- Modify: `app/api/divine-multi/route.ts`

- [ ] **Step 1: Apply the same pattern as Task 3, using `'multi'` as the QuotaType**

Same imports, same check placement, same consume placement — only substitute `"single"` → `"multi"`.

- [ ] **Step 2: Manual smoke test**

Log in as a regular user, trigger three-master discussions 3 times. Third call returns 402.

- [ ] **Step 3: Commit**

```bash
git add app/api/divine-multi/route.ts
git commit -m "feat(api): enforce multi quota in /api/divine-multi with 402 on exhaustion"
```

---

## Task 5: POST /api/me/verify-age endpoint

**Files:**
- Create: `app/api/me/verify-age/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/me/verify-age/route.ts
import { auth } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import { users } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const birthDate: string | undefined = body?.birthDate;
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return Response.json({ error: "invalid_birth_date" }, { status: 400 });
  }

  const birth = new Date(birthDate + "T00:00:00Z");
  const now = new Date();
  if (isNaN(birth.getTime()) || birth > now || birth.getUTCFullYear() < 1900) {
    return Response.json({ error: "invalid_birth_date" }, { status: 400 });
  }

  // Age computation: full years difference
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--;

  const canPurchase = age >= 18;

  await db
    .update(users)
    .set({
      birthDate,
      ageVerifiedAt: new Date(),
      canPurchase,
    })
    .where(eq(users.email, session.user.email));

  return Response.json({ canPurchase, age });
}
```

- [ ] **Step 2: Manual test via curl**

```bash
# In the dev server, get a session cookie first by logging in through the browser.
# Then:
curl -X POST http://localhost:3000/api/me/verify-age \
  -H "Content-Type: application/json" \
  -H "Cookie: <your session cookie>" \
  -d '{"birthDate":"2010-05-01"}'
# Expect: {"canPurchase":false,"age":15}
curl -X POST http://localhost:3000/api/me/verify-age \
  -H "Content-Type: application/json" \
  -H "Cookie: <your session cookie>" \
  -d '{"birthDate":"1990-05-01"}'
# Expect: {"canPurchase":true,"age":35}
```

Also verify the DB row was updated (both `birth_date`, `age_verified_at`, `can_purchase`).

- [ ] **Step 3: Commit**

```bash
git add app/api/me/verify-age/route.ts
git commit -m "feat(api): add POST /api/me/verify-age for age gate"
```

---

## Task 6: AgeVerificationModal + MinorWelcomeModal components

**Files:**
- Create: `app/components/AgeVerificationModal.tsx`
- Create: `app/components/MinorWelcomeModal.tsx`

- [ ] **Step 1: Create AgeVerificationModal**

```tsx
// app/components/AgeVerificationModal.tsx
"use client";
import { useState } from "react";
import MinorWelcomeModal from "./MinorWelcomeModal";

function computeAge(birthDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const birth = new Date(birthDate + "T00:00:00Z");
  const now = new Date();
  if (isNaN(birth.getTime()) || birth > now) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

export default function AgeVerificationModal() {
  const [birthDate, setBirthDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minorConfirmed, setMinorConfirmed] = useState(false);

  const age = computeAge(birthDate);
  const today = new Date().toISOString().slice(0, 10);

  async function submit() {
    if (!birthDate || age === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/me/verify-age", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "驗證失敗");
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      if (data.canPurchase === false) {
        setMinorConfirmed(true);
      } else {
        window.location.reload();  // refresh layout so modal no longer mounts
      }
    } catch (e) {
      setError("網路錯誤");
      setSubmitting(false);
    }
  }

  if (minorConfirmed) {
    return <MinorWelcomeModal onDismiss={() => window.location.reload()} />;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-2xl">
        <h2 className="mb-2 text-xl font-semibold text-[#7a5c10]">請先完成年齡驗證</h2>
        <p className="mb-4 text-sm text-[#847b72]">
          依站點政策，開始使用前需要確認您的年齡。您的生日資訊會用於日後的命理分析。
        </p>
        <label className="mb-2 block text-sm text-[#1e1a14]">生日</label>
        <input
          type="date"
          max={today}
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="w-full rounded border border-[#c8bfa8] px-3 py-2 text-base"
        />
        {age !== null && (
          <p className="mt-2 text-sm text-[#847b72]">您現在 {age} 歲</p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={submit}
          disabled={!birthDate || age === null || submitting}
          className="mt-6 w-full rounded bg-[#7a5c10] py-3 text-white disabled:opacity-40"
        >
          {submitting ? "驗證中..." : "確認"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create MinorWelcomeModal**

```tsx
// app/components/MinorWelcomeModal.tsx
"use client";
export default function MinorWelcomeModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-2xl text-center">
        <div className="mb-4 text-4xl">🌱</div>
        <h2 className="mb-3 text-xl font-semibold text-[#7a5c10]">感謝您的體驗</h2>
        <p className="mb-6 text-sm leading-relaxed text-[#1e1a14]">
          您目前可以完整使用 10 次個別問答與 2 次三師論道。
          <br />
          人生的路還很長，未來還有無限可能，不必執著於先天命運。
        </p>
        <button
          onClick={onDismiss}
          className="w-full rounded bg-[#7a5c10] py-3 text-white"
        >
          開始體驗
        </button>
      </div>
    </div>
  );
}
```

**Styling note:** Tailwind classes are placeholders matching the `#7a5c10` palette visible in `app/lib/email.ts`. If the project uses a different design token system, reskin to match. Visual polish is not critical for Phase 1 — the age modal is compliance, not marketing. The **purchase modal** (Task 12) is the one that MUST go through frontend-design skill.

- [ ] **Step 3: Commit**

```bash
git add app/components/AgeVerificationModal.tsx app/components/MinorWelcomeModal.tsx
git commit -m "feat(ui): age verification + minor welcome modals"
```

---

## Task 7: Wire age modal into protected layout

**Files:**
- Modify: `app/(protected)/layout.tsx`
- Modify: `app/lib/users.ts` — ensure `getUser` returns `ageVerifiedAt`, `canPurchase`

- [ ] **Step 1: Widen getUser result**

Open `app/lib/users.ts`, find the `getUser` function. Make sure the SELECT / Drizzle query returns the new columns (`birthDate`, `ageVerifiedAt`, `canPurchase`). If it uses a type-safe Drizzle `db.select().from(users)`, this is automatic. If it uses a manual field list, add the three columns.

- [ ] **Step 2: Render modal in layout**

Modify `app/(protected)/layout.tsx`. After the `ADMIN_EMAIL` early return (line 36-38) and before the pending check (line 40), add:

```tsx
  // Admin always has access (existing code at line 36-38)
  if (email === ADMIN_EMAIL) {
    return <>{children}</>;
  }

  if (!userData || userData.status === "pending" || userData.status === "unverified") {
    return <PendingScreen type="pending" />;
  }

  if (userData.status === "disabled") {
    return <PendingScreen type="disabled" />;
  }

  // NEW: age verification gate — blocks approved users who haven't verified yet
  if (!userData.ageVerifiedAt) {
    const AgeVerificationModal = (await import("@/app/components/AgeVerificationModal")).default;
    return (
      <>
        {children}
        <AgeVerificationModal />
      </>
    );
  }

  return <>{children}</>;
```

Why render children behind the modal instead of replacing them: the modal is a blocking overlay (fixed inset-0 z-50), so the page loads but is unreachable. This avoids a full re-render when the modal closes.

- [ ] **Step 3: Smoke test**

1. In DB, set a test user's `age_verified_at = NULL`.
2. Log in as that user → modal appears, cannot be dismissed.
3. Enter `2010-01-01` → `MinorWelcomeModal` appears → click 「開始體驗」 → page reloads, no modal.
4. In DB, check `can_purchase = false`, `age_verified_at` is a timestamp.
5. Reset `age_verified_at = NULL`, log in again, enter `1990-01-01` → page reloads directly, `can_purchase = true`.

- [ ] **Step 4: Commit**

```bash
git add app/\(protected\)/layout.tsx app/lib/users.ts
git commit -m "feat(layout): block first-login users with age verification modal"
```

---

## Task 8: Phase 1 end-to-end validation

- [ ] **Step 1: Verify full flow on fresh test account**

1. Create a new test user, go through email verification + admin approval.
2. First login: age modal appears (confirm 1990 DOB → 通過).
3. Make 10 single-Q&A calls → all succeed.
4. Make 11th → returns 402 with `canPurchase: true`.
5. Make 2 multi-master calls → succeed.
6. Make 3rd → returns 402 with `canPurchase: true`.
7. Confirm admin / ambassador / friend users are NOT blocked (test with at least one ambassador account).

- [ ] **Step 2: Verify minor flow**

1. Reset a test user, log in, enter 2015 DOB.
2. Confirm `can_purchase = false`.
3. Use up the 10 single quota.
4. Note: the 402 response now contains `canPurchase: false`. Phase 2 will wire this into the Thanks modal; for now just confirm the response shape is correct via browser devtools.

- [ ] **Step 3: Commit Phase 1 closing tag**

```bash
git commit --allow-empty -m "chore: phase 1 of paid-quota system complete (quota + age gate)"
```

**Phase 1 ships at this commit.** You can deploy now — regular users get blocked, minors gated, exempt roles untouched. Users can't buy credits yet (that's Phase 2), but the system degrades gracefully (they hit 402 and see a generic error until purchase modal exists).

---

# PHASE 2 — Stripe Purchase Flow

## Task 9: Install Stripe + create stripe.ts singleton

**Files:**
- Modify: `package.json`
- Create: `app/lib/stripe.ts`

- [ ] **Step 1: Install Stripe SDK**

```bash
npm install stripe
```

- [ ] **Step 2: Create the singleton**

```ts
// app/lib/stripe.ts
import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;

export const stripe = secret
  ? new Stripe(secret, { apiVersion: "2024-06-20" as any })
  : null;

export function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return stripe;
}

export function stripeConfigStatus() {
  return {
    secretKey: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    publishableKey: Boolean(process.env.STRIPE_PUBLISHABLE_KEY),
  };
}
```

The `apiVersion` string should match whatever version the installed `stripe` package recommends (check `node_modules/stripe/types/lib.d.ts` or the changelog). Cast to `any` if TS complains — Stripe pins types to specific API versions.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json app/lib/stripe.ts
git commit -m "feat(stripe): add SDK dependency and singleton helper"
```

---

## Task 10: Schema — payment_packages + purchases + stripe_events

**Files:**
- Modify: `app/lib/db/schema.ts`
- Create: `drizzle/migrations/NNNN_payments_tables.sql`

- [ ] **Step 1: Add three tables to schema.ts**

Append at the end of the file (after existing exports):

```ts
// ─── Payment Packages ───────────────────────────────────
export const paymentPackages = pgTable("payment_packages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  buyButtonId: text("buy_button_id").notNull(),
  publishableKey: text("publishable_key").notNull(),
  stripePriceId: text("stripe_price_id"),
  priceAmount: integer("price_amount"),          // HKD cents
  currency: varchar("currency", { length: 10 }).notNull().default("hkd"),
  singleCreditsGranted: integer("single_credits_granted").notNull().default(0),
  multiCreditsGranted: integer("multi_credits_granted").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Purchases ──────────────────────────────────────────
export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  packageId: integer("package_id").references(() => paymentPackages.id),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amount: integer("amount").notNull(),           // HKD cents
  currency: varchar("currency", { length: 10 }).notNull(),
  singleGranted: integer("single_granted").notNull(),
  multiGranted: integer("multi_granted").notNull(),
  status: varchar("status", { length: 20 }).notNull(),  // paid | refunded | failed
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Stripe Events (webhook idempotency) ────────────────
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),                   // Stripe event id: evt_xxx
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Write SQL migration**

```sql
-- drizzle/migrations/NNNN_payments_tables.sql

CREATE TABLE "payment_packages" (
  "id" serial PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "description" text,
  "buy_button_id" text NOT NULL,
  "publishable_key" text NOT NULL,
  "stripe_price_id" text,
  "price_amount" integer,
  "currency" varchar(10) NOT NULL DEFAULT 'hkd',
  "single_credits_granted" integer NOT NULL DEFAULT 0,
  "multi_credits_granted" integer NOT NULL DEFAULT 0,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "purchases" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "package_id" integer REFERENCES "payment_packages"("id"),
  "stripe_session_id" text NOT NULL UNIQUE,
  "stripe_payment_intent_id" text,
  "amount" integer NOT NULL,
  "currency" varchar(10) NOT NULL,
  "single_granted" integer NOT NULL,
  "multi_granted" integer NOT NULL,
  "status" varchar(20) NOT NULL,
  "refunded_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "purchases_user_id_idx" ON "purchases" ("user_id");
CREATE INDEX "purchases_created_at_idx" ON "purchases" ("created_at");
CREATE INDEX "purchases_stripe_payment_intent_idx" ON "purchases" ("stripe_payment_intent_id");

CREATE TABLE "stripe_events" (
  "id" text PRIMARY KEY,
  "type" text NOT NULL,
  "processed_at" timestamp with time zone NOT NULL DEFAULT now()
);
```

- [ ] **Step 3: Apply migration**

```bash
npx drizzle-kit push
```

Verify three tables exist in Neon console.

- [ ] **Step 4: Commit**

```bash
git add app/lib/db/schema.ts drizzle/migrations/
git commit -m "feat(db): add payment_packages, purchases, stripe_events tables"
```

---

## Task 11: Stripe webhook endpoint

**Files:**
- Create: `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/webhooks/stripe/route.ts
import { NextRequest } from "next/server";
import { stripe, requireStripe } from "@/app/lib/stripe";
import { db } from "@/app/lib/db";
import { stripeEvents, purchases, paymentPackages, users } from "@/app/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  sendPurchaseAdminNotification,
  sendRefundAdminNotification,
} from "@/app/lib/email";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !stripe) {
    console.error("[stripe-webhook] not configured");
    return new Response("not configured", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing signature", { status: 400 });

  const body = await req.text();  // MUST read raw, not json()
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    console.error("[stripe-webhook] signature verification failed:", e);
    return new Response("invalid signature", { status: 400 });
  }

  // Idempotency: insert event row, bail out if duplicate.
  try {
    await db.insert(stripeEvents).values({ id: event.id, type: event.type });
  } catch (e) {
    // Primary key conflict = already processed.
    console.log("[stripe-webhook] duplicate event", event.id);
    return new Response("ok (duplicate)", { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        // Accepted but ignored
        break;
    }
  } catch (e) {
    console.error("[stripe-webhook] handler error", event.type, e);
    // Still return 200: the event is recorded as processed; retrying would cause
    // duplicate side effects. Admin alert should come from the exception logger.
  }

  return new Response("ok", { status: 200 });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userIdStr = session.client_reference_id;
  if (!userIdStr) {
    console.error("[stripe-webhook] missing client_reference_id", session.id);
    return;
  }
  const userId = parseInt(userIdStr, 10);
  if (!Number.isFinite(userId)) {
    console.error("[stripe-webhook] invalid client_reference_id", userIdStr);
    return;
  }

  // Fetch line items to identify which package this was
  const s = requireStripe();
  const lineItems = await s.checkout.sessions.listLineItems(session.id, { limit: 10 });
  const priceId = lineItems.data[0]?.price?.id;
  if (!priceId) {
    console.error("[stripe-webhook] no price id in line items", session.id);
    return;
  }

  const [pkg] = await db
    .select()
    .from(paymentPackages)
    .where(eq(paymentPackages.stripePriceId, priceId))
    .limit(1);

  if (!pkg) {
    console.error("[stripe-webhook] unknown price id", priceId);
    return;
  }

  // Second idempotency: unique index on stripeSessionId.
  const inserted = await db
    .insert(purchases)
    .values({
      userId,
      packageId: pkg.id,
      stripeSessionId: session.id,
      stripePaymentIntentId: (session.payment_intent as string) ?? null,
      amount: session.amount_total ?? pkg.priceAmount ?? 0,
      currency: session.currency ?? pkg.currency,
      singleGranted: pkg.singleCreditsGranted,
      multiGranted: pkg.multiCreditsGranted,
      status: "paid",
    })
    .onConflictDoNothing({ target: purchases.stripeSessionId })
    .returning();

  if (inserted.length === 0) {
    // Race / duplicate — another worker already inserted this purchase
    return;
  }

  await db
    .update(users)
    .set({
      singleCredits: sql`${users.singleCredits} + ${pkg.singleCreditsGranted}`,
      multiCredits: sql`${users.multiCredits} + ${pkg.multiCreditsGranted}`,
    })
    .where(eq(users.id, userId));

  // Load user + current remaining for the email
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (user) {
    await sendPurchaseAdminNotification({
      user,
      pkg,
      amount: inserted[0].amount,
      currency: inserted[0].currency,
      stripeSessionId: session.id,
    });
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntent = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id;
  if (!paymentIntent) return;

  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.stripePaymentIntentId, paymentIntent))
    .limit(1);

  if (!purchase) {
    console.warn("[stripe-webhook] refund for unknown purchase", paymentIntent);
    return;
  }
  if (purchase.status !== "paid") {
    return;
  }

  await db
    .update(purchases)
    .set({ status: "refunded", refundedAt: new Date() })
    .where(eq(purchases.id, purchase.id));

  // Refund-safe deduction: never dip below already-used counts
  await db
    .update(users)
    .set({
      singleCredits: sql`GREATEST(${users.singleCredits} - ${purchase.singleGranted}, ${users.singleUsed})`,
      multiCredits: sql`GREATEST(${users.multiCredits} - ${purchase.multiGranted}, ${users.multiUsed})`,
    })
    .where(eq(users.id, purchase.userId));

  const [user] = await db.select().from(users).where(eq(users.id, purchase.userId)).limit(1);
  const [pkg] = purchase.packageId
    ? await db.select().from(paymentPackages).where(eq(paymentPackages.id, purchase.packageId)).limit(1)
    : [null];

  if (user) {
    await sendRefundAdminNotification({
      user,
      pkg,
      purchase,
    });
  }
}
```

- [ ] **Step 2: Configure Stripe webhook in dev**

```bash
# Install Stripe CLI first if missing: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The CLI prints a `whsec_...` secret; put it in `.env.local` as `STRIPE_WEBHOOK_SECRET`. Also add `STRIPE_SECRET_KEY` (from dashboard test mode) and `STRIPE_PUBLISHABLE_KEY`.

- [ ] **Step 3: Trigger a test event**

```bash
stripe trigger checkout.session.completed
```

You'll see the webhook fire. First run will fail with "missing client_reference_id" — expected, since the triggered fixture doesn't include one. That's fine; it confirms signature verification and idempotency work.

Now trigger twice in a row:
```bash
stripe trigger checkout.session.completed
stripe trigger checkout.session.completed
```

The second identical event should hit the idempotency branch and return "ok (duplicate)" — verify in server logs.

- [ ] **Step 4: Commit**

```bash
git add app/api/webhooks/stripe/route.ts
git commit -m "feat(stripe): webhook handler with idempotency, refund-safe credit math"
```

---

## Task 12: Admin email notifications for purchase + refund

**Files:**
- Modify: `app/lib/email.ts`

- [ ] **Step 1: Add two new exported functions**

Append to `app/lib/email.ts`:

```ts
type PurchaseNotificationArgs = {
  user: { id: number; email: string; singleCredits: number; multiCredits: number; singleUsed: number; multiUsed: number };
  pkg: { name: string; singleCreditsGranted: number; multiCreditsGranted: number };
  amount: number;
  currency: string;
  stripeSessionId: string;
};

export async function sendPurchaseAdminNotification(args: PurchaseNotificationArgs): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || "geektu@gmail.com";
  const { user, pkg, amount, currency, stripeSessionId } = args;
  const amountStr = `${currency.toUpperCase()} ${(amount / 100).toFixed(2)}`;
  const remainingSingle = user.singleCredits - user.singleUsed;
  const remainingMulti = user.multiCredits - user.multiUsed;
  const stripeUrl = `https://dashboard.stripe.com/payments/${stripeSessionId}`;

  const subject = `[收入通知] ${user.email} 購買了「${pkg.name}」- ${amountStr}`;
  const html = `
    <div style="font-family: serif; max-width: 520px; margin: 0 auto; padding: 32px; color: #1e1a14;">
      <h2 style="color: #7a5c10; text-align: center;">天機 Fortune-For.me — 收入通知</h2>
      <ul>
        <li><strong>使用者：</strong>${user.email}</li>
        <li><strong>方案：</strong>${pkg.name}</li>
        <li><strong>金額：</strong>${amountStr}</li>
        <li><strong>新增額度：</strong>個別 +${pkg.singleCreditsGranted} / 三師 +${pkg.multiCreditsGranted}</li>
        <li><strong>目前剩餘：</strong>個別 ${remainingSingle} / 三師 ${remainingMulti}</li>
        <li><strong>Stripe：</strong><a href="${stripeUrl}">${stripeSessionId}</a></li>
      </ul>
    </div>
  `;

  if (!resend) {
    console.log("[email] Resend not configured. Purchase notification for:", user.email);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to: adminEmail, subject, html });
  } catch (e) {
    console.error("[email] Failed to send purchase notification:", e);
  }
}

type RefundNotificationArgs = {
  user: { id: number; email: string; singleCredits: number; multiCredits: number; singleUsed: number; multiUsed: number };
  pkg: { name: string } | null;
  purchase: {
    amount: number;
    currency: string;
    singleGranted: number;
    multiGranted: number;
    stripePaymentIntentId: string | null;
    createdAt: Date;
  };
};

export async function sendRefundAdminNotification(args: RefundNotificationArgs): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || "geektu@gmail.com";
  const { user, pkg, purchase } = args;
  const amountStr = `${purchase.currency.toUpperCase()} ${(purchase.amount / 100).toFixed(2)}`;
  const remainingSingle = user.singleCredits - user.singleUsed;
  const remainingMulti = user.multiCredits - user.multiUsed;
  const stripeUrl = purchase.stripePaymentIntentId
    ? `https://dashboard.stripe.com/payments/${purchase.stripePaymentIntentId}`
    : "";

  const subject = `[退款警示] ${user.email} 的「${pkg?.name ?? "已下架方案"}」已退款 - ${amountStr}`;
  const html = `
    <div style="font-family: serif; max-width: 520px; margin: 0 auto; padding: 32px; color: #1e1a14;">
      <h2 style="color: #c84700; text-align: center;">天機 Fortune-For.me — 退款警示</h2>
      <ul>
        <li><strong>使用者：</strong>${user.email}</li>
        <li><strong>方案：</strong>${pkg?.name ?? "（已刪除）"}</li>
        <li><strong>原購買時間：</strong>${purchase.createdAt.toISOString()}</li>
        <li><strong>金額：</strong>${amountStr}</li>
        <li><strong>扣除額度：</strong>個別 -${purchase.singleGranted} / 三師 -${purchase.multiGranted}（保留已使用次數）</li>
        <li><strong>使用者剩餘：</strong>個別 ${remainingSingle} / 三師 ${remainingMulti}</li>
        ${stripeUrl ? `<li><strong>Stripe：</strong><a href="${stripeUrl}">查看</a></li>` : ""}
      </ul>
    </div>
  `;

  if (!resend) {
    console.log("[email] Resend not configured. Refund notification for:", user.email);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to: adminEmail, subject, html });
  } catch (e) {
    console.error("[email] Failed to send refund notification:", e);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/email.ts
git commit -m "feat(email): admin notifications for purchase + refund"
```

---

## Task 13: Public GET /api/packages endpoint

**Files:**
- Create: `app/api/packages/route.ts`

- [ ] **Step 1: Write the route**

```ts
// app/api/packages/route.ts
import { auth } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import { paymentPackages } from "@/app/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: paymentPackages.id,
      name: paymentPackages.name,
      description: paymentPackages.description,
      buyButtonId: paymentPackages.buyButtonId,
      publishableKey: paymentPackages.publishableKey,
      priceAmount: paymentPackages.priceAmount,
      currency: paymentPackages.currency,
      singleCreditsGranted: paymentPackages.singleCreditsGranted,
      multiCreditsGranted: paymentPackages.multiCreditsGranted,
    })
    .from(paymentPackages)
    .where(eq(paymentPackages.isActive, true))
    .orderBy(asc(paymentPackages.sortOrder));

  return Response.json({ packages: rows });
}
```

Note: `stripePriceId` is deliberately excluded from the SELECT.

- [ ] **Step 2: Commit**

```bash
git add app/api/packages/route.ts
git commit -m "feat(api): public GET /api/packages (active only, minimal fields)"
```

---

## Task 14: PurchaseModal + ThanksForTryingModal + QuotaExhaustedGate

**Files:**
- Create: `app/components/PurchaseModal.tsx` (build via frontend-design skill)
- Create: `app/components/ThanksForTryingModal.tsx`
- Create: `app/components/QuotaExhaustedGate.tsx`

- [ ] **Step 1: Invoke the frontend-design skill for PurchaseModal**

**This step is NOT "write component code". It is "dispatch the frontend-design skill with the following brief":**

Brief to hand the skill:
> Build `app/components/PurchaseModal.tsx` — a premium, site-matching modal that opens when a regular user runs out of divination credits. Site aesthetic: serif headlines, gold accent `#7a5c10`, background tones `#faf7f1`, text `#1e1a14`, muted `#847b72`. The modal must NOT feel like a cheap paywall; it should match the app's contemplative divination tone. The component is a client component that:
> 1. Accepts prop `{ userId: number; onClose: () => void }`
> 2. On mount, fetches `GET /api/packages` and renders one card per package
> 3. Each card shows: name, description, price (format `HK$ {priceAmount/100}`), grants breakdown (「含 X 次個別問答 / Y 次三師論道」), and a `<stripe-buy-button buy-button-id={pkg.buyButtonId} publishable-key={pkg.publishableKey} client-reference-id={userId}>` element
> 4. Loads the Stripe buy-button script once via Next.js `<Script src="https://js.stripe.com/v3/buy-button.js" strategy="afterInteractive" />`
> 5. Header text: 「付款成功後系統會自動加值，您可以直接回到本頁繼續使用」
> 6. Close button (X) in the corner
> 7. Loading state while packages fetch; empty state if no active packages
>
> Consult `node_modules/next/dist/docs/` for Next.js App Router client component + `<Script>` usage patterns (project uses a Next.js fork).

After frontend-design produces the file, review it for: (a) correctness of the buy-button HTML element attribute names, (b) correct `client-reference-id` binding to the prop, (c) `next/script` strategy.

- [ ] **Step 2: Create ThanksForTryingModal (no frontend-design needed — copy-forward simple)**

```tsx
// app/components/ThanksForTryingModal.tsx
"use client";
export default function ThanksForTryingModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-[#faf7f1] p-10 shadow-2xl text-center">
        <div className="mb-5 text-5xl">🌱</div>
        <h2 className="mb-4 font-serif text-2xl text-[#7a5c10]">感謝您的體驗</h2>
        <p className="mb-8 leading-relaxed text-[#1e1a14]">
          人生的路還很長，未來還有無限可能性，不要執著於先天命運。
        </p>
        <button
          onClick={onClose}
          className="rounded bg-[#7a5c10] px-8 py-3 text-white hover:bg-[#5a4408] transition-colors"
        >
          我明白了
        </button>
      </div>
    </div>
  );
}
```

No purchase link, no "upgrade" language — this is the point.

- [ ] **Step 3: Create QuotaExhaustedGate — the dispatcher**

```tsx
// app/components/QuotaExhaustedGate.tsx
"use client";
import { useState, useCallback, createContext, useContext, ReactNode } from "react";
import PurchaseModal from "./PurchaseModal";
import ThanksForTryingModal from "./ThanksForTryingModal";

type Ctx = {
  trigger: (canPurchase: boolean) => void;
};
const QuotaExhaustedContext = createContext<Ctx | null>(null);

export function useQuotaExhausted() {
  const ctx = useContext(QuotaExhaustedContext);
  if (!ctx) throw new Error("useQuotaExhausted must be used within QuotaExhaustedProvider");
  return ctx;
}

export function QuotaExhaustedProvider({
  userId,
  children,
}: {
  userId: number;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<"none" | "purchase" | "thanks">("none");

  const trigger = useCallback((canPurchase: boolean) => {
    setMode(canPurchase ? "purchase" : "thanks");
  }, []);

  const close = useCallback(() => setMode("none"), []);

  return (
    <QuotaExhaustedContext.Provider value={{ trigger }}>
      {children}
      {mode === "purchase" && <PurchaseModal userId={userId} onClose={close} />}
      {mode === "thanks" && <ThanksForTryingModal onClose={close} />}
    </QuotaExhaustedContext.Provider>
  );
}
```

- [ ] **Step 4: Wire the provider into protected layout + a fetch helper**

Modify `app/(protected)/layout.tsx` to wrap children:

```tsx
// After the age-gate block, change the final return:
return (
  <QuotaExhaustedProvider userId={userData!.id}>
    {children}
  </QuotaExhaustedProvider>
);
```

Create a tiny fetch wrapper `app/lib/divine-fetch.ts`:

```ts
// app/lib/divine-fetch.ts
export async function callDivine(
  path: "/api/divine" | "/api/divine-multi",
  body: unknown,
  onQuotaExhausted: (canPurchase: boolean) => void
): Promise<Response> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 402) {
    const data = await res.clone().json().catch(() => ({}));
    onQuotaExhausted(Boolean(data.canPurchase));
  }
  return res;
}
```

- [ ] **Step 5: Update call sites in the page that hits `/api/divine*`**

Grep for existing `fetch("/api/divine` calls in `app/(protected)/page.tsx` and any other client components. Replace with:

```ts
import { useQuotaExhausted } from "@/app/components/QuotaExhaustedGate";
import { callDivine } from "@/app/lib/divine-fetch";

const { trigger } = useQuotaExhausted();
// ...
const res = await callDivine("/api/divine", body, trigger);
if (res.status === 402) return;  // modal already opened by trigger
// continue with success handling
```

- [ ] **Step 6: Manual test — full purchase flow in test mode**

1. Create a Stripe **test mode** product + price in dashboard, generate a Buy Button, grab the `buy_btn_...` id + test `pk_test_...` key.
2. Manually `INSERT` a `payment_packages` row with those values and a test price id (leave `stripe_price_id` set, since Phase 3's verify button isn't built yet — get the price id directly from Stripe dashboard).
3. As a regular user, use up your single quota.
4. 402 → purchase modal opens, shows the package.
5. Click the buy button → Stripe test checkout → use `4242 4242 4242 4242` → complete.
6. Stripe CLI (`stripe listen`) forwards the webhook → credits granted → admin email received.
7. Return to site, trigger another divination → succeeds.

- [ ] **Step 7: Commit (may span multiple commits across frontend-design output)**

```bash
git add app/components/PurchaseModal.tsx \
        app/components/ThanksForTryingModal.tsx \
        app/components/QuotaExhaustedGate.tsx \
        app/lib/divine-fetch.ts \
        app/\(protected\)/layout.tsx \
        app/\(protected\)/page.tsx
git commit -m "feat(ui): purchase + thanks modals, 402 interception flow"
```

---

## Task 15: Phase 2 end-to-end validation

- [ ] **Step 1: Full happy-path test**

1. Regular user: exhaust single quota → purchase modal → buy test-mode → webhook grants credits → continue using.
2. Refund the test payment in Stripe dashboard → webhook fires → DB `purchases.status = 'refunded'` → user's `singleCredits` drops (but not below `singleUsed`).
3. Admin email received for both purchase and refund.

- [ ] **Step 2: Minor user test**

1. Minor user: exhaust quota → **ThanksForTryingModal** opens (not PurchaseModal).
2. No purchase path exposed.

- [ ] **Step 3: Idempotency test**

Replay the same webhook event twice with `stripe trigger` or manually via dashboard → credits only granted once.

- [ ] **Step 4: Closing tag commit**

```bash
git commit --allow-empty -m "chore: phase 2 of paid-quota system complete (stripe purchase flow)"
```

**Phase 2 ships at this commit.** Users can now buy credits end-to-end.

---

# PHASE 3 — Admin Payment Tab + User History

## Task 16: Admin Package CRUD APIs

**Files:**
- Create: `app/api/admin/packages/route.ts`
- Create: `app/api/admin/packages/[id]/route.ts`
- Create: `app/api/admin/packages/verify/route.ts`

- [ ] **Step 1: Shared admin guard helper (reuse existing pattern)**

Check how other admin routes guard access. In `app/admin/layout.tsx` the guard is `email === ADMIN_EMAIL`. For API routes, repeat the same check. If no shared helper exists, create `app/lib/admin-guard.ts`:

```ts
// app/lib/admin-guard.ts
import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";

export async function requireAdmin(): Promise<{ ok: true } | { ok: false; response: Response }> {
  const session = await auth();
  if (session?.user?.email !== ADMIN_EMAIL) {
    return { ok: false, response: Response.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true };
}
```

- [ ] **Step 2: GET (list) + POST (create)**

```ts
// app/api/admin/packages/route.ts
import { requireAdmin } from "@/app/lib/admin-guard";
import { db } from "@/app/lib/db";
import { paymentPackages } from "@/app/lib/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const rows = await db.select().from(paymentPackages).orderBy(asc(paymentPackages.sortOrder));
  return Response.json({ packages: rows });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const body = await req.json();

  const required = ["name", "buyButtonId", "publishableKey", "stripePriceId", "priceAmount", "currency"];
  for (const k of required) if (body[k] == null) return Response.json({ error: `missing ${k}` }, { status: 400 });

  const [inserted] = await db.insert(paymentPackages).values({
    name: body.name,
    description: body.description ?? null,
    buyButtonId: body.buyButtonId,
    publishableKey: body.publishableKey,
    stripePriceId: body.stripePriceId,
    priceAmount: body.priceAmount,
    currency: body.currency,
    singleCreditsGranted: body.singleCreditsGranted ?? 0,
    multiCreditsGranted: body.multiCreditsGranted ?? 0,
    sortOrder: body.sortOrder ?? 0,
    isActive: body.isActive ?? true,
  }).returning();

  return Response.json({ package: inserted });
}
```

- [ ] **Step 3: PATCH + DELETE**

```ts
// app/api/admin/packages/[id]/route.ts
import { requireAdmin } from "@/app/lib/admin-guard";
import { db } from "@/app/lib/db";
import { paymentPackages, purchases } from "@/app/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const body = await req.json();

  const allowed = ["name", "description", "buyButtonId", "publishableKey",
                   "stripePriceId", "priceAmount", "currency",
                   "singleCreditsGranted", "multiCreditsGranted",
                   "sortOrder", "isActive"] as const;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const k of allowed) if (k in body) updates[k] = body[k];

  const [updated] = await db.update(paymentPackages)
    .set(updates)
    .where(eq(paymentPackages.id, parseInt(id)))
    .returning();

  return Response.json({ package: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const pkgId = parseInt(id);

  const [ref] = await db.select({ id: purchases.id }).from(purchases)
    .where(eq(purchases.packageId, pkgId)).limit(1);
  if (ref) {
    return Response.json(
      { error: "package_in_use", message: "此方案有歷史交易，只能停用不能刪除" },
      { status: 409 }
    );
  }

  await db.delete(paymentPackages).where(eq(paymentPackages.id, pkgId));
  return Response.json({ ok: true });
}
```

Note: project uses Next.js App Router with dynamic route params as a Promise (per the project's Next.js fork — consult `node_modules/next/dist/docs/app-router/route-handlers.md` if this signature is wrong).

- [ ] **Step 4: Verify endpoint**

```ts
// app/api/admin/packages/verify/route.ts
import { requireAdmin } from "@/app/lib/admin-guard";
import { requireStripe } from "@/app/lib/stripe";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { buyButtonId, publishableKey } = await req.json();
  if (!buyButtonId) return Response.json({ error: "missing buyButtonId" }, { status: 400 });

  const stripe = requireStripe();

  // Buy Buttons in Stripe are backed by Payment Links. Fetch all payment links
  // and find the one whose restrictions.completed_sessions or similar metadata
  // match. In practice, the simpler approach is: the Buy Button's underlying
  // price can be looked up via the Payment Links API.
  //
  // Current Stripe API: stripe.paymentLinks.list({ limit: 100 }) — iterate and
  // find the one whose ID matches the suffix, OR use stripe.prices.list with
  // metadata. Simpler path: caller also pastes the price ID from dashboard.
  //
  // FALLBACK: if the API doesn't expose a direct buyButton→price mapping,
  // have the admin also paste the price_id directly. Stripe's recent API does
  // expose price data via payment links — consult
  // https://docs.stripe.com/api/payment_links when implementing.

  const links = await stripe.paymentLinks.list({ limit: 100, active: true });

  for (const link of links.data) {
    // Some accounts embed the buy_button_id in metadata; others don't.
    // Fetch line items for each candidate and return the first price found.
    // In practice we need to match on the embedded buy_button. Check the link's
    // ID structure against buyButtonId: buy_btn_X corresponds to plink_X in
    // some cases. Fall back to returning all candidates if mapping is unclear.
    const items = await stripe.paymentLinks.listLineItems(link.id, { limit: 1 });
    const price = items.data[0]?.price;
    if (!price) continue;
    // Simple heuristic: admin confirms in the UI which link is theirs.
    // For now, return the first active link's data and let admin verify.
    return Response.json({
      stripePriceId: price.id,
      priceAmount: price.unit_amount ?? 0,
      currency: price.currency,
      productName: typeof price.product === "string" ? price.product : price.product?.id,
      paymentLinkId: link.id,
    });
  }

  return Response.json({ error: "no_matching_payment_link" }, { status: 404 });
}
```

**Honest caveat**: The Stripe API's mapping from `buy_btn_` to `price` is not fully documented for all account shapes. During implementation, spike this lookup against the actual Stripe test account. If the automatic lookup is unreliable, fall back to an admin UI that lets the admin **paste the `price_id` directly** from the Stripe dashboard (the verify button then just calls `stripe.prices.retrieve(priceId)` and returns `{priceAmount, currency}`). Either way the plan's contract is: verify endpoint returns `{stripePriceId, priceAmount, currency}` that the UI treats as read-only.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/packages/ app/lib/admin-guard.ts
git commit -m "feat(api): admin package CRUD + Stripe verify endpoint"
```

---

## Task 17: Admin Revenue Dashboard APIs

**Files:**
- Create: `app/api/admin/payments/connection/route.ts`
- Create: `app/api/admin/payments/stats/route.ts`
- Create: `app/api/admin/payments/transactions/route.ts`
- Create: `app/api/admin/payments/stripe-reconcile/route.ts`

- [ ] **Step 1: Connection status (env var presence only)**

```ts
// app/api/admin/payments/connection/route.ts
import { requireAdmin } from "@/app/lib/admin-guard";
import { stripeConfigStatus } from "@/app/lib/stripe";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  return Response.json(stripeConfigStatus());
}
```

- [ ] **Step 2: Stats — cards + chart buckets**

```ts
// app/api/admin/payments/stats/route.ts
import { requireAdmin } from "@/app/lib/admin-guard";
import { db } from "@/app/lib/db";
import { purchases, paymentPackages } from "@/app/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

type Range = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y";
const RANGE_MS: Record<Range, number> = {
  "1D": 86400_000,
  "1W": 7 * 86400_000,
  "1M": 30 * 86400_000,
  "3M": 90 * 86400_000,
  "6M": 180 * 86400_000,
  "1Y": 365 * 86400_000,
};
const BUCKET: Record<Range, "hour" | "day" | "week" | "month"> = {
  "1D": "hour",
  "1W": "day",
  "1M": "day",
  "3M": "week",
  "6M": "week",
  "1Y": "month",
};

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const range = (url.searchParams.get("range") as Range) || "1M";
  if (!(range in RANGE_MS)) return Response.json({ error: "invalid_range" }, { status: 400 });

  const since = new Date(Date.now() - RANGE_MS[range]);
  const whereClause = and(eq(purchases.status, "paid"), gte(purchases.createdAt, since));

  // Four cards
  const [aggRow] = await db
    .select({
      totalAmount: sql<number>`coalesce(sum(${purchases.amount}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(purchases)
    .where(whereClause);

  const totalAmount = Number(aggRow.totalAmount);
  const count = Number(aggRow.count);
  const avg = count > 0 ? Math.round(totalAmount / count) : 0;

  // New paying users: users whose earliest paid purchase is within the range
  const [newUsersRow] = await db
    .select({ count: sql<number>`count(distinct ${purchases.userId})::int` })
    .from(purchases)
    .where(
      and(
        eq(purchases.status, "paid"),
        sql`${purchases.userId} NOT IN (
          SELECT user_id FROM purchases
          WHERE status = 'paid' AND created_at < ${since.toISOString()}
        )`,
        gte(purchases.createdAt, since)
      )
    );

  // Line chart buckets — use date_trunc at the appropriate granularity
  const bucket = BUCKET[range];
  const lineChart = await db.execute(sql`
    SELECT date_trunc(${bucket}, created_at) AS bucket,
           sum(amount)::int AS total
    FROM purchases
    WHERE status = 'paid' AND created_at >= ${since.toISOString()}
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  // Bar chart: per-package share
  const barChart = await db.execute(sql`
    SELECT p.package_id, pkg.name,
           sum(p.amount)::int AS total,
           count(*)::int AS count
    FROM purchases p
    LEFT JOIN payment_packages pkg ON pkg.id = p.package_id
    WHERE p.status = 'paid' AND p.created_at >= ${since.toISOString()}
    GROUP BY p.package_id, pkg.name
    ORDER BY total DESC
  `);

  return Response.json({
    range,
    cards: {
      totalAmount,
      count,
      avgOrderValue: avg,
      newPayingUsers: Number(newUsersRow.count),
    },
    lineChart: (lineChart as any).rows ?? lineChart,
    barChart: (barChart as any).rows ?? barChart,
  });
}
```

Note: the shape of `db.execute` results varies by Drizzle version. Inspect one live response and adjust `.rows` accessor to match.

- [ ] **Step 3: Transactions — paginated, sortable, searchable**

```ts
// app/api/admin/payments/transactions/route.ts
import { requireAdmin } from "@/app/lib/admin-guard";
import { db } from "@/app/lib/db";
import { purchases, paymentPackages, users } from "@/app/lib/db/schema";
import { and, or, ilike, desc, asc, sql, eq } from "drizzle-orm";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const sort = url.searchParams.get("sort") ?? "time";   // time | amount | user
  const dir = url.searchParams.get("dir") ?? "desc";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const pageSize = 25;

  const sortCol =
    sort === "amount" ? purchases.amount :
    sort === "user"   ? users.email :
                        purchases.createdAt;
  const orderBy = dir === "asc" ? asc(sortCol) : desc(sortCol);

  const qFilter = q
    ? or(
        ilike(users.email, `%${q}%`),
        ilike(paymentPackages.name, `%${q}%`),
        ilike(purchases.stripeSessionId, `%${q}%`),
      )
    : undefined;

  const rows = await db
    .select({
      id: purchases.id,
      createdAt: purchases.createdAt,
      userEmail: users.email,
      userId: users.id,
      packageName: paymentPackages.name,
      amount: purchases.amount,
      currency: purchases.currency,
      status: purchases.status,
      stripeSessionId: purchases.stripeSessionId,
      stripePaymentIntentId: purchases.stripePaymentIntentId,
    })
    .from(purchases)
    .leftJoin(users, eq(purchases.userId, users.id))
    .leftJoin(paymentPackages, eq(purchases.packageId, paymentPackages.id))
    .where(qFilter)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(purchases)
    .leftJoin(users, eq(purchases.userId, users.id))
    .leftJoin(paymentPackages, eq(purchases.packageId, paymentPackages.id))
    .where(qFilter);

  return Response.json({ rows, total: Number(total), page, pageSize });
}
```

- [ ] **Step 4: Reconciliation — live Stripe call**

```ts
// app/api/admin/payments/stripe-reconcile/route.ts
import { requireAdmin } from "@/app/lib/admin-guard";
import { requireStripe } from "@/app/lib/stripe";
import { db } from "@/app/lib/db";
import { purchases } from "@/app/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const days = Math.min(30, Math.max(1, parseInt(url.searchParams.get("days") ?? "7")));
  const sinceDate = new Date(Date.now() - days * 86400_000);
  const sinceUnix = Math.floor(sinceDate.getTime() / 1000);

  // Local side
  const [local] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(amount), 0)::int`,
    })
    .from(purchases)
    .where(and(eq(purchases.status, "paid"), gte(purchases.createdAt, sinceDate)));

  // Stripe side
  const stripe = requireStripe();
  const txns = await stripe.balanceTransactions.list({
    created: { gte: sinceUnix },
    type: "charge",
    limit: 100,
  });

  const stripeTotal = txns.data.reduce((sum, t) => sum + t.amount, 0);
  const stripeCount = txns.data.length;

  return Response.json({
    local: { count: Number(local.count), total: Number(local.total) },
    stripe: { count: stripeCount, total: stripeTotal },
    match: local.count === stripeCount && local.total === stripeTotal,
    days,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/payments/
git commit -m "feat(api): admin payments stats, transactions, reconciliation"
```

---

## Task 18: Admin PaymentsTab UI — packages management

**Files:**
- Create: `app/components/admin/PaymentsTab.tsx`
- Create: `app/components/admin/PackagesAdmin.tsx`

- [ ] **Step 1: PaymentsTab shell with sub-nav**

```tsx
// app/components/admin/PaymentsTab.tsx
"use client";
import { useState } from "react";
import PackagesAdmin from "./PackagesAdmin";
import RevenueDashboard from "./RevenueDashboard";

export default function PaymentsTab() {
  const [sub, setSub] = useState<"packages" | "revenue">("packages");
  return (
    <div>
      <div className="mb-4 flex gap-4 border-b border-[#c8bfa8]">
        <button
          onClick={() => setSub("packages")}
          className={`pb-2 ${sub === "packages" ? "border-b-2 border-[#7a5c10] text-[#7a5c10]" : "text-[#847b72]"}`}
        >
          方案管理
        </button>
        <button
          onClick={() => setSub("revenue")}
          className={`pb-2 ${sub === "revenue" ? "border-b-2 border-[#7a5c10] text-[#7a5c10]" : "text-[#847b72]"}`}
        >
          收入與交易
        </button>
      </div>
      {sub === "packages" ? <PackagesAdmin /> : <RevenueDashboard />}
    </div>
  );
}
```

- [ ] **Step 2: PackagesAdmin — table + create/edit modal**

Build `PackagesAdmin.tsx`. The component:
1. Fetches `GET /api/admin/packages` on mount
2. Displays a table: sortOrder / name / credits / price / status / Stripe match / actions
3. Has a 「＋ 新增方案」 button that opens a modal form
4. Form fields as per spec §7.3: name, description, buyButtonId, publishableKey, verify button, singleCreditsGranted, multiCreditsGranted, sortOrder, isActive
5. Verify button calls `POST /api/admin/packages/verify` with `{ buyButtonId, publishableKey }`, displays returned `stripePriceId / priceAmount / currency / productName` as read-only below the inputs
6. Submit → `POST /api/admin/packages` (create) or `PATCH /api/admin/packages/[id]` (edit)
7. Delete action hits `DELETE /api/admin/packages/[id]`, shows 409 error inline if deletion blocked
8. Toggle active calls PATCH with `{ isActive: !current }`

Full code is ~250 lines of fairly standard React — implement following the existing admin tab component conventions in `app/admin/page.tsx`. Key snippet for the verify flow:

```tsx
async function handleVerify() {
  setVerifying(true);
  setVerifyError(null);
  try {
    const res = await fetch("/api/admin/packages/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyButtonId: form.buyButtonId, publishableKey: form.publishableKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      setVerifyError(data.error ?? "驗證失敗");
      return;
    }
    if (data.currency !== "hkd") {
      setVerifyError(`⚠ 此方案幣別為 ${data.currency.toUpperCase()}，非港幣`);
    }
    setForm((f) => ({
      ...f,
      stripePriceId: data.stripePriceId,
      priceAmount: data.priceAmount,
      currency: data.currency,
    }));
  } finally {
    setVerifying(false);
  }
}

// Save button is disabled until form.stripePriceId is populated
```

- [ ] **Step 3: Wire into admin page.tsx**

In `app/admin/page.tsx`, add `'payments'` to the Tab type at line 59, and add a tab rendering case:

```tsx
{tab === "payments" && <PaymentsTab />}
```

Import at the top:
```tsx
import PaymentsTab from "@/app/components/admin/PaymentsTab";
```

Also add the tab button to wherever the tab switcher is rendered.

- [ ] **Step 4: Manual test**

1. Log in as admin, click 「付款管理」 tab.
2. Click 「＋ 新增方案」, fill in name + buy button id + publishable key (from Stripe test mode).
3. Click 驗證 → fields populate → save.
4. Row appears in table. Edit the single credits to 20 → save → change reflected.
5. Try to delete → if no purchases exist, succeeds; if purchases exist, shows 409 message.

- [ ] **Step 5: Commit**

```bash
git add app/components/admin/PaymentsTab.tsx app/components/admin/PackagesAdmin.tsx app/admin/page.tsx
git commit -m "feat(admin): payments tab with package management UI"
```

---

## Task 19: Admin Revenue Dashboard UI

**Files:**
- Create: `app/components/admin/RevenueDashboard.tsx`

- [ ] **Step 1: Build the component**

Structure:
1. On mount, parallel fetches: `/api/admin/payments/connection`, `/api/admin/payments/stats?range=1M`, `/api/admin/payments/transactions`, `/api/admin/payments/stripe-reconcile?days=7`
2. If connection status returns any missing key → render disabled state with env var instructions
3. Otherwise render four stat cards (total, count, avg, new users), a range selector (1D/1W/1M/3M/6M/1Y) that refetches stats, a line chart, a bar chart, reconciliation panel, and the transactions table

For charts, use the simplest charting lib that's already in the repo (check `package.json`). If none exists, install `recharts`:

```bash
npm install recharts
```

Line chart snippet:

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

<ResponsiveContainer width="100%" height={240}>
  <LineChart data={stats.lineChart}>
    <XAxis dataKey="bucket" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
    <YAxis tickFormatter={(v) => `HK$${(v/100).toLocaleString()}`} />
    <Tooltip formatter={(v: number) => `HK$ ${(v/100).toFixed(2)}`} />
    <Line type="monotone" dataKey="total" stroke="#7a5c10" strokeWidth={2} />
  </LineChart>
</ResponsiveContainer>
```

Transactions table: plain `<table>` with sortable headers (clicking toggles `sort` + `dir` query params), a debounced search input (300ms), pagination buttons. Row click on email navigates to the admin users tab for that user; row click on stripe session id opens Stripe dashboard in a new tab.

Reconciliation panel:

```tsx
{reconcile && (
  <div className={`rounded p-4 ${reconcile.match ? "bg-green-50" : "bg-red-50"}`}>
    最近 {reconcile.days} 天：
    我方 {reconcile.local.count} 筆 / HK$ {(reconcile.local.total / 100).toFixed(2)}
    {" ⚖ "}
    Stripe {reconcile.stripe.count} 筆 / HK$ {(reconcile.stripe.total / 100).toFixed(2)}
    {!reconcile.match && <div className="mt-2 text-red-700">⚠ 不一致，請檢查 webhook 紀錄</div>}
  </div>
)}
```

- [ ] **Step 2: Manual test**

1. Admin tab → 收入與交易 sub-nav.
2. Four cards show data (populate with at least 2-3 test purchases first).
3. Switch range tabs → chart redraws.
4. Transactions list shows all purchases; click column header → sort flips.
5. Type in search → debounced filter works.
6. Reconciliation panel matches (unless you manually deleted a purchases row).

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/RevenueDashboard.tsx package.json package-lock.json
git commit -m "feat(admin): revenue dashboard with charts, list, and reconciliation"
```

---

## Task 20: End-user purchase history section

**Files:**
- Create: `app/api/me/purchases/route.ts`
- Create: `app/components/account/PurchaseHistory.tsx`
- Modify: end-user account page (location TBD — grep first)

- [ ] **Step 1: GET /api/me/purchases**

```ts
// app/api/me/purchases/route.ts
import { auth } from "@/app/lib/auth";
import { db } from "@/app/lib/db";
import { purchases, paymentPackages, users } from "@/app/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { isExempt } from "@/app/lib/quota";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [user] = await db.select().from(users).where(eq(users.email, session.user.email)).limit(1);
  if (!user) return Response.json({ error: "not_found" }, { status: 404 });

  const rows = await db
    .select({
      id: purchases.id,
      createdAt: purchases.createdAt,
      packageName: paymentPackages.name,
      amount: purchases.amount,
      currency: purchases.currency,
      singleGranted: purchases.singleGranted,
      multiGranted: purchases.multiGranted,
      status: purchases.status,
    })
    .from(purchases)
    .leftJoin(paymentPackages, eq(purchases.packageId, paymentPackages.id))
    .where(eq(purchases.userId, user.id))
    .orderBy(desc(purchases.createdAt));

  return Response.json({
    purchases: rows,
    quota: {
      unlimited: isExempt(user),
      singleRemaining: user.singleCredits - user.singleUsed,
      multiRemaining: user.multiCredits - user.multiUsed,
    },
  });
}
```

- [ ] **Step 2: PurchaseHistory component**

```tsx
// app/components/account/PurchaseHistory.tsx
"use client";
import { useEffect, useState } from "react";

type PurchaseRow = {
  id: number; createdAt: string; packageName: string | null;
  amount: number; currency: string;
  singleGranted: number; multiGranted: number; status: string;
};
type Data = {
  purchases: PurchaseRow[];
  quota: { unlimited: boolean; singleRemaining: number; multiRemaining: number };
};

export default function PurchaseHistory() {
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => { fetch("/api/me/purchases").then(r => r.json()).then(setData); }, []);
  if (!data) return <div>載入中...</div>;

  return (
    <section className="mt-8">
      <h3 className="mb-4 text-lg font-semibold text-[#7a5c10]">購買紀錄</h3>

      <div className="mb-6 rounded bg-[#faf7f1] p-4">
        <div className="text-sm text-[#847b72]">目前剩餘額度</div>
        {data.quota.unlimited ? (
          <div className="text-lg text-[#7a5c10]">無限次（尊榮身份）</div>
        ) : (
          <div className="text-lg text-[#1e1a14]">
            個別問答 {data.quota.singleRemaining} 次 / 三師論道 {data.quota.multiRemaining} 次
          </div>
        )}
      </div>

      {data.purchases.length === 0 ? (
        <div className="text-sm text-[#847b72]">尚無購買紀錄</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#c8bfa8] text-left">
              <th className="py-2">日期</th>
              <th>方案</th>
              <th>金額</th>
              <th>額度</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
            {data.purchases.map(p => (
              <tr key={p.id} className="border-b border-[#e6e0cf]">
                <td className="py-2">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td>{p.packageName ?? "（已下架方案）"}</td>
                <td>{p.currency.toUpperCase()} {(p.amount / 100).toFixed(2)}</td>
                <td>個別 +{p.singleGranted} / 三師 +{p.multiGranted}</td>
                <td>
                  <span className={p.status === "paid" ? "text-green-700" : p.status === "refunded" ? "text-orange-700" : "text-red-700"}>
                    {p.status === "paid" ? "已付款" : p.status === "refunded" ? "已退款" : "失敗"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Mount on user account page**

```bash
grep -rn "個人資料\|account\|profile" app/\(protected\)/ --include="*.tsx" | head -20
```

Find the existing account/settings page (likely somewhere under `app/(protected)/`). Add `<PurchaseHistory />` to it. If no account page exists yet, create a minimal one at `app/(protected)/account/page.tsx` with just the purchase history.

- [ ] **Step 4: Commit**

```bash
git add app/api/me/purchases/ app/components/account/PurchaseHistory.tsx app/\(protected\)/
git commit -m "feat(account): end-user purchase history section"
```

---

## Task 21: Rollout — env vars + Stripe dashboard config

- [ ] **Step 1: Set production env vars in Vercel**

In the Vercel project dashboard → Settings → Environment Variables, add (Production):
- `STRIPE_SECRET_KEY` = `sk_live_...`
- `STRIPE_WEBHOOK_SECRET` = will be set AFTER adding the webhook endpoint below
- `STRIPE_PUBLISHABLE_KEY` = `pk_live_...` (the one from the user's first Buy Button)

- [ ] **Step 2: Register webhook in Stripe dashboard**

Stripe dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://<prod-domain>/api/webhooks/stripe`
- Events: `checkout.session.completed`, `charge.refunded`
- Copy the signing secret (`whsec_...`) and paste into Vercel as `STRIPE_WEBHOOK_SECRET`.
- Redeploy.

- [ ] **Step 3: Create the first real package**

In admin panel → 付款管理 → 方案管理 → ＋新增方案:
- Name: 「入門包」 (or user's preferred name)
- Buy Button ID: `buy_btn_1TL1nbJ94CGu4CE0hCFueB5N` (from user's spec)
- Publishable Key: `pk_live_51TITkYJ94CGu4CE0HnIstBBVcd6v51zLbzEQFQSmowHji0Ei89lZzXvjEcMv0FSnOutO0s3wb7YgW5kikvVCraxY00PRJfwbWI`
- Click 驗證 → confirm price id, amount, currency populate
- Set single credits granted + multi credits granted per the package's intent
- Save

- [ ] **Step 4: Smoke test on production (small real payment or refund cycle)**

Buy with a real card (small amount), verify credits granted + admin email received, then immediately refund via Stripe dashboard and verify refund email + credit deduction.

- [ ] **Step 5: Commit final**

```bash
git commit --allow-empty -m "chore: phase 3 of paid-quota system complete (admin + history)"
```

---

## Task 22: Post-launch cleanup & verification

- [ ] **Step 1: Run the full Phase 1–3 checklist from spec §13**

Verify every box in the spec's rollout checklist has been ticked.

- [ ] **Step 2: Monitor for 24 hours**

Watch server logs and admin inbox for:
- Unexpected 402s (users hitting quota they shouldn't)
- Webhook signature failures
- Email send failures
- Reconciliation mismatches

- [ ] **Step 3: Document any learnings**

If the Stripe verify endpoint's buy_button→price mapping didn't work as planned and you fell back to manual price_id entry, update the spec section §7.4 to reflect reality.

---

# Self-Review Notes (for planner's reference)

**Spec coverage check:**
- §1 Goals/Non-goals → covered by phase structure
- §2 Architecture → Phase 1 quota (Tasks 2-4), Phase 2 purchase (Tasks 9-15), Phase 3 admin (Tasks 16-19)
- §3 Schema → Task 1 (users), Task 10 (new tables)
- §4 Quota enforcement → Tasks 2-4
- §5 Age modal → Tasks 5-7
- §6 Purchase/Thanks modal + history → Task 14 (modals), Task 20 (history)
- §7 Admin packages → Tasks 16, 18
- §8 Admin dashboard → Tasks 17, 19
- §9 Webhook → Task 11
- §10 Admin emails → Task 12
- §11 Env vars → Task 21
- §12 Testing → distributed per task
- §13 Rollout → Task 21 + 22

**Potential weak spots to watch during execution:**
1. Task 16's verify endpoint — the buy_button → price mapping assumption needs a spike during implementation. Have a fallback plan (manual price_id paste).
2. Task 14's PurchaseModal depends on the frontend-design skill producing correct `<stripe-buy-button>` element usage. Review carefully.
3. Task 1's backfill SQL uses a hardcoded `ADMIN_EMAIL` literal — must be updated to the actual value before applying.
4. Drizzle's `db.execute` result shape varies; Task 17's stats endpoint may need adjustment.
5. Project uses a Next.js fork — dynamic route param signatures (`ctx.params` as Promise vs plain object) may differ from standard docs. Consult `node_modules/next/dist/docs/`.
