# Paid Quota + Stripe Payment System — Design Spec

**Date:** 2026-04-11
**Status:** Draft for review
**Scope:** Introduce per-user quotas for 個別問答 / 三師論道, Stripe-based credit purchases, admin Payment management page (packages + revenue dashboard), age verification gate for first login, and admin email notifications for purchases & refunds.

---

## 1. Goals & Non-Goals

### Goals
- Enforce per-user quotas on 個別問答 (single) and 三師論道 (multi) for regular users only.
- Allow regular users to top up credits via Stripe Buy Button embeds.
- Let admins CRUD payment packages from the admin panel.
- Provide an admin revenue dashboard with charts, transaction list, and Stripe reconciliation.
- Gate first login with an age verification modal; permanently disable purchases for minors.
- Notify admins by email on every successful purchase and refund.

### Non-Goals
- Subscription billing (one-time credit packs only).
- Multi-currency (HKD only).
- Self-service refunds (refunds are issued from Stripe dashboard).
- Storing Stripe secret keys in DB (env vars only).

---

## 2. Architecture Overview

Four subsystems, isolated for fault tolerance:

1. **Quota enforcement layer** — Synchronous check in `/api/divine` and `/api/divine-multi`. Does not depend on Stripe. Returns `402 Payment Required` with structured error when exhausted.
2. **Package management & purchase flow** — New `payment_packages` table + admin CRUD. Purchase modal renders `<stripe-buy-button>` dynamically per package, injecting `client-reference-id={userId}`.
3. **Stripe webhook attribution layer** — `/api/webhooks/stripe` handles `checkout.session.completed` (grant credits) and `charge.refunded` (deduct credits + mark purchase refunded). Idempotent via `stripe_events` table.
4. **Admin revenue dashboard** — Admin Payment tab reads local `purchases` table for charts/list, plus live Stripe `balance_transactions` call for reconciliation display.

**Fault isolation boundaries:**
- Stripe outage does not affect quota checks or existing credit usage.
- Webhook failures do not affect in-flight user requests.
- Admin dashboard failures do not affect front-end purchase flow.

---

## 3. Database Schema Changes

### 3.1 `users` table — new columns

| Column | Type | Default | Meaning |
|---|---|---|---|
| `birthDate` | `date` | NULL | User's date of birth (collected via age modal) |
| `ageVerifiedAt` | `timestamp` | NULL | NULL = age modal not yet completed (blocks protected layout) |
| `canPurchase` | `boolean` | `true` | Set to `false` permanently if age < 18 at verification time |

Existing fields `singleCredits`, `multiCredits`, `singleUsed`, `multiUsed` keep their current semantics:
- `remaining = credits − used` (never negative by construction)
- `credits` is cumulative granted; `used` is cumulative consumed.

### 3.2 New table `payment_packages`

```
id                      serial primary key
name                    text not null
description             text
buyButtonId             text not null          -- buy_btn_xxx (from Stripe embed)
publishableKey          text not null          -- pk_live_xxx (from Stripe embed)
stripePriceId           text                   -- populated by "verify" button
priceAmount             integer                -- HKD cents, populated by verify
currency                text not null default 'hkd'
singleCreditsGranted    integer not null default 0
multiCreditsGranted     integer not null default 0
sortOrder               integer not null default 0
isActive                boolean not null default true
createdAt               timestamp not null default now()
updatedAt               timestamp not null default now()
```

### 3.3 New table `purchases`

```
id                      serial primary key
userId                  integer not null references users(id)
packageId               integer references payment_packages(id)  -- nullable; survives package deletion
stripeSessionId         text not null unique                     -- idempotency key
stripePaymentIntentId   text
amount                  integer not null      -- HKD cents
currency                text not null
singleGranted           integer not null      -- snapshot at purchase time
multiGranted            integer not null      -- snapshot at purchase time
status                  text not null         -- 'paid' | 'refunded' | 'failed'
refundedAt              timestamp
createdAt               timestamp not null default now()
```

### 3.4 New table `stripe_events`

```
id              text primary key     -- Stripe event id (evt_xxx)
type            text not null
processedAt     timestamp not null default now()
```

First action of webhook handler is `INSERT ... ON CONFLICT DO NOTHING`. rowCount = 0 means event already processed → return 200 without side effects.

### 3.5 Backfill migration

Applied once as part of the schema migration:

```sql
UPDATE users
SET singleCredits = 10, multiCredits = 2
WHERE status = 'approved'
  AND "isAmbassador" = false
  AND "isFriend" = false
  AND email <> '<ADMIN_EMAIL>';  -- read from env at migration time
```

`singleUsed` / `multiUsed` untouched. Users who have already consumed more than the new cap will see `remaining = 0`; this is intentional per B selection in brainstorming. Admins, ambassadors, friends untouched and continue to bypass quota via role check.

---

## 4. Quota Enforcement

### 4.1 Helper module `app/lib/quota.ts` (new)

```ts
type QuotaType = 'single' | 'multi';

type QuotaCheck =
  | { ok: true; unlimited: true }
  | { ok: true; unlimited: false; remaining: number }
  | { ok: false; reason: 'exhausted'; canPurchase: boolean };

function isExempt(user: User): boolean {
  return user.email === process.env.ADMIN_EMAIL
      || user.isAmbassador
      || user.isFriend;
}

async function checkQuota(user: User, type: QuotaType): Promise<QuotaCheck>;
async function consumeQuota(user: User, type: QuotaType): Promise<void>;
```

### 4.2 Integration into existing routes

`app/api/divine/route.ts` (single Q&A):
1. After auth resolves the user, call `checkQuota(user, 'single')`.
2. If `!ok` → return `402` with body `{ error: 'quota_exhausted', canPurchase }`.
3. After successful response generation, call `consumeQuota(user, 'single')`. This replaces the existing manual `singleUsed` increment.

`app/api/divine-multi/route.ts` — same pattern with `'multi'`.

### 4.3 Concurrency safety

`consumeQuota` uses a single conditional UPDATE:

```sql
UPDATE users
SET "singleUsed" = "singleUsed" + 1
WHERE id = $1
  AND ( /* exempt */ email = $2 OR "isAmbassador" = true OR "isFriend" = true
        OR "singleUsed" < "singleCredits")
RETURNING "singleUsed";
```

rowCount = 0 → another concurrent request consumed the last credit → return 402. Prevents TOCTOU race between `checkQuota` and `consumeQuota`.

Exempt users also have their `used` counters incremented for usage analytics, but the guard never blocks them.

---

## 5. Age Verification Modal (first login)

### 5.1 Trigger

`app/(protected)/layout.tsx` already checks `status === 'approved'`. Add: if `user.ageVerifiedAt === null`, render `<AgeVerificationModal />` as a blocking overlay. The modal cannot be closed by X / overlay click / ESC. Applies to all existing approved users on their next login (one-time disruption, compliance requirement).

### 5.2 UI — `app/components/AgeVerificationModal.tsx`

- Title: 「請先完成年齡驗證」
- `<input type="date" max={today}>`
- Live-computed age display: 「您現在 X 歲」
- Confirm button disabled until date chosen.

### 5.3 Backend `POST /api/me/verify-age`

1. Validate `birthDate` (1900 < year ≤ today).
2. `age = floor((today - birthDate) / 365.25)`.
3. Update user: `birthDate`, `ageVerifiedAt = now()`, `canPurchase = (age >= 18)`.
4. Return `{ canPurchase }`.

### 5.4 Minor UX branch

After submit, if `canPurchase === false`, client shows secondary modal:
> 「感謝您來體驗。您目前可以完整使用 10 次個別問答與 2 次三師論道。人生的路還很長，未來有無限可能，不必執著於先天命運 🌱」

Button: 「開始體驗」 (closes modal). When quota later exhausts, client shows the Thanks modal instead of the Purchase modal (see §6).

---

## 6. Purchase Modal & Thanks Modal

### 6.1 Client-side flow

When `/api/divine*` returns 402:
```
402 → fetch wrapper intercepts
  ↓
canPurchase === true  → <PurchaseModal />
canPurchase === false → <ThanksForTryingModal />
```

### 6.2 `PurchaseModal.tsx`

**Design quality requirement:** This modal MUST be implemented via the `frontend-design` skill during the implementation phase. It must match the site's existing visual language and feel premium — not a cheap "give us money" prompt. Tone should be consistent with the app's divination aesthetic.

Behavior:
1. On open, `GET /api/packages` fetches active packages sorted by `sortOrder`.
2. Each package rendered as a card showing:
   - Name + description
   - Price: `HK$ {priceAmount / 100}`
   - Grant breakdown: 「含 X 次個別問答 / Y 次三師論道」
   - Embedded `<stripe-buy-button buy-button-id={pkg.buyButtonId} publishable-key={pkg.publishableKey} client-reference-id={user.id} />`
3. Stripe buy-button script loaded once via Next.js `<Script src="https://js.stripe.com/v3/buy-button.js" strategy="afterInteractive" />`.
4. Header text: 「付款成功後系統會自動加值，你可以直接回到本頁繼續使用。」

### 6.3 `ThanksForTryingModal.tsx`

- Title: 「感謝您的體驗 🌱」
- Body (user's exact words): 「人生的路還很長，未來還有無限可能性，不要執著於先天命運。」
- Single button 「我明白了」 to dismiss.
- No purchase link, no "upgrade", no "unlock" language.
- User can still view previously generated results; cannot start new divinations.

### 6.4 `GET /api/packages` (authenticated, non-admin)

Returns minimal fields for rendering: `id, name, description, buyButtonId, publishableKey, priceAmount, currency, singleCreditsGranted, multiCreditsGranted`. Deliberately excludes `stripePriceId` and internal metadata.

### 6.5 End-user purchase history

Add a section to the user's own account page (existing route under `(protected)`) titled 「購買紀錄」 showing the user's rows from `purchases` in reverse chronological order.

Columns: date / package name (snapshot via JOIN, fallback to 「已下架方案」 if `packageId` is null) / amount / granted credits / status badge (paid / refunded).

API: `GET /api/me/purchases` — returns only the authenticated user's own purchases. Does NOT expose `stripeSessionId` or `stripePaymentIntentId` (those are internal).

Also display current remaining quota prominently at the top of the section: 「個別問答剩餘 X 次 / 三師論道剩餘 Y 次」, computed as `credits − used`. For exempt users this section displays 「無限次」 badges instead.

---

## 7. Admin Payment Tab — Package Management

### 7.1 Placement

Extend `/app/admin/page.tsx` `Tab` type with `'payments'`. Payments tab has an internal sub-nav: **方案管理** | **收入與交易**.

### 7.2 Packages list UI

- 「＋ 新增方案」 button
- Table of all packages (inactive ones shown dimmed)
- Columns: sortOrder / name / credits (single + multi) / price / status / Stripe match / actions
- Row actions: edit / toggle active / delete (delete only allowed if no `purchases` rows reference this package; otherwise only deactivate)

### 7.3 Create/edit form (modal or drawer)

Fields:
1. Name
2. Description (optional, 2-row textarea)
3. **Stripe config block** with help text: 「從 Stripe Dashboard → Payment Links → 你建立的 Buy Button → embed code 複製以下兩個值」
   - `buy-button-id` input
   - `publishable-key` input
   - 「🔍 驗證並抓取方案資訊」 button
4. Credit grants:
   - `單次問答 +N` (min 0)
   - `三師論道 +M` (min 0)
5. `sortOrder` (number)
6. `isActive` (switch)

### 7.4 Verify button → `POST /api/admin/packages/verify`

Server uses `STRIPE_SECRET_KEY` to look up the payment link/buy button, extracts `line_items[0].price`, returns `{ stripePriceId, priceAmount, currency, productName }`. Form displays these as read-only. If currency ≠ `hkd`, shows red warning. Save is blocked until verification succeeds. Rationale: price id / amount / currency must never be hand-typed — mismatches cause webhook attribution failures.

### 7.5 APIs

- `GET /api/admin/packages` — list all (admin only)
- `POST /api/admin/packages` — create
- `PATCH /api/admin/packages/:id` — update
- `DELETE /api/admin/packages/:id` — delete or 409 if referenced
- `POST /api/admin/packages/verify` — Stripe lookup
- All gated by admin email check (403 otherwise)

---

## 8. Admin Payment Tab — Revenue Dashboard

### 8.1 Stripe connection status card

Top of tab. Shows 「Stripe 已連線 ✓」 or 「⚠ 缺少環境變數：STRIPE_SECRET_KEY」. Server only reports presence of env vars, never values. If any key missing, dashboard rendered disabled with instructions to set env vars and redeploy.

### 8.2 Range selector

Tabs: `1D / 1W / 1M / 3M / 6M / 1Y`, default `1M`.

### 8.3 Four stat cards (within selected range)

- Total revenue (HKD)
- Transaction count
- Average order value
- New paying users (first-ever purchase in range)

### 8.4 Charts

**Line chart**: x = time, y = HKD. Bucket rule:
- 1D → hourly
- 1W → daily
- 1M → daily
- 3M → weekly
- 6M → weekly
- 1Y → monthly

Source: `purchases WHERE status='paid' AND createdAt BETWEEN ...`.

**Horizontal bar chart**: per-package sales share in the selected range.

### 8.5 Stripe reconciliation panel

Shows `最近 7 天：我方記錄 N 筆 / HK$ X ⚖ Stripe 回報 N 筆 / HK$ X`. Mismatch → red warning listing differing session ids. Source: live `stripe.balanceTransactions.list({ created: { gte: ... } })`.

### 8.6 Transaction list (paginated)

Columns: time / user email (→ admin users tab) / package name / amount / status badge / Stripe session id (→ Stripe dashboard link).

Sortable headers: time, amount, user.

Search box (debounced 300ms): email / package name / Stripe session id via SQL `ILIKE`.

Defaults: time desc, 25 rows/page.

### 8.7 APIs

- `GET /api/admin/payments/stats?range=1M` — cards + charts
- `GET /api/admin/payments/transactions?q=&sort=&page=` — list
- `GET /api/admin/payments/stripe-reconcile?days=7` — live Stripe call
- All gated by admin email check

---

## 9. Stripe Webhook

### 9.1 Endpoint

`POST /api/webhooks/stripe/route.ts` (new).

```ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

### 9.2 Handler skeleton

1. Read raw body via `req.text()` (MUST NOT use `req.json()` first — signature is over raw bytes).
2. `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`. Failure → 400.
3. `INSERT INTO stripe_events (id, type) VALUES (?, ?) ON CONFLICT DO NOTHING`. rowCount = 0 → already processed, return 200.
4. Dispatch by `event.type`.
5. Return 200 even for ignored event types.

### 9.3 `checkout.session.completed` handler

1. `userId = parseInt(session.client_reference_id)`. If missing/invalid → log error, fire admin alert, return 200 (do NOT throw — avoids Stripe retry loop).
2. `lineItems = await stripe.checkout.sessions.listLineItems(session.id)`.
3. `pkg = SELECT * FROM payment_packages WHERE stripePriceId = $1`. If not found → log error, alert admin, return 200.
4. In a single DB transaction:
   - `INSERT INTO purchases (...) ON CONFLICT (stripeSessionId) DO NOTHING` (second idempotency layer)
   - `UPDATE users SET singleCredits = singleCredits + $pkg.singleCreditsGranted, multiCredits = multiCredits + $pkg.multiCreditsGranted WHERE id = $userId`
5. After commit: send admin purchase email (§10).

### 9.4 `charge.refunded` handler

1. Look up `purchases` by `stripePaymentIntentId = charge.payment_intent`.
2. If found and `status = 'paid'`:
   - `UPDATE purchases SET status='refunded', refundedAt=now()`
   - `UPDATE users SET singleCredits = GREATEST(singleCredits - $singleGranted, singleUsed), multiCredits = GREATEST(multiCredits - $multiGranted, multiUsed) WHERE id = $userId`
3. If not found (webhook ordering race): log warning, do not throw.
4. After commit: send admin refund email (§10).

### 9.5 Refund-safe credit deduction

Use `GREATEST(credits - granted, used)` NOT `GREATEST(credits - granted, 0)`. Example:
- User buys +20 single (credits 10 → 30), uses 15 (used=15), then refunds.
- Naive: credits = 30 − 20 = 10, remaining = 10 − 15 = **−5** (bug).
- Correct: credits = max(30 − 20, 15) = 15, remaining = 15 − 15 = **0**.
- Semantics: already-consumed usage is preserved; only unused portion of the refund is revoked.

### 9.6 Events registered in Stripe dashboard

- `checkout.session.completed`
- `charge.refunded`

All other event types are accepted (200) but not processed.

---

## 10. Admin Email Notifications

Sent from the webhook handler AFTER DB commit, BEFORE returning 200. Uses existing Resend helper in `app/lib/` (no new dependency).

### 10.1 Purchase success

- To: `ADMIN_EMAIL`
- Subject: `[收入通知] {user.email} 購買了「{package.name}」- HK$ {amount/100}`
- Body includes: user email, package name, amount, granted credits, purchase time, Stripe session id + dashboard link, user's current remaining credits.

### 10.2 Refund

- To: `ADMIN_EMAIL`
- Subject: `[退款警示] {user.email} 的「{package.name}」已退款 - HK$ {amount/100}`
- Body includes: original purchase time, refund time, amount, credits deducted, user's remaining credits, Stripe charge dashboard link.

### 10.3 Failure policy

Email send failure does NOT affect webhook 200 response. Log error + insert warning into `stripe_events` table. Rationale: correct credit state is more important than notification delivery; email retries must not cause Stripe to retry the webhook and risk double-granting credits.

---

## 11. Environment Variables (Vercel project settings)

All stored as Vercel env vars — NEVER in DB, NEVER surfaced in admin UI.

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Server-side Stripe API calls (verify packages, reconciliation) |
| `STRIPE_WEBHOOK_SECRET` | Verify webhook signatures |
| `STRIPE_PUBLISHABLE_KEY` | Exposed to frontend (also stored per-package in DB) |
| `ADMIN_EMAIL` | Already exists; reused for admin role check and notification recipient |

Admin UI only reports presence of these via Stripe connection status card.

---

## 12. Testing Strategy

TDD: write tests first for each module.

1. **`quota.ts` unit tests**: exempt roles pass through; normal users' remaining calculation; concurrent `consumeQuota` TOCTOU protection.
2. **`/api/divine` & `/api/divine-multi` integration tests**: 402 response shape includes `canPurchase`; exempt roles bypass.
3. **Age verification API tests**: age < 18 → `canPurchase=false`; age ≥ 18 → true; date boundary validation.
4. **Webhook idempotency tests**: same event delivered twice grants credits once.
5. **Webhook refund logic tests**: three scenarios for `GREATEST(credits - granted, used)` (plenty remaining / consumed more than refund / fully unused).
6. **Package CRUD tests**: non-admin → 403; verify endpoint mocks Stripe API.
7. **Webhook mismatch/error paths**: missing `client_reference_id`, unknown `stripePriceId`, refund for missing purchase — each must return 200 and log.

---

## 13. Rollout Checklist

- [ ] Vercel env vars set: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`.
- [ ] Stripe dashboard webhook endpoint points to `https://<prod>/api/webhooks/stripe` with `checkout.session.completed` + `charge.refunded` events selected.
- [ ] Backfill SQL executed on staging first; verify regular users get 10/2, exempt roles untouched.
- [ ] First package created in Stripe test mode, full end-to-end flow validated on preview deployment.
- [ ] Admin login verified: age modal does NOT block admin (email exempt).
- [ ] Full flow on a regular test account: age verify → consume quota → purchase → webhook grants credits → admin email received.
- [ ] Test refund executed: admin email received, DB status updated, credits correctly deducted via `GREATEST(..., used)`.
- [ ] Reconciliation panel shows matching counts between local and Stripe.

---

## 14. Decisions Recorded (from brainstorming)

| # | Question | Decision |
|---|---|---|
| 1 | Quota scope | Apply to all non-exempt approved users via backfill migration (option B). Admin / ambassador / friend remain unlimited. |
| 2 | Stripe attribution | `client-reference-id` on `<stripe-buy-button>` (option A). |
| 3 | Age verification input | Date of birth + displayed computed age (option C). Minors: same 10/2 trial quota. |
| 4 | Stripe secret storage | Env vars only (option A). Admin UI reports presence, not values. |
| 5 | Package schema | Both credit types allowed simultaneously. Verify button auto-fetches price id/amount/currency. User purchase history visible to end users. |
| 6 | Revenue data source | Hybrid: local `purchases` table primary + live Stripe reconciliation (option C). Refunds auto-deduct credits. HKD only. |
| 7 | Age modal scope | One-time disruption for all existing approved users on next login. |
| 8 | Admin notifications | Email on both successful purchase and refund. |
| 9 | Purchase modal quality | Must be implemented via `frontend-design` skill with premium feel, matching site style. |
