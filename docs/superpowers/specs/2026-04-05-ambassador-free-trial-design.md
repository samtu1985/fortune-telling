# Ambassador + Free Trial Invitations (Phase 2)

## Overview

Admin and ambassadors can send free trial invitations via email. Recipients get credits for individual Q&A and three masters discussions. Handles both registered and unregistered users.

## Database

### `users` table — new column

| Column | Type | Notes |
|--------|------|-------|
| isAmbassador | boolean, default false | Ambassador role flag |

### New `pending_credits` table

For unregistered users — credits held until they register and get approved.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK, default random | |
| email | varchar(255), not null | Recipient email |
| singleCredits | integer, not null | Individual Q&A rounds |
| multiCredits | integer, not null | Three masters sessions |
| sentBy | varchar(255) | Sender email |
| createdAt | timestamptz, default now | |

## Send Flow

1. Admin/ambassador clicks avatar → "Send Free Trial"
2. Modal: email input + credit amounts (pre-filled with admin defaults)
3. Submit → `POST /api/credits/send`
4. Backend checks if email is registered:
   - **Registered + approved**: add credits directly to user, send notification email
   - **Registered but not approved**: add credits directly, send notification email
   - **Not registered**: insert into `pending_credits`, send invitation email with register link
5. When an unregistered user registers and gets approved → auto-apply pending credits

## Credit Application on Approval

Modify `updateUserStatus` in `users.ts`: when status changes to `approved`, check `pending_credits` for that email, sum up and add to user's credits, then delete the pending rows.

## API Endpoints

### `POST /api/credits/send`

Auth: admin or ambassador only.

Request:
```json
{
  "email": "recipient@example.com",
  "singleCredits": 10,
  "multiCredits": 1
}
```

Response: `{ success: true, status: "credited" | "pending" }`

### `PATCH /api/admin/users` (existing — modify)

Add support for toggling ambassador: `{ email, isAmbassador: true/false }`

## Emails (via Resend)

### Notification email (registered user)

Subject: FortuneFor.me — 您收到免費體驗額度！

Content:
- FortuneFor.me branding
- "您收到了免費體驗額度"
- Credit details: 個別問答 X 次、三師論道 X 次
- "登入後點擊右上角頭像，即可查詢剩餘免費體驗次數"
- Login button link

### Invitation email (unregistered user)

Subject: FortuneFor.me — 邀請您免費體驗命理分析！

Content:
- FortuneFor.me branding
- "您被邀請免費體驗 FortuneFor.me 的命理分析服務"
- Credit details: 個別問答 X 次、三師論道 X 次
- "註冊並通過審核後，額度將自動加入您的帳戶"
- "登入後點擊右上角頭像，即可查詢剩餘免費體驗次數"
- Register button link

## UI Changes

### UserMenu dropdown

For admin and ambassadors, add "Send Free Trial" menu item (between font size toggle and admin/logout).

### SendTrialModal (new component)

Modal with:
- Email input
- Individual Q&A credits: number input (pre-filled from admin defaults)
- Three masters credits: number input (pre-filled from admin defaults)
- Send button
- Success/error feedback

### Admin user list

Add "Ambassador" toggle button for each non-admin user.

## i18n Keys

- `menu.sendTrial`: menu item label
- `trial.title`: modal title
- `trial.email`: email label
- `trial.singleCredits`: individual credits label
- `trial.multiCredits`: multi credits label
- `trial.send`: send button
- `trial.sending`: loading state
- `trial.successCredited`: success for registered user
- `trial.successPending`: success for unregistered user
- `trial.error`: error message
- `admin.ambassador`: ambassador label
- `admin.setAmbassador`: set ambassador button
- `admin.removeAmbassador`: remove ambassador button

## Files

- Modify: `app/lib/db/schema.ts` — add isAmbassador column + pending_credits table
- Modify: `app/lib/users.ts` — apply pending credits on approval
- Modify: `app/lib/email.ts` — add trial notification + invitation emails
- Create: `app/api/credits/send/route.ts` — send credits API
- Modify: `app/api/admin/users/route.ts` — ambassador toggle
- Create: `app/components/SendTrialModal.tsx` — modal component
- Modify: `app/components/UserMenu.tsx` — add send trial menu item
- Modify: `app/admin/page.tsx` — ambassador toggle in user list
- Modify: `app/lib/i18n.ts` — translation keys

## Brand Name

All emails and UI use "FortuneFor.me" (no hyphen).
