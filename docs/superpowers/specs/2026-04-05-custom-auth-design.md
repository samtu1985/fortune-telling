# Custom Account Registration + Login (Phase 1)

## Overview

Add credentials-based registration and login alongside existing Google OAuth. Includes forgot/reset password flow via Resend email API.

## User Status Flow

```
Custom account: unverified → pending → approved → disabled
Google account:              pending → approved → disabled
```

Phase 1 creates users as `pending` directly (email verification comes in Phase 2).

## DB Schema Changes

Add columns to `users` table:

| Column | Type | Notes |
|--------|------|-------|
| username | varchar(50), unique, nullable | Alphanumeric + underscore only |
| passwordHash | text, nullable | bcrypt hash |
| authProvider | varchar(20), default "google" | "google" or "credentials" |
| resetToken | text, nullable | Password reset token |
| resetTokenExpiry | timestamptz, nullable | Token expiry (1 hour) |

Google users have null username/passwordHash. The `authProvider` field distinguishes login method.

## API Endpoints

### `POST /api/auth/register`

Request:
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "MyPass123"
}
```

Validations:
- Username: 3-30 chars, alphanumeric + underscore only (`/^[a-zA-Z0-9_]{3,30}$/`)
- Email: valid format, not already registered
- Username: not already taken
- Password: min 8 chars, must contain uppercase + lowercase + digit

On success: create user with status `pending`, authProvider `credentials`. Return 201.

On validation failure: return 400 with specific error message.

### `GET /api/auth/check-username?q=xxx`

Returns `{ available: boolean }`. Used for real-time username availability check on the registration form.

### `POST /api/auth/forgot-password`

Request: `{ "email": "john@example.com" }`

- Look up user by email where authProvider = "credentials"
- Generate crypto.randomUUID() token, save to resetToken/resetTokenExpiry (1 hour)
- Send reset email via Resend API (or console.log if no API key)
- Always return 200 (don't reveal if email exists)

### `POST /api/auth/reset-password`

Request: `{ "token": "...", "password": "NewPass123" }`

- Find user by resetToken where resetTokenExpiry > now
- Validate password complexity
- Update passwordHash, clear resetToken/resetTokenExpiry
- Return 200 on success, 400 on invalid/expired token

## NextAuth Changes

Add Credentials provider to `app/lib/auth.ts`:
- Accept username + password
- Look up user by username where authProvider = "credentials"
- Verify password with bcrypt
- Only allow login if status is "approved"
- Return appropriate error for pending/disabled/unverified/wrong password

## Pages

### Login page (`/login`) — modify existing

- Keep Google sign-in button
- Add divider "or" / 「或」
- Add username + password form with login button
- Add "Forgot password?" link → `/forgot-password`
- Add "Register" link → `/register`

### Register page (`/register`) — new

- Fields: username, email, password, confirm password
- Username: real-time availability check (debounced 500ms)
- Password: show complexity requirements, validate on blur
- Confirm password: check match
- Submit → call register API → show success message (pending admin approval)
- Link back to login

### Forgot password page (`/forgot-password`) — new

- Email input field
- Submit → call forgot-password API → show "check your email" message
- Link back to login

### Reset password page (`/reset-password`) — new

- Read token from URL query param
- New password + confirm password fields
- Submit → call reset-password API → show success → redirect to login
- Handle invalid/expired token gracefully

## Dependencies

- `bcryptjs` — password hashing (pure JS, no native deps)
- `resend` — email sending (for forgot-password; Phase 2 will also use it for verification)

## Environment Variables

- `RESEND_API_KEY` — Resend API key (optional; if missing, emails logged to console)
- `RESEND_FROM_EMAIL` — sender address (default: `noreply@fortune-for.me`)

## i18n

Add translation keys for all new UI text (registration form labels, error messages, success messages, forgot/reset password) across 4 locales.

## Files Changed/Created

- Modify: `app/lib/db/schema.ts` — add columns to users table
- Modify: `app/lib/auth.ts` — add Credentials provider
- Modify: `app/lib/users.ts` — add register function, username/email checks
- Modify: `app/login/page.tsx` — add credentials form + links
- Create: `app/register/page.tsx` — registration page
- Create: `app/forgot-password/page.tsx` — forgot password page
- Create: `app/reset-password/page.tsx` — reset password page
- Create: `app/api/auth/register/route.ts` — register API
- Create: `app/api/auth/check-username/route.ts` — username check API
- Create: `app/api/auth/forgot-password/route.ts` — forgot password API
- Create: `app/api/auth/reset-password/route.ts` — reset password API
- Create: `app/lib/email.ts` — Resend email helper
- Modify: `app/lib/i18n.ts` — add translation keys
- Modify: `app/admin/page.tsx` — show authProvider in user list, handle unverified status
