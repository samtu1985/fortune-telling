# Multi-Profile, Saved Charts & Saved Conversations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-profile management (up to 10 people), chart caching, saved AI conversations, and per-scene new discussion flow.

**Architecture:** Extend existing `users.json` (Vercel Blob / local file) with `profiles[]` and `savedConversations[]` arrays per user. New API routes for CRUD. Frontend: tabs in scene view, profile selector in form, save buttons on AI responses.

**Tech Stack:** Next.js 16 App Router, Vercel Blob, `crypto.randomUUID()` for IDs (no new deps), existing auth via NextAuth.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `app/lib/users.ts` | Add `SavedProfile`, `SavedConversation` types; profile CRUD functions; saved conversation CRUD; legacy migration |
| Delete | `app/api/profile/route.ts` | Replaced by new profiles API |
| Create | `app/api/profiles/route.ts` | GET (list) + POST (create) profiles |
| Create | `app/api/profiles/[id]/route.ts` | PUT (update) + DELETE profile by ID |
| Create | `app/api/saved-conversations/route.ts` | GET (list by type) + POST (save) |
| Create | `app/api/saved-conversations/[id]/route.ts` | DELETE saved conversation |
| Modify | `app/api/divine/route.ts` | Emit chart data as SSE event for client-side chart saving |
| Modify | `app/components/InputForm.tsx` | Profile selector dropdown, save profile section, remove auto-fill, saved chart view |
| Modify | `app/components/ProfileModal.tsx` | Multi-profile list manager (add/edit/delete) |
| Modify | `app/components/ResultDisplay.tsx` | Add "保存" button on AI responses |
| Create | `app/components/SavedConversations.tsx` | Saved conversations list with blockquote display |
| Create | `app/components/ConfirmDialog.tsx` | Reusable confirmation dialog |
| Modify | `app/(protected)/page.tsx` | Tabs (輸入資料/已保存對話), new discussion button, chart saving flow, wire up save conversation |

---

### Task 1: Data Layer — Types and Profile CRUD

**Files:**
- Modify: `app/lib/users.ts`

- [ ] **Step 1: Add new types to `app/lib/users.ts`**

Add after the existing `UserProfile` interface (around line 11):

```ts
export interface SavedProfile {
  id: string;
  label: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
  calendarType: "solar" | "lunar";
  isLeapMonth: boolean;
  savedCharts?: {
    bazi?: string;
    ziwei?: string;
    zodiac?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SavedConversation {
  id: string;
  type: "bazi" | "ziwei" | "zodiac";
  userQuestion: string;
  aiResponse: string;
  aiReasoning?: string;
  profileLabel?: string;
  savedAt: string;
}
```

Update `UserData` to add the new fields:

```ts
export interface UserData {
  name: string | null;
  image: string | null;
  status: UserStatus;
  createdAt: string;
  approvedAt: string | null;
  profile?: UserProfile;              // legacy, will be migrated
  profiles?: SavedProfile[];
  savedConversations?: SavedConversation[];
}
```

- [ ] **Step 2: Add legacy migration helper**

Add this function to `app/lib/users.ts`:

```ts
function migrateUserData(user: UserData): UserData {
  // Migrate legacy single profile to profiles array
  if (user.profile && !user.profiles) {
    const legacy = user.profile;
    user.profiles = [
      {
        id: crypto.randomUUID(),
        label: "本人",
        birthDate: legacy.birthDate || "",
        birthTime: legacy.birthTime || "",
        gender: legacy.gender || "",
        birthPlace: legacy.birthPlace || "",
        calendarType: "solar",
        isLeapMonth: false,
        createdAt: user.createdAt,
        updatedAt: new Date().toISOString(),
      },
    ];
    delete user.profile;
  }
  return user;
}
```

- [ ] **Step 3: Update `getUser` to apply migration**

Replace the existing `getUser` function:

```ts
export async function getUser(email: string): Promise<UserData | null> {
  const users = await readUsers();
  const user = users[email];
  if (!user) return null;
  return migrateUserData(user);
}
```

- [ ] **Step 4: Add profile CRUD functions**

Add these functions to `app/lib/users.ts`:

```ts
const MAX_PROFILES = 10;

export async function getProfiles(email: string): Promise<SavedProfile[]> {
  const users = await readUsers();
  const user = users[email];
  if (!user) return [];
  migrateUserData(user);
  return user.profiles || [];
}

export async function createProfile(
  email: string,
  profile: Omit<SavedProfile, "id" | "createdAt" | "updatedAt">
): Promise<SavedProfile | null> {
  const users = await readUsers();
  if (!users[email]) return null;
  migrateUserData(users[email]);
  const profiles = users[email].profiles || [];
  if (profiles.length >= MAX_PROFILES) return null;

  const now = new Date().toISOString();
  const newProfile: SavedProfile = {
    ...profile,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  profiles.push(newProfile);
  users[email].profiles = profiles;
  await writeUsers(users);
  return newProfile;
}

export async function updateProfileById(
  email: string,
  id: string,
  updates: Partial<Omit<SavedProfile, "id" | "createdAt">>
): Promise<boolean> {
  const users = await readUsers();
  if (!users[email]) return false;
  migrateUserData(users[email]);
  const profiles = users[email].profiles || [];
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  profiles[idx] = { ...profiles[idx], ...updates, updatedAt: new Date().toISOString() };
  users[email].profiles = profiles;
  await writeUsers(users);
  return true;
}

export async function deleteProfileById(
  email: string,
  id: string
): Promise<boolean> {
  const users = await readUsers();
  if (!users[email]) return false;
  migrateUserData(users[email]);
  const profiles = users[email].profiles || [];
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  profiles.splice(idx, 1);
  users[email].profiles = profiles;
  await writeUsers(users);
  return true;
}
```

- [ ] **Step 5: Add saved conversation CRUD functions**

Add these functions to `app/lib/users.ts`:

```ts
export async function getSavedConversations(
  email: string,
  type?: string
): Promise<SavedConversation[]> {
  const users = await readUsers();
  const user = users[email];
  if (!user) return [];
  const all = user.savedConversations || [];
  if (type) return all.filter((c) => c.type === type);
  return all;
}

export async function createSavedConversation(
  email: string,
  conv: Omit<SavedConversation, "id" | "savedAt">
): Promise<SavedConversation | null> {
  const users = await readUsers();
  if (!users[email]) return null;
  const conversations = users[email].savedConversations || [];
  const newConv: SavedConversation = {
    ...conv,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  conversations.push(newConv);
  users[email].savedConversations = conversations;
  await writeUsers(users);
  return newConv;
}

export async function deleteSavedConversation(
  email: string,
  id: string
): Promise<boolean> {
  const users = await readUsers();
  if (!users[email]) return false;
  const conversations = users[email].savedConversations || [];
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  conversations.splice(idx, 1);
  users[email].savedConversations = conversations;
  await writeUsers(users);
  return true;
}
```

- [ ] **Step 6: Remove old `getProfile` and `updateProfile` functions**

Delete these two functions from `app/lib/users.ts`:
- `getProfile` (lines 142-145)
- `updateProfile` (lines 147-156)

Keep the old `UserProfile` type for now (used internally by migration).

- [ ] **Step 7: Commit**

```bash
git add app/lib/users.ts
git commit -m "feat: add multi-profile and saved conversation data layer"
```

---

### Task 2: Profiles API Routes

**Files:**
- Delete: `app/api/profile/route.ts`
- Create: `app/api/profiles/route.ts`
- Create: `app/api/profiles/[id]/route.ts`

- [ ] **Step 1: Delete old profile API**

```bash
rm app/api/profile/route.ts
rmdir app/api/profile
```

- [ ] **Step 2: Create `app/api/profiles/route.ts`**

```ts
import { auth } from "@/app/lib/auth";
import {
  getProfiles,
  createProfile,
} from "@/app/lib/users";
import { NextRequest } from "next/server";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profiles = await getProfiles(email);
  return Response.json({ profiles });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const profile = await createProfile(email, {
    label: body.label || "",
    birthDate: body.birthDate || "",
    birthTime: body.birthTime || "",
    gender: body.gender || "",
    birthPlace: body.birthPlace || "",
    calendarType: body.calendarType || "solar",
    isLeapMonth: body.isLeapMonth || false,
    savedCharts: body.savedCharts,
  });

  if (!profile) {
    return Response.json(
      { error: "無法新增，可能已達上限（10 筆）或使用者不存在" },
      { status: 400 }
    );
  }

  return Response.json({ profile }, { status: 201 });
}
```

- [ ] **Step 3: Create `app/api/profiles/[id]/route.ts`**

```ts
import { auth } from "@/app/lib/auth";
import { updateProfileById, deleteProfileById } from "@/app/lib/users";
import { NextRequest } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const ok = await updateProfileById(email, id, body);
  if (!ok) {
    return Response.json({ error: "檔案不存在" }, { status: 404 });
  }
  return Response.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ok = await deleteProfileById(email, id);
  if (!ok) {
    return Response.json({ error: "檔案不存在" }, { status: 404 });
  }
  return Response.json({ success: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add -A app/api/profile app/api/profiles
git commit -m "feat: add profiles CRUD API routes, remove old profile route"
```

---

### Task 3: Saved Conversations API Routes

**Files:**
- Create: `app/api/saved-conversations/route.ts`
- Create: `app/api/saved-conversations/[id]/route.ts`

- [ ] **Step 1: Create `app/api/saved-conversations/route.ts`**

```ts
import { auth } from "@/app/lib/auth";
import {
  getSavedConversations,
  createSavedConversation,
} from "@/app/lib/users";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") || undefined;
  const conversations = await getSavedConversations(email, type);
  return Response.json({ conversations });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const conv = await createSavedConversation(email, {
    type: body.type,
    userQuestion: body.userQuestion,
    aiResponse: body.aiResponse,
    aiReasoning: body.aiReasoning,
    profileLabel: body.profileLabel,
  });

  if (!conv) {
    return Response.json({ error: "使用者不存在" }, { status: 404 });
  }

  return Response.json({ conversation: conv }, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/saved-conversations/[id]/route.ts`**

```ts
import { auth } from "@/app/lib/auth";
import { deleteSavedConversation } from "@/app/lib/users";
import { NextRequest } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ok = await deleteSavedConversation(email, id);
  if (!ok) {
    return Response.json({ error: "對話不存在" }, { status: 404 });
  }
  return Response.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/saved-conversations
git commit -m "feat: add saved conversations API routes"
```

---

### Task 4: Emit Chart Data from Divine API

**Files:**
- Modify: `app/api/divine/route.ts`

- [ ] **Step 1: Collect chart texts during message processing**

In `app/api/divine/route.ts`, before the `processedMessages` map (around line 258), add a variable to collect chart data:

```ts
  // Collect generated charts for client-side saving
  const generatedCharts: { index: number; chart: string }[] = [];
```

Then inside the `processedMessages.map`, after `const chartText = generateChartForType(type, birthData);` (around line 265), add chart collection in both the `index === 0` and `else` branches. After the existing `if (chartText)` block in index === 0:

```ts
      if (chartText) {
        generatedCharts.push({ index, chart: chartText });
```

And in the else branch, after the existing `if (chartText)`:

```ts
      if (chartText) {
        generatedCharts.push({ index, chart: chartText });
```

- [ ] **Step 2: Emit chart data as first SSE event before streaming**

In the `ReadableStream` `start` function, right before the `while (true)` loop that reads the AI response (around line 312), add:

```ts
      // Emit chart data for client-side chart saving
      for (const { index, chart } of generatedCharts) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ chartData: chart, messageIndex: index })}\n\n`)
        );
      }
```

- [ ] **Step 3: Commit**

```bash
git add app/api/divine/route.ts
git commit -m "feat: emit chart data in SSE stream for client-side saving"
```

---

### Task 5: ConfirmDialog Component

**Files:**
- Create: `app/components/ConfirmDialog.tsx`

- [ ] **Step 1: Create `app/components/ConfirmDialog.tsx`**

```tsx
"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "確定",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div
        className="relative w-full max-w-sm p-6 rounded-lg border border-gold/20 animate-fade-in-up"
        style={{ background: "var(--parchment)", animationDuration: "0.3s" }}
      >
        <h3 className="font-serif text-base text-gold tracking-wide mb-2">
          {title}
        </h3>
        <p className="text-sm text-stone/80 leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-stone border border-gold/10 hover:bg-gold/5 transition-colors font-serif tracking-widest"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-gold border border-gold/20 bg-gold/10 hover:bg-gold/20 transition-colors font-serif tracking-widest"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/ConfirmDialog.tsx
git commit -m "feat: add reusable ConfirmDialog component"
```

---

### Task 6: SavedConversations Component

**Files:**
- Create: `app/components/SavedConversations.tsx`

- [ ] **Step 1: Create `app/components/SavedConversations.tsx`**

This component fetches and displays saved conversations for a given scene type. It reuses the existing `ResultDisplay` for rendering AI responses.

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import ResultDisplay from "./ResultDisplay";

interface SavedConv {
  id: string;
  type: string;
  userQuestion: string;
  aiResponse: string;
  aiReasoning?: string;
  profileLabel?: string;
  savedAt: string;
}

interface SavedConversationsProps {
  type: "bazi" | "ziwei" | "zodiac";
}

export default function SavedConversations({ type }: SavedConversationsProps) {
  const [conversations, setConversations] = useState<SavedConv[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = () => {
    setLoading(true);
    fetch(`/api/saved-conversations?type=${type}`)
      .then((res) => res.json())
      .then((data) => setConversations(data.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchConversations();
    // Re-fetch when a conversation is saved from the chat
    const handler = () => fetchConversations();
    window.addEventListener("conversation-saved", handler);
    return () => window.removeEventListener("conversation-saved", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/saved-conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const typeLabel = useMemo(
    () => ({ bazi: "八字", ziwei: "紫微", zodiac: "星座" })[type],
    [type]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-stone/50">
          尚未保存任何{typeLabel}的對話
        </p>
        <p className="text-xs text-stone/30 mt-2">
          在對話中點擊 AI 回覆下方的「保存」按鈕即可收藏
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className="border border-gold/10 rounded-lg p-4"
          style={{ background: "rgba(var(--glass-rgb), 0.02)" }}
        >
          {/* Metadata */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-stone/50">
              {conv.profileLabel && (
                <span className="px-2 py-0.5 rounded-full border border-gold/15 text-gold-dim">
                  {conv.profileLabel}
                </span>
              )}
              <span>{new Date(conv.savedAt).toLocaleDateString("zh-TW")}</span>
            </div>
            <button
              onClick={() => handleDelete(conv.id)}
              className="text-xs text-stone/40 hover:text-red-seal transition-colors min-h-[32px] px-2"
            >
              刪除
            </button>
          </div>

          {/* User question as blockquote */}
          <div className="mb-3 pl-3 border-l-2 border-gold/20">
            <p className="text-sm text-stone/70 leading-relaxed whitespace-pre-wrap">
              {conv.userQuestion}
            </p>
          </div>

          {/* AI response */}
          <ResultDisplay
            content={conv.aiResponse}
            reasoning={conv.aiReasoning || ""}
            streaming={false}
            hideDisclaimer
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/SavedConversations.tsx
git commit -m "feat: add SavedConversations component"
```

---

### Task 7: ProfileModal — Multi-Profile Manager

**Files:**
- Modify: `app/components/ProfileModal.tsx`

- [ ] **Step 1: Rewrite `app/components/ProfileModal.tsx`**

Replace the entire file with a multi-profile manager:

```tsx
"use client";

import { useState, useEffect } from "react";
import ConfirmDialog from "./ConfirmDialog";

interface Profile {
  id: string;
  label: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
  calendarType: string;
  isLeapMonth: boolean;
}

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: ProfileModalProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [label, setLabel] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [gender, setGender] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [calendarType, setCalendarType] = useState("solar");
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setLabel("");
    setBirthDate("");
    setBirthTime("");
    setGender("");
    setBirthPlace("");
    setCalendarType("solar");
    setIsLeapMonth(false);
    setEditingId(null);
    setIsAdding(false);
  };

  const loadProfiles = () => {
    setLoading(true);
    fetch("/api/profiles")
      .then((res) => res.json())
      .then((data) => setProfiles(data.profiles || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) {
      loadProfiles();
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const startEdit = (p: Profile) => {
    setEditingId(p.id);
    setIsAdding(false);
    setLabel(p.label);
    setBirthDate(p.birthDate);
    setBirthTime(p.birthTime);
    setGender(p.gender);
    setBirthPlace(p.birthPlace);
    setCalendarType(p.calendarType || "solar");
    setIsLeapMonth(p.isLeapMonth || false);
  };

  const startAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      const body = { label: label.trim(), birthDate, birthTime, gender, birthPlace, calendarType, isLeapMonth };
      if (editingId) {
        await fetch(`/api/profiles/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      window.dispatchEvent(new Event("profiles-updated"));
      loadProfiles();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    window.dispatchEvent(new Event("profiles-updated"));
    loadProfiles();
    setDeleteConfirm(null);
    if (editingId === id) resetForm();
  };

  if (!open) return null;

  const showForm = isAdding || editingId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-md max-h-[85dvh] flex flex-col rounded-lg border border-gold/20 animate-fade-in-up"
        style={{ background: "var(--parchment)", animationDuration: "0.3s" }}
      >
        <div className="p-6 pb-3 shrink-0">
          <h2 className="font-serif text-lg text-gold tracking-wide mb-1">
            管理出生資料檔案
          </h2>
          <p className="text-xs text-stone/60">
            已保存 {profiles.length}/10 筆
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="inline-block w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            </div>
          ) : showForm ? (
            /* Edit / Add form */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label>名稱 *</label>
                <input
                  type="text"
                  placeholder="例：本人、母親、另一半"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label>出生日期</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label>出生時間</label>
                <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label>性別</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">不提供</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label>出生地點</label>
                <input type="text" placeholder="例：台北" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label>曆法</label>
                <select value={calendarType} onChange={(e) => { setCalendarType(e.target.value); setIsLeapMonth(false); }}>
                  <option value="solar">國曆（陽曆）</option>
                  <option value="lunar">農曆（陰曆）</option>
                </select>
                {calendarType === "lunar" && (
                  <label className="flex items-center gap-2 mt-1.5 text-xs text-stone/70 cursor-pointer">
                    <input type="checkbox" checked={isLeapMonth} onChange={(e) => setIsLeapMonth(e.target.checked)} className="accent-gold" />
                    該月為閏月
                  </label>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={resetForm}
                  className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-stone border border-gold/10 hover:bg-gold/5 transition-colors font-serif tracking-widest"
                >
                  返回
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !label.trim()}
                  className="flex-1 py-2.5 min-h-[44px] rounded-sm text-sm text-gold border border-gold/20 bg-gold/10 hover:bg-gold/20 transition-colors font-serif tracking-widest disabled:opacity-50"
                >
                  {saving ? "儲存中..." : "儲存"}
                </button>
              </div>
            </div>
          ) : (
            /* Profile list */
            <div className="space-y-2">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded border border-gold/10"
                  style={{ background: "rgba(var(--glass-rgb), 0.02)" }}
                >
                  <div>
                    <span className="text-sm text-cream font-serif">{p.label}</span>
                    {p.birthDate && (
                      <span className="text-xs text-stone/50 ml-2">{p.birthDate}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(p)}
                      className="text-xs text-gold-dim hover:text-gold transition-colors px-2 py-1 min-h-[32px]"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(p.id)}
                      className="text-xs text-stone/40 hover:text-red-seal transition-colors px-2 py-1 min-h-[32px]"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}

              {profiles.length < 10 && (
                <button
                  onClick={startAdd}
                  className="w-full py-2.5 min-h-[44px] rounded-sm text-sm text-gold-dim border border-dashed border-gold/15 hover:border-gold/30 hover:text-gold transition-colors font-serif tracking-widest"
                >
                  + 新增檔案
                </button>
              )}

              <div className="pt-3">
                <button
                  onClick={onClose}
                  className="w-full py-2.5 min-h-[44px] rounded-sm text-sm text-stone border border-gold/10 hover:bg-gold/5 transition-colors font-serif tracking-widest"
                >
                  關閉
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="刪除檔案"
        message="確定要刪除這筆資料嗎？已保存的命盤數據也會一併刪除。"
        confirmLabel="刪除"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update UserMenu label**

In `app/components/UserMenu.tsx`, change the menu item text from `管理個人基本資訊` to `管理出生資料檔案` (line 81).

- [ ] **Step 3: Commit**

```bash
git add app/components/ProfileModal.tsx app/components/UserMenu.tsx
git commit -m "feat: rewrite ProfileModal as multi-profile manager"
```

---

### Task 8: InputForm — Profile Selector and Save Profile

**Files:**
- Modify: `app/components/InputForm.tsx`

- [ ] **Step 1: Update InputForm props and add profile state**

Add `profiles` and `onProfilesChange` to the props interface. Add profile-related state and remove old auto-fill logic.

Replace the props interface and early state section (lines 3-83):

```tsx
"use client";

import { useState, useEffect, useRef } from "react";

interface Profile {
  id: string;
  label: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
  calendarType: string;
  isLeapMonth: boolean;
  savedCharts?: {
    bazi?: string;
    ziwei?: string;
    zodiac?: string;
  };
}

interface InputFormProps {
  type: "bazi" | "ziwei" | "zodiac";
  onSubmit: (message: string, images?: string[], profileId?: string, profileLabel?: string) => void;
  loading: boolean;
  profiles: Profile[];
  onProfilesChange: () => void;
}
```

- [ ] **Step 2: Add profile selector and save profile logic inside the component**

Replace the auto-fill `useEffect` (lines 104-123) with profile selector state and handlers:

```tsx
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [saveLabel, setSaveLabel] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [showSavedChart, setShowSavedChart] = useState(false);

  // Fill form when profile is selected
  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
    if (!profileId) {
      // "手動輸入" — clear form
      setBirthDate("");
      setBirthTime("");
      setGender("");
      setBirthPlace("");
      setCalendarType("solar");
      setIsLeapMonth(false);
      setSaveLabel("");
      return;
    }
    const p = profiles.find((pr) => pr.id === profileId);
    if (p) {
      setBirthDate(p.birthDate);
      setBirthTime(p.birthTime);
      setGender(p.gender);
      setBirthPlace(p.birthPlace);
      setCalendarType(p.calendarType || "solar");
      setIsLeapMonth(p.isLeapMonth || false);
      setSaveLabel(p.label);
    }
  };

  const handleSaveProfile = async () => {
    if (!saveLabel.trim()) return;
    setSavingProfile(true);
    try {
      const body = {
        label: saveLabel.trim(),
        birthDate,
        birthTime,
        gender,
        birthPlace,
        calendarType,
        isLeapMonth,
      };
      if (selectedProfileId) {
        await fetch(`/api/profiles/${selectedProfileId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.profile) setSelectedProfileId(data.profile.id);
      }
      onProfilesChange();
      window.dispatchEvent(new Event("profiles-updated"));
    } finally {
      setSavingProfile(false);
    }
  };

  // Remove the old auto-fill useEffect entirely
```

- [ ] **Step 3: Update handleSubmit to pass profileId and profileLabel**

Replace the `handleSubmit` function:

```tsx
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!birthDate || !birthTime || !birthPlace) return;
    if (type === "ziwei" && !gender) return;
    const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
    onSubmit(
      buildMessage(),
      images.length > 0 ? images : undefined,
      selectedProfileId || undefined,
      selectedProfile?.label
    );
    setImages([]);
  };
```

- [ ] **Step 4: Add profile selector dropdown at the top of the form JSX**

After `<div className="gold-line mb-6" />`, before the grid:

```tsx
      {/* Profile Selector */}
      <div className="space-y-1.5">
        <label>選擇檔案</label>
        <select value={selectedProfileId} onChange={(e) => handleProfileSelect(e.target.value)}>
          <option value="">手動輸入</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Saved Chart Button */}
      {selectedProfileId && (() => {
        const sp = profiles.find((p) => p.id === selectedProfileId);
        const chartKey = type as keyof NonNullable<Profile["savedCharts"]>;
        const savedChart = sp?.savedCharts?.[chartKey];
        if (!savedChart) return null;
        return (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowSavedChart(!showSavedChart)}
              className="text-sm text-gold-dim hover:text-gold transition-colors flex items-center gap-1.5"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${showSavedChart ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              查看已保存的命盤
            </button>
            {showSavedChart && (
              <div className="text-xs text-stone/70 leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-gold/15 max-h-48 overflow-y-auto">
                {savedChart}
              </div>
            )}
          </div>
        );
      })()}
```

- [ ] **Step 5: Add save profile section before the submit button**

Before the submit `<button>`:

```tsx
      {/* Save Profile */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="輸入名稱以保存此檔案"
          value={saveLabel}
          onChange={(e) => setSaveLabel(e.target.value)}
          className="flex-1"
        />
        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={savingProfile || !saveLabel.trim() || (!selectedProfileId && profiles.length >= 10)}
          className="shrink-0 px-4 py-2.5 min-h-[44px] rounded-sm text-sm text-gold-dim border border-gold/15 hover:bg-gold/10 transition-colors font-serif tracking-widest disabled:opacity-40"
        >
          {savingProfile ? "..." : selectedProfileId ? "更新" : "保存"}
        </button>
      </div>
      {!selectedProfileId && profiles.length >= 10 && (
        <p className="text-xs text-stone/50">已達上限 10 筆，請先刪除舊檔案</p>
      )}
      <p className="text-xs text-stone/40">
        已保存 {profiles.length}/10 筆
      </p>
```

- [ ] **Step 6: Commit**

```bash
git add app/components/InputForm.tsx
git commit -m "feat: add profile selector and save profile to InputForm"
```

---

### Task 9: ResultDisplay — Save Conversation Button

**Files:**
- Modify: `app/components/ResultDisplay.tsx`

- [ ] **Step 1: Add save button props and state**

Update the `ResultDisplayProps` interface and add save state:

```tsx
interface ResultDisplayProps {
  content: string;
  reasoning: string;
  streaming: boolean;
  hideDisclaimer?: boolean;
  onSave?: () => void;
  isSaved?: boolean;
}
```

Update the function signature to destructure the new props:

```tsx
export default function ResultDisplay({
  content,
  reasoning,
  streaming,
  hideDisclaimer,
  onSave,
  isSaved,
}: ResultDisplayProps) {
```

- [ ] **Step 2: Add save button to the result display**

After the closing `</div>` of the main content area (the `<div className="px-6 py-8">` wrapper), before the disclaimer, add:

```tsx
      {/* Save conversation button */}
      {content && !streaming && onSave && (
        <div className="flex justify-end px-6 pb-2">
          <button
            onClick={onSave}
            disabled={isSaved}
            className={`text-xs flex items-center gap-1 min-h-[32px] px-2 transition-colors ${
              isSaved
                ? "text-gold-dim/50 cursor-default"
                : "text-stone/40 hover:text-gold-dim"
            }`}
          >
            {isSaved ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                已保存
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                保存
              </>
            )}
          </button>
        </div>
      )}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/ResultDisplay.tsx
git commit -m "feat: add save conversation button to ResultDisplay"
```

---

### Task 10: Main Page — Wire Everything Together

**Files:**
- Modify: `app/(protected)/page.tsx`

This is the largest task. It wires up:
1. Profile loading and passing to InputForm
2. Tab view (輸入資料 / 已保存對話) before conversation starts
3. New discussion button at the bottom of conversation view
4. Save conversation flow on each AI response
5. Chart data capture from SSE stream
6. Chart saving flow

- [ ] **Step 1: Add imports**

Add at the top of `app/(protected)/page.tsx`:

```tsx
import SavedConversations from "@/app/components/SavedConversations";
import ConfirmDialog from "@/app/components/ConfirmDialog";
```

- [ ] **Step 2: Add profile and tab state to the Home component**

After `const [followUpImages, setFollowUpImages] = useState<string[]>([]);` (around line 95), add:

```tsx
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeTab, setActiveTab] = useState<"input" | "saved">("input");
  const [newDiscussionConfirm, setNewDiscussionConfirm] = useState(false);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<number>>(new Set());
```

Add the Profile type near the other type definitions at the top:

```tsx
type Profile = {
  id: string;
  label: string;
  birthDate: string;
  birthTime: string;
  gender: string;
  birthPlace: string;
  calendarType: string;
  isLeapMonth: boolean;
  savedCharts?: {
    bazi?: string;
    ziwei?: string;
    zodiac?: string;
  };
};
```

- [ ] **Step 3: Add profile loading**

Add after the state declarations:

```tsx
  const loadProfiles = useCallback(() => {
    fetch("/api/profiles")
      .then((res) => res.json())
      .then((data) => setProfiles(data.profiles || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadProfiles();
    window.addEventListener("profiles-updated", loadProfiles);
    return () => window.removeEventListener("profiles-updated", loadProfiles);
  }, [loadProfiles]);
```

- [ ] **Step 4: Add conversation state fields for chart and profile tracking**

Update the `ConversationState` type to include chart data and profile info:

```tsx
type ConversationState = {
  messages: Message[];
  streamingContent: string;
  streamingReasoning: string;
  streaming: boolean;
  loading: boolean;
  ziweiBirthInfo?: ZiweiBirthInfo;
  chartData?: string;       // raw chart text from program calculation
  profileId?: string;       // which profile was used
  profileLabel?: string;    // profile label for saved conversations
};
```

Update `emptyConversation` accordingly (no new fields needed — they're optional).

- [ ] **Step 5: Capture chart data from SSE stream**

In the `streamResponse` function, inside the SSE parsing loop (around line 213-224), add handling for the `chartData` event:

```tsx
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
              }
              if (parsed.reasoning) {
                fullReasoning += parsed.reasoning;
              }
              if (parsed.chartData) {
                // Store chart data for saving later
                conversationsRef.current[type] = {
                  ...conversationsRef.current[type],
                  chartData: parsed.chartData,
                };
              }
            } catch {
              // skip
            }
```

- [ ] **Step 6: Update handleInitialSubmit to accept profile info**

Update the `handleInitialSubmit` callback to accept profileId and profileLabel:

```tsx
  const handleInitialSubmit = useCallback(
    async (userMessage: string, images?: string[], profileId?: string, profileLabel?: string) => {
      if (!selectedType) return;
      isNearBottomRef.current = true;
      const type = selectedType;
      const userMsg: Message = { role: "user", content: userMessage, images };

      // ... existing ziwei birth info parsing ...

      // Set messages for this type
      conversationsRef.current[type] = {
        ...conversationsRef.current[type],
        messages: [userMsg],
        ziweiBirthInfo,
        profileId,
        profileLabel,
        chartData: undefined,
      };
      setConv((prev) => ({
        ...prev,
        messages: [userMsg],
        ziweiBirthInfo,
        profileId,
        profileLabel,
        chartData: undefined,
      }));

      await streamResponse(type, [
        { role: "user", content: userMessage, images },
      ]);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [selectedType, streamResponse]
  );
```

- [ ] **Step 7: Add save conversation handler**

Add a handler function:

```tsx
  const handleSaveConversation = useCallback(
    async (messageIndex: number) => {
      if (!selectedType) return;
      const messages = conversationsRef.current[selectedType].messages;
      const aiMsg = messages[messageIndex];
      if (!aiMsg || aiMsg.role !== "assistant") return;

      // Find the preceding user message
      let userQuestion = "";
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          userQuestion = messages[i].content;
          break;
        }
      }

      const profileLabel = conversationsRef.current[selectedType].profileLabel;

      await fetch("/api/saved-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          userQuestion,
          aiResponse: aiMsg.content,
          aiReasoning: aiMsg.reasoning,
          profileLabel,
        }),
      });

      setSavedMessageIds((prev) => new Set(prev).add(messageIndex));
      window.dispatchEvent(new Event("conversation-saved"));
    },
    [selectedType]
  );
```

- [ ] **Step 8: Add new discussion handler**

```tsx
  const handleNewDiscussion = useCallback(() => {
    if (!selectedType) return;
    conversationsRef.current[selectedType] = { ...emptyConversation };
    setConv({ ...emptyConversation });
    setSavedMessageIds(new Set());
    setNewDiscussionConfirm(false);
    setActiveTab("input");
  }, [selectedType]);
```

- [ ] **Step 9: Reset savedMessageIds when switching scenes**

In the existing `useEffect` that syncs conversation state on type change (around line 116), add:

```tsx
  useEffect(() => {
    if (selectedType) {
      setConv({ ...conversationsRef.current[selectedType] });
      setFollowUp("");
      setFollowUpImages([]);
      setSavedMessageIds(new Set());
      setActiveTab("input");
    }
  }, [selectedType]);
```

- [ ] **Step 10: Add tabs to the pre-conversation scene view**

In the "Initial selection mode" section, replace the `InputForm` section (around line 816-824) with a tabbed view:

```tsx
      {selectedType && !conversationStarted && (
        <section className="max-w-2xl mx-auto px-6 pb-8">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-gold/10">
            <button
              onClick={() => setActiveTab("input")}
              className={`px-4 py-2.5 text-sm font-serif tracking-wide transition-colors border-b-2 -mb-px ${
                activeTab === "input"
                  ? "border-gold text-gold"
                  : "border-transparent text-stone/50 hover:text-stone"
              }`}
            >
              輸入資料
            </button>
            <button
              onClick={() => setActiveTab("saved")}
              className={`px-4 py-2.5 text-sm font-serif tracking-wide transition-colors border-b-2 -mb-px ${
                activeTab === "saved"
                  ? "border-gold text-gold"
                  : "border-transparent text-stone/50 hover:text-stone"
              }`}
            >
              已保存對話
            </button>
          </div>

          {activeTab === "input" ? (
            <InputForm
              type={selectedType}
              onSubmit={handleInitialSubmit}
              loading={conv.loading}
              profiles={profiles}
              onProfilesChange={loadProfiles}
            />
          ) : (
            <SavedConversations type={selectedType} />
          )}
        </section>
      )}
```

- [ ] **Step 11: Pass onSave and isSaved to ResultDisplay in conversation mode**

In the conversation message rendering loop (around line 522-550), update the assistant message rendering:

```tsx
              ) : (
                <div key={i}>
                  <ResultDisplay
                    content={msg.content}
                    reasoning={msg.reasoning || ""}
                    streaming={false}
                    hideDisclaimer
                    onSave={() => handleSaveConversation(i)}
                    isSaved={savedMessageIds.has(i)}
                  />
                </div>
              )
```

Also update the streaming ResultDisplay (around line 554-560) — no save button while streaming:

```tsx
            {conv.streaming && (
              <div>
                <ResultDisplay
                  content={conv.streamingContent}
                  reasoning={conv.streamingReasoning}
                  streaming
                  hideDisclaimer
                />
              </div>
            )}
```

- [ ] **Step 12: Add new discussion button and confirm dialog at the bottom of conversation view**

After the follow-up form's disclaimer `<p>` (around line 670), add:

```tsx
            <button
              onClick={() => setNewDiscussionConfirm(true)}
              className="w-full mt-3 py-2 text-xs text-stone/40 hover:text-stone/60 transition-colors tracking-wide"
            >
              開始新討論
            </button>
```

At the very end of the conversation mode return, before closing `</main>`, add:

```tsx
        <ConfirmDialog
          open={newDiscussionConfirm}
          title="開始新討論"
          message="目前的對話將會清除，確定要開始新討論嗎？"
          confirmLabel="確定"
          onConfirm={handleNewDiscussion}
          onCancel={() => setNewDiscussionConfirm(false)}
        />
```

- [ ] **Step 13: Commit**

```bash
git add app/(protected)/page.tsx
git commit -m "feat: wire up tabs, profile selector, save conversations, new discussion"
```

---

### Task 11: Chart Saving Flow

**Files:**
- Modify: `app/(protected)/page.tsx`

- [ ] **Step 1: Add chart save handler**

Add a handler to save chart data to a profile:

```tsx
  const handleSaveChart = useCallback(
    async () => {
      if (!selectedType) return;
      const { chartData, profileId } = conversationsRef.current[selectedType];
      if (!chartData || !profileId) return;

      const chartKey = selectedType; // "bazi" | "ziwei" | "zodiac"
      await fetch(`/api/profiles/${profileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          savedCharts: {
            ...profiles.find((p) => p.id === profileId)?.savedCharts,
            [chartKey]: chartData,
          },
        }),
      });
      loadProfiles();
    },
    [selectedType, profiles, loadProfiles]
  );
```

- [ ] **Step 2: Add save chart button in conversation view**

After the streaming section in conversation mode, when conversation has chart data and a profile selected, show a save chart button:

```tsx
            {/* Save chart prompt */}
            {!conv.streaming && conv.chartData && conv.profileId && (
              <div className="flex justify-center py-2">
                <button
                  onClick={handleSaveChart}
                  className="text-xs text-gold-dim/60 hover:text-gold-dim transition-colors flex items-center gap-1.5 px-3 py-1.5 border border-gold/10 rounded-full"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  保存命盤至「{conv.profileLabel}」
                </button>
              </div>
            )}
```

- [ ] **Step 3: Commit**

```bash
git add app/(protected)/page.tsx
git commit -m "feat: add chart saving flow to profile"
```

---

### Task 12: Final Cleanup and Verification

**Files:**
- Verify all modified files

- [ ] **Step 1: Run ESLint**

```bash
npx eslint app/ --ext .ts,.tsx
```

Expected: no new errors (existing warnings are OK).

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Manual smoke test checklist**

Run `npm run dev` and verify:
1. Profile modal shows multi-profile list (manage from user menu)
2. Can create, edit, delete profiles (max 10)
3. Legacy profile auto-migrated to profiles array
4. Scene view shows tabs (輸入資料 / 已保存對話)
5. Profile selector dropdown in input form fills fields
6. Can save profile from input form
7. Saved chart view works when profile has chart data
8. AI response has "保存" button — clicking saves and shows "已保存"
9. Saved conversations tab shows bookmarked responses with user question blockquote
10. "開始新討論" button at bottom of conversation clears after confirmation
11. Different users cannot see each other's data (test with two accounts)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup for multi-profile and saved conversations"
```
