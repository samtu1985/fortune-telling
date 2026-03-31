# Multi-Profile, Saved Charts & Saved Conversations Design

Date: 2026-03-31

## Overview

Three features to enhance user experience:
1. **New Discussion button** — reset a single scene's conversation without clearing others
2. **Multi-profile system** — save up to 10 people's birth data per user, with chart caching
3. **Save AI responses** — bookmark individual AI replies with the preceding user question

## 1. New Discussion Button

### Behavior
- Located **below the follow-up input area** (bottom of conversation view)
- On click: confirmation dialog — "目前的對話將會清除，確定要開始新討論嗎？"
- On confirm: clear that scene's conversation state, return to input form / tab view
- Does NOT affect other scenes' conversations

### UI
- Small, understated button below the follow-up input and disclaimer text
- Style: text button with border, consistent with existing design language

## 2. Multi-Profile System

### Data Model

Replace `UserData.profile` (single) with `UserData.profiles` (array, max 10):

```ts
interface SavedProfile {
  id: string;              // nanoid
  label: string;           // user-defined name: "本人", "母親", "另一半"
  birthDate: string;       // YYYY-MM-DD
  birthTime: string;       // HH:mm
  gender: string;          // "男" | "女" | ""
  birthPlace: string;
  calendarType: "solar" | "lunar";
  isLeapMonth: boolean;
  savedCharts?: {
    bazi?: string;         // raw <bazi-chart> text from program calculation
    ziwei?: string;        // raw <ziwei-chart> text
    zodiac?: string;       // raw <natal-chart> text
  };
  createdAt: string;
  updatedAt: string;
}
```

### Migration
- On read: if legacy `profile` field exists and `profiles` does not, auto-migrate to `profiles[0]` with `label: "本人"`, `calendarType: "solar"`, `isLeapMonth: false`
- Remove legacy `profile` field after migration

### API

All endpoints use `auth()` for user isolation. Email-keyed access only.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profiles` | List all profiles for current user |
| POST | `/api/profiles` | Create profile (reject if >= 10) |
| PUT | `/api/profiles/[id]` | Update profile (including savedCharts) |
| DELETE | `/api/profiles/[id]` | Delete profile |

### InputForm UI Changes

- **Remove auto-fill from personal profile** — no more automatic `fetch('/api/profile')` on load
- **Add profile selector dropdown** at top of form — lists saved profiles by label
  - Selecting a profile fills in all birth data fields
  - Option "手動輸入" for blank form
- **Add "保存此檔案" section** at bottom of form:
  - Text input for label name
  - Save button (creates new profile or updates existing if selected from dropdown)
  - Show count: "已保存 3/10 筆"
- **Saved chart display**: if selected profile has a saved chart for the current scene type:
  - Show "查看已保存的命盤" button — displays the raw chart data in a modal/expandable section
  - After generating a new chart, offer "覆蓋已保存的命盤" option

### ProfileModal Changes
- Transform from single-profile editor to multi-profile manager
- List all saved profiles with edit/delete actions
- Add new profile form (with label input)

### Chart Saving Flow
1. User selects a profile and submits → API generates chart → AI analyzes
2. The generated chart text (from `generateBaziChart` / `generateZiweiChart` / `generateNatalChart`) is returned to the client alongside the AI response
3. Client offers "保存命盤" button → calls `PUT /api/profiles/[id]` with chart data
4. If profile already has a chart for this type, confirm before overwriting

### Implementation: Exposing Chart Data to Client
- Modify `/api/divine` to include the raw chart text in the SSE stream as a special event (e.g., `data: {"chart": "..."}`)
- Client stores this in conversation state for the save-chart flow

## 3. Saved Conversations

### Data Model

New field `UserData.savedConversations` (array):

```ts
interface SavedConversation {
  id: string;                          // nanoid
  type: "bazi" | "ziwei" | "zodiac";   // which scene
  userQuestion: string;                // the preceding user message
  aiResponse: string;                  // AI response content
  aiReasoning?: string;                // AI reasoning (if any)
  profileLabel?: string;               // whose data was used
  savedAt: string;
}
```

### API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/saved-conversations?type=bazi` | List saved conversations, filtered by type |
| POST | `/api/saved-conversations` | Save a conversation |
| DELETE | `/api/saved-conversations/[id]` | Delete a saved conversation |

### UI: Save Button
- Every AI response bubble gets a small "保存" button at bottom-right
- On click: immediately saves (the user question + AI response are already in client state)
- Visual feedback: button changes to "已保存" with checkmark
- If already saved, show "已保存" (disabled state)

### UI: Saved Conversations Tab
- When entering a scene (after selecting 八字/紫微/星座), show **two tabs**:
  - Tab 1: "輸入資料" — the existing InputForm (with new profile selector)
  - Tab 2: "已保存對話" — list of saved conversations for this scene type
- Tab view appears BEFORE conversation starts (replacing the current direct-to-form flow)
- Saved conversations display:
  - Blockquote of user question (引用格式)
  - Full AI response with existing markdown rendering
  - Profile label if available
  - Save timestamp
  - Delete button

## 4. Privacy & Isolation

- All API endpoints: `auth()` → extract `session.user.email` → read/write only that user's data
- No cross-user data leakage possible: all data keyed by email in `users.json`
- Client never caches or requests data for other users
- Profiles and saved conversations are nested under each user's record

## 5. Storage Structure

Updated `UserData`:
```ts
interface UserData {
  name: string | null;
  image: string | null;
  status: UserStatus;
  createdAt: string;
  approvedAt: string | null;
  // Legacy (migrated away):
  // profile?: UserProfile;
  profiles?: SavedProfile[];
  savedConversations?: SavedConversation[];
}
```

All data continues to use Vercel Blob (`users.json`) in production, local file in dev.

## 6. Backward Compatibility

- Existing users with `profile` field: auto-migrated to `profiles[0]` on first read
- Existing users without profiles: empty `profiles` array, no pre-filled data
- No breaking changes to the `/api/divine` endpoint format (chart injection stays in system prompt / message content)

## 7. Out of Scope

- Sharing profiles or conversations between users
- Exporting/importing profiles
- Search within saved conversations
- Saved conversation categories or tags
