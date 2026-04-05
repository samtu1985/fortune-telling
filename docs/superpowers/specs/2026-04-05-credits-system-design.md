# Credits System (Phase 1: Foundation)

## Overview

Add a credits/quota system to track free trial usage for individual Q&A and three masters discussions. Admin configures default credits. Soft reminders when credits run out (no hard blocking).

## Database

### New `credit_settings` table (single row, global defaults)

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| defaultSingleRounds | integer, default 10 | Default free individual Q&A rounds |
| defaultMultiSessions | integer, default 1 | Default free three masters sessions |
| updatedAt | timestamptz | |

### New columns on `users` table

| Column | Type | Notes |
|--------|------|-------|
| singleCredits | integer, default 0 | Total individual Q&A rounds granted |
| multiCredits | integer, default 0 | Total three masters sessions granted |
| singleUsed | integer, default 0 | Individual Q&A rounds consumed |
| multiUsed | integer, default 0 | Three masters sessions consumed |

Remaining = credits - used. Can go negative (soft limit).

## Credit Consumption

### Individual Q&A (`/api/divine`)
Each completed AI response = 1 round consumed. Increment `singleUsed` after stream completes (alongside existing `logUsage`).

### Three Masters (`ComprehensiveMode`)
Each new discussion topic = 1 session consumed. Increment `multiUsed` when `handleStartDiscussion` fires (first round begins). Follow-up questions within the same discussion do NOT consume additional credits.

### Soft Reminder
When remaining credits <= 0, show a dismissible banner at the top of the conversation area. Do not block usage.

## API Endpoints

### `GET /api/admin/credit-settings`
Admin only. Returns current default values.

### `PUT /api/admin/credit-settings`
Admin only. Updates default values: `{ defaultSingleRounds, defaultMultiSessions }`.

### `GET /api/credits`
Authenticated user. Returns own credits:
```json
{
  "singleCredits": 10,
  "singleUsed": 3,
  "singleRemaining": 7,
  "multiCredits": 1,
  "multiUsed": 0,
  "multiRemaining": 1
}
```

### `POST /api/credits/consume`
Internal use (called by divine routes). Body: `{ type: "single" | "multi" }`. Increments the used counter.

## Admin UI

Add a "Credits" section in the admin AI settings tab (not a separate tab — it's a small config):
- Default individual Q&A rounds: number input
- Default three masters sessions: number input
- Save button

In the user list, show each user's credits: "Single: 3/10 | Multi: 0/1"

## User UI

### UserMenu dropdown
Add a credits display section showing remaining credits:
```
免費體驗額度
個別問答：剩餘 7 次
三師論道：剩餘 1 次
```

### Soft reminder banner
When credits <= 0, show at the top of conversation area:
"您的免費體驗額度已用完。如需更多額度，請聯繫管理員。"
Dismissible (click X to close for current session).

## i18n Keys

Add to all 4 locales:
- `credits.title`: section title
- `credits.singleRemaining`: individual remaining display
- `credits.multiRemaining`: multi remaining display
- `credits.exhausted`: soft reminder message
- `credits.dismiss`: dismiss button
- `admin.creditSettings`: admin section title
- `admin.defaultSingleRounds`: label
- `admin.defaultMultiSessions`: label
- `admin.creditsSave`: save button
- `admin.userCredits`: user list credits display

## Files

- Modify: `app/lib/db/schema.ts` — add creditSettings table + user columns
- Create: `app/api/admin/credit-settings/route.ts` — GET/PUT
- Create: `app/api/credits/route.ts` — GET user credits
- Create: `app/api/credits/consume/route.ts` — POST consume
- Modify: `app/api/divine/route.ts` — consume single credit after stream
- Modify: `app/components/ComprehensiveMode.tsx` — consume multi credit on start
- Modify: `app/components/UserMenu.tsx` — show credits
- Modify: `app/admin/page.tsx` — credit settings + user credits display
- Modify: `app/lib/i18n.ts` — translation keys

## Future (Phase 2-3)

- Ambassador role + send free trial invitations
- Email with credits info for new/existing users
- Pending credits for unregistered users (applied after approval)
