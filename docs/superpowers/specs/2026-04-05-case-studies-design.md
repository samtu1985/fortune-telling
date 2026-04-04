# Anonymous Case Studies (Phase C+D)

## Overview

After PDF download, offer users the option to contribute their conversation as an anonymized case study. AI removes PII and generates a summary. Admin can browse the case library.

## User Flow

1. PDF download completes → dialog: "Would you like to contribute this as an anonymous case study?"
2. User clicks "Yes" → call AI to anonymize + summarize → show preview
3. User confirms → save to DB → show thank you message
4. User clicks "No" → dismiss, done

## Database

New `case_studies` table:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK, default random | |
| summary | text, not null | AI-generated 100-200 char summary (PII removed) |
| fullContent | text, not null | Full anonymized conversation |
| originalQuestion | text | User's question (PII removed) |
| masterTypes | varchar(30), default "bazi,ziwei,zodiac" | Which masters participated |
| createdAt | timestamptz, default now | |

## AI Anonymization

Single API call using the bazi master's AI config. System prompt instructs the AI to:

1. Remove all PII (names, exact birth dates, locations, emails)
2. Replace with generalized descriptions ("1990年代出生的女性", "東亞某城市")
3. Keep all divination analysis intact
4. Generate a 100-200 character summary of the case highlights
5. Return JSON: `{ "summary": "...", "anonymizedContent": "..." }`

## API Endpoints

### `POST /api/case-studies`

Auth: any logged-in user.

Request body:
```json
{
  "messages": [...],  // full MasterMessage array
  "question": "..."   // user's original question
}
```

Process:
1. Build conversation text from messages
2. Call AI with anonymization prompt
3. Parse response JSON
4. Insert into case_studies table
5. Return `{ id, summary }` for user preview

### `GET /api/admin/case-studies`

Auth: admin only. Returns list of all cases (id, summary, createdAt).

### `GET /api/admin/case-studies/[id]`

Auth: admin only. Returns full case detail (summary, fullContent, originalQuestion, masterTypes, createdAt).

## Frontend Changes

### ComprehensiveMode.tsx

After PDF download succeeds:
1. Show consent dialog (ConfirmDialog)
2. On consent → call `POST /api/case-studies` with messages + question
3. Show AI-generated summary for user to confirm
4. On confirm → show thank you message
5. On cancel at any step → dismiss

States: `caseStudyPhase: "idle" | "consent" | "processing" | "preview" | "done"`

### Admin page

New "案例庫" tab alongside users/ai/usage:
- List view: each case shows summary + date
- Click → expand to show full anonymized content
- No edit/delete needed (read-only for now)

## i18n Keys

Add to all 4 locales:
- `case.consent`: consent dialog message
- `case.consentYes`: yes button
- `case.consentNo`: no button  
- `case.processing`: loading message
- `case.preview`: preview title
- `case.confirmSubmit`: confirm button
- `case.thankYou`: thank you message
- `admin.casesTab`: tab label
- `admin.noCases`: empty state
- `admin.caseDate`: date label

## Files

- Modify: `app/lib/db/schema.ts` — add caseStudies table
- Create: `app/api/case-studies/route.ts` — POST handler
- Create: `app/api/admin/case-studies/route.ts` — GET list
- Create: `app/api/admin/case-studies/[id]/route.ts` — GET detail
- Modify: `app/components/ComprehensiveMode.tsx` — consent flow after PDF
- Modify: `app/admin/page.tsx` — cases tab
- Modify: `app/lib/i18n.ts` — translation keys
