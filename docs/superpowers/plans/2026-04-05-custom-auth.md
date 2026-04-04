# Custom Account Registration + Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add credentials-based registration, login, and password reset alongside existing Google OAuth.

**Architecture:** Extend users table with username/password fields. Add NextAuth Credentials provider. New register/forgot-password/reset-password pages and API routes. Resend API for password reset emails (graceful fallback to console.log if no API key).

**Tech Stack:** NextAuth v5 Credentials provider, bcryptjs, Resend, Drizzle ORM (Neon Postgres)

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install bcryptjs and resend**

```bash
npm install bcryptjs resend
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add bcryptjs and resend dependencies

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add auth columns to users table

**Files:**
- Modify: `app/lib/db/schema.ts`

- [ ] **Step 1: Add new columns to the users table**

In `app/lib/db/schema.ts`, add 5 new columns to the `users` table definition, after the existing `approvedAt` column:

```typescript
  username: varchar("username", { length: 50 }).unique(),
  passwordHash: text("password_hash"),
  authProvider: varchar("auth_provider", { length: 20 }).notNull().default("google"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry", { withTimezone: true }),
```

- [ ] **Step 2: Push schema to database**

```bash
export $(grep -E '^POSTGRES_' .env.local | xargs) && export POSTGRES_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}/${POSTGRES_DATABASE}?sslmode=require" && npx drizzle-kit push
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/lib/db/schema.ts
git commit -m "feat: add username, passwordHash, authProvider, resetToken columns to users table

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Create email helper module

**Files:**
- Create: `app/lib/email.ts`

- [ ] **Step 1: Create the email module**

Create `app/lib/email.ts`:

```typescript
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL || "noreply@fortune-for.me";
const SITE_URL = process.env.NEXTAUTH_URL || "https://fortune-for.me";

export async function sendResetPasswordEmail(
  to: string,
  token: string
): Promise<void> {
  const resetUrl = `${SITE_URL}/reset-password?token=${token}`;
  const subject = "Fortune-For.me — 重設密碼 / Reset Password";
  const html = `
    <div style="font-family: serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #1e1a14;">
      <h2 style="color: #7a5c10; text-align: center;">天機 Fortune-For.me</h2>
      <p>您收到此信是因為您（或他人）請求重設您的密碼。</p>
      <p>You received this email because a password reset was requested for your account.</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: #7a5c10; color: #fff; text-decoration: none; border-radius: 4px; font-size: 14px;">
          重設密碼 / Reset Password
        </a>
      </p>
      <p style="font-size: 12px; color: #847b72;">此連結將在 1 小時後失效。This link expires in 1 hour.</p>
      <p style="font-size: 12px; color: #847b72;">如果您未請求重設密碼，請忽略此信。If you did not request this, please ignore this email.</p>
    </div>
  `;

  if (!resend) {
    console.log("[email] Resend not configured. Reset URL:", resetUrl);
    return;
  }

  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    console.log("[email] Reset password email sent to:", to);
  } catch (e) {
    console.error("[email] Failed to send reset email:", e);
  }
}

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const verifyUrl = `${SITE_URL}/api/auth/verify-email?token=${token}`;
  const subject = "Fortune-For.me — 信箱驗證 / Email Verification";
  const html = `
    <div style="font-family: serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #1e1a14;">
      <h2 style="color: #7a5c10; text-align: center;">天機 Fortune-For.me</h2>
      <p>感謝您的註冊！請點擊下方按鈕驗證您的信箱。</p>
      <p>Thank you for registering! Please click the button below to verify your email.</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background: #7a5c10; color: #fff; text-decoration: none; border-radius: 4px; font-size: 14px;">
          驗證信箱 / Verify Email
        </a>
      </p>
      <p style="font-size: 12px; color: #847b72;">此連結將在 1 小時後失效。This link expires in 1 hour.</p>
    </div>
  `;

  if (!resend) {
    console.log("[email] Resend not configured. Verify URL:", verifyUrl);
    return;
  }

  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    console.log("[email] Verification email sent to:", to);
  } catch (e) {
    console.error("[email] Failed to send verification email:", e);
  }
}

export async function sendAdminNotification(
  userEmail: string,
  userName: string | null
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || "geektu@gmail.com";
  const subject = "Fortune-For.me — 新使用者待審核 / New User Pending Approval";
  const html = `
    <div style="font-family: serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #1e1a14;">
      <h2 style="color: #7a5c10; text-align: center;">天機 Fortune-For.me</h2>
      <p>有新使用者註冊並通過信箱驗證，等待您的審核：</p>
      <p>A new user has registered and verified their email, pending your approval:</p>
      <ul>
        <li><strong>Email:</strong> ${userEmail}</li>
        ${userName ? `<li><strong>Name:</strong> ${userName}</li>` : ""}
      </ul>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${SITE_URL}/admin" style="display: inline-block; padding: 12px 32px; background: #7a5c10; color: #fff; text-decoration: none; border-radius: 4px; font-size: 14px;">
          前往後台審核 / Go to Admin Panel
        </a>
      </p>
    </div>
  `;

  if (!resend) {
    console.log("[email] Resend not configured. Admin notification for:", userEmail);
    return;
  }

  try {
    await resend.emails.send({ from: FROM, to: adminEmail, subject, html });
    console.log("[email] Admin notification sent for:", userEmail);
  } catch (e) {
    console.error("[email] Failed to send admin notification:", e);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/lib/email.ts
git commit -m "feat: add email helper module with Resend API (reset, verify, admin notify)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Add registration and password functions to users.ts

**Files:**
- Modify: `app/lib/users.ts`

- [ ] **Step 1: Add imports and new functions**

At the top of `app/lib/users.ts`, add the bcryptjs import:

```typescript
import bcrypt from "bcryptjs";
```

Update the `UserStatus` type to include `unverified`:

```typescript
export type UserStatus = "unverified" | "pending" | "approved" | "disabled";
```

Add these functions before the `// ─── Profiles ───` section:

```typescript
// ─── Credentials Auth ───────────────────────────────────

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return row.length === 0;
}

export async function checkEmailAvailable(email: string): Promise<boolean> {
  const row = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row.length === 0;
}

export async function registerCredentialsUser(params: {
  username: string;
  email: string;
  password: string;
  name?: string;
}): Promise<void> {
  const passwordHash = await bcrypt.hash(params.password, 10);
  await db.insert(users).values({
    email: params.email,
    name: params.name || params.username,
    username: params.username,
    passwordHash,
    authProvider: "credentials",
    status: "pending",
    createdAt: new Date(),
  });
}

export async function verifyCredentials(
  username: string,
  password: string
): Promise<{ id: number; email: string; name: string | null; image: string | null; status: string } | null> {
  const row = await db
    .select()
    .from(users)
    .where(and(eq(users.username, username), eq(users.authProvider, "credentials")))
    .limit(1);
  if (!row[0]) return null;

  const valid = await bcrypt.compare(password, row[0].passwordHash || "");
  if (!valid) return null;

  return {
    id: row[0].id,
    email: row[0].email,
    name: row[0].name,
    image: row[0].image,
    status: row[0].status,
  };
}

export async function setResetToken(email: string, token: string): Promise<boolean> {
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const result = await db
    .update(users)
    .set({ resetToken: token, resetTokenExpiry: expiry })
    .where(and(eq(users.email, email), eq(users.authProvider, "credentials")));
  return (result.rowCount ?? 0) > 0;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const row = await db
    .select()
    .from(users)
    .where(eq(users.resetToken, token))
    .limit(1);

  if (!row[0]) return false;
  if (!row[0].resetTokenExpiry || row[0].resetTokenExpiry < new Date()) return false;

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(users)
    .set({ passwordHash, resetToken: null, resetTokenExpiry: null })
    .where(eq(users.id, row[0].id));

  return true;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/lib/users.ts
git commit -m "feat: add credentials registration, login verification, and password reset functions

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Add Credentials provider to NextAuth

**Files:**
- Modify: `app/lib/auth.ts`

- [ ] **Step 1: Add Credentials provider**

Replace the entire `app/lib/auth.ts` with:

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { registerUser, verifyCredentials } from "./users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string;
        const password = credentials?.password as string;
        if (!username || !password) return null;

        const user = await verifyCredentials(username, password);
        if (!user) return null;

        // Only allow approved users to sign in
        if (user.status !== "approved") return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      // Only auto-register for Google OAuth (credentials users register via /api/auth/register)
      if (account?.provider === "google") {
        try {
          await registerUser(user.email, user.name ?? null, user.image ?? null);
          console.log("[auth] User registered on signIn:", user.email);
        } catch (e) {
          console.error("[auth] Failed to register user on signIn:", user.email, e);
        }
      }
      return true;
    },
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/lib/auth.ts
git commit -m "feat: add Credentials provider to NextAuth alongside Google OAuth

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Create registration API

**Files:**
- Create: `app/api/auth/register/route.ts`
- Create: `app/api/auth/check-username/route.ts`

- [ ] **Step 1: Create the register API**

Create `app/api/auth/register/route.ts`:

```typescript
import { NextRequest } from "next/server";
import {
  checkUsernameAvailable,
  checkEmailAvailable,
  registerCredentialsUser,
} from "@/app/lib/users";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(request: NextRequest) {
  const { username, email, password } = (await request.json()) as {
    username: string;
    email: string;
    password: string;
  };

  // Validate username format
  if (!username || !USERNAME_REGEX.test(username)) {
    return Response.json(
      { error: "username_invalid", message: "Username must be 3-30 characters, alphanumeric and underscore only" },
      { status: 400 }
    );
  }

  // Validate email format
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { error: "email_invalid", message: "Invalid email format" },
      { status: 400 }
    );
  }

  // Validate password complexity
  if (!password || !PASSWORD_REGEX.test(password)) {
    return Response.json(
      { error: "password_weak", message: "Password must be at least 8 characters with uppercase, lowercase, and digit" },
      { status: 400 }
    );
  }

  // Check username availability
  if (!(await checkUsernameAvailable(username))) {
    return Response.json(
      { error: "username_taken", message: "Username is already taken" },
      { status: 409 }
    );
  }

  // Check email availability
  if (!(await checkEmailAvailable(email))) {
    return Response.json(
      { error: "email_taken", message: "Email is already registered" },
      { status: 409 }
    );
  }

  try {
    await registerCredentialsUser({ username, email, password });
    return Response.json({ success: true }, { status: 201 });
  } catch (e) {
    console.error("[register] Failed:", e);
    return Response.json(
      { error: "server_error", message: "Registration failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create the username check API**

Create `app/api/auth/check-username/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { checkUsernameAvailable } from "@/app/lib/users";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  if (!q || q.length < 3 || !/^[a-zA-Z0-9_]+$/.test(q)) {
    return Response.json({ available: false });
  }
  const available = await checkUsernameAvailable(q);
  return Response.json({ available });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/register/route.ts app/api/auth/check-username/route.ts
git commit -m "feat: add registration and username check API endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Create forgot/reset password APIs

**Files:**
- Create: `app/api/auth/forgot-password/route.ts`
- Create: `app/api/auth/reset-password/route.ts`

- [ ] **Step 1: Create forgot-password API**

Create `app/api/auth/forgot-password/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { setResetToken } from "@/app/lib/users";
import { sendResetPasswordEmail } from "@/app/lib/email";

export async function POST(request: NextRequest) {
  const { email } = (await request.json()) as { email: string };

  if (!email) {
    return Response.json({ error: "Email required" }, { status: 400 });
  }

  // Always return 200 to not reveal if email exists
  try {
    const token = randomUUID();
    const found = await setResetToken(email, token);
    if (found) {
      await sendResetPasswordEmail(email, token);
    }
  } catch (e) {
    console.error("[forgot-password] Error:", e);
  }

  return Response.json({ success: true });
}
```

- [ ] **Step 2: Create reset-password API**

Create `app/api/auth/reset-password/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { resetPassword } from "@/app/lib/users";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(request: NextRequest) {
  const { token, password } = (await request.json()) as {
    token: string;
    password: string;
  };

  if (!token) {
    return Response.json({ error: "token_missing" }, { status: 400 });
  }

  if (!password || !PASSWORD_REGEX.test(password)) {
    return Response.json({ error: "password_weak" }, { status: 400 });
  }

  const success = await resetPassword(token, password);
  if (!success) {
    return Response.json({ error: "token_invalid" }, { status: 400 });
  }

  return Response.json({ success: true });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/forgot-password/route.ts app/api/auth/reset-password/route.ts
git commit -m "feat: add forgot-password and reset-password API endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Add i18n keys for auth pages

**Files:**
- Modify: `app/lib/i18n.ts`

- [ ] **Step 1: Add translation keys to all 4 locales**

Add these keys to each locale in `app/lib/i18n.ts`, after the existing `login.*` keys:

**zh-Hant:**
```typescript
    "login.or": "或",
    "login.username": "帳號",
    "login.password": "密碼",
    "login.loginBtn": "登入",
    "login.forgotPassword": "忘記密碼？",
    "login.registerLink": "還沒有帳號？註冊",
    "login.loginError": "帳號或密碼錯誤，或帳號尚未通過審核",
    "register.title": "註冊帳號",
    "register.username": "帳號名稱",
    "register.usernamePlaceholder": "英文、數字、底線，3-30 字元",
    "register.usernameAvailable": "可以使用",
    "register.usernameTaken": "已被使用",
    "register.email": "電子信箱",
    "register.emailPlaceholder": "your@email.com",
    "register.password": "密碼",
    "register.passwordPlaceholder": "至少 8 字元，含大小寫及數字",
    "register.confirmPassword": "確認密碼",
    "register.confirmPasswordPlaceholder": "再輸入一次密碼",
    "register.passwordMismatch": "密碼不一致",
    "register.submit": "註冊",
    "register.success": "註冊成功！請等待管理員審核。",
    "register.backToLogin": "返回登入",
    "register.usernameTakenError": "帳號名稱已被使用",
    "register.emailTakenError": "此信箱已註冊",
    "register.passwordWeakError": "密碼需至少 8 字元，含大小寫字母及數字",
    "forgot.title": "忘記密碼",
    "forgot.email": "註冊時使用的電子信箱",
    "forgot.submit": "發送重設連結",
    "forgot.success": "若此信箱已註冊，重設連結已發送至您的信箱。",
    "forgot.backToLogin": "返回登入",
    "reset.title": "重設密碼",
    "reset.newPassword": "新密碼",
    "reset.confirmPassword": "確認新密碼",
    "reset.submit": "重設密碼",
    "reset.success": "密碼已重設成功！請使用新密碼登入。",
    "reset.invalidToken": "連結無效或已過期，請重新申請。",
    "reset.backToLogin": "返回登入",
```

**zh-Hans:**
```typescript
    "login.or": "或",
    "login.username": "账号",
    "login.password": "密码",
    "login.loginBtn": "登录",
    "login.forgotPassword": "忘记密码？",
    "login.registerLink": "还没有账号？注册",
    "login.loginError": "账号或密码错误，或账号尚未通过审核",
    "register.title": "注册账号",
    "register.username": "账号名称",
    "register.usernamePlaceholder": "英文、数字、下划线，3-30 字符",
    "register.usernameAvailable": "可以使用",
    "register.usernameTaken": "已被使用",
    "register.email": "电子邮箱",
    "register.emailPlaceholder": "your@email.com",
    "register.password": "密码",
    "register.passwordPlaceholder": "至少 8 字符，含大小写及数字",
    "register.confirmPassword": "确认密码",
    "register.confirmPasswordPlaceholder": "再输入一次密码",
    "register.passwordMismatch": "密码不一致",
    "register.submit": "注册",
    "register.success": "注册成功！请等待管理员审核。",
    "register.backToLogin": "返回登录",
    "register.usernameTakenError": "账号名称已被使用",
    "register.emailTakenError": "此邮箱已注册",
    "register.passwordWeakError": "密码需至少 8 字符，含大小写字母及数字",
    "forgot.title": "忘记密码",
    "forgot.email": "注册时使用的电子邮箱",
    "forgot.submit": "发送重设链接",
    "forgot.success": "若此邮箱已注册，重设链接已发送至您的邮箱。",
    "forgot.backToLogin": "返回登录",
    "reset.title": "重设密码",
    "reset.newPassword": "新密码",
    "reset.confirmPassword": "确认新密码",
    "reset.submit": "重设密码",
    "reset.success": "密码已重设成功！请使用新密码登录。",
    "reset.invalidToken": "链接无效或已过期，请重新申请。",
    "reset.backToLogin": "返回登录",
```

**en:**
```typescript
    "login.or": "or",
    "login.username": "Username",
    "login.password": "Password",
    "login.loginBtn": "Sign in",
    "login.forgotPassword": "Forgot password?",
    "login.registerLink": "Don't have an account? Register",
    "login.loginError": "Invalid credentials or account not yet approved",
    "register.title": "Create Account",
    "register.username": "Username",
    "register.usernamePlaceholder": "Letters, numbers, underscore, 3-30 chars",
    "register.usernameAvailable": "Available",
    "register.usernameTaken": "Taken",
    "register.email": "Email",
    "register.emailPlaceholder": "your@email.com",
    "register.password": "Password",
    "register.passwordPlaceholder": "Min 8 chars, uppercase, lowercase, digit",
    "register.confirmPassword": "Confirm password",
    "register.confirmPasswordPlaceholder": "Enter password again",
    "register.passwordMismatch": "Passwords do not match",
    "register.submit": "Register",
    "register.success": "Registration successful! Please wait for admin approval.",
    "register.backToLogin": "Back to login",
    "register.usernameTakenError": "Username is already taken",
    "register.emailTakenError": "Email is already registered",
    "register.passwordWeakError": "Password must be at least 8 characters with uppercase, lowercase, and digit",
    "forgot.title": "Forgot Password",
    "forgot.email": "Email used during registration",
    "forgot.submit": "Send reset link",
    "forgot.success": "If this email is registered, a reset link has been sent.",
    "forgot.backToLogin": "Back to login",
    "reset.title": "Reset Password",
    "reset.newPassword": "New password",
    "reset.confirmPassword": "Confirm new password",
    "reset.submit": "Reset password",
    "reset.success": "Password reset successfully! Please sign in with your new password.",
    "reset.invalidToken": "Invalid or expired link. Please request a new one.",
    "reset.backToLogin": "Back to login",
```

**ja:**
```typescript
    "login.or": "または",
    "login.username": "ユーザー名",
    "login.password": "パスワード",
    "login.loginBtn": "ログイン",
    "login.forgotPassword": "パスワードをお忘れですか？",
    "login.registerLink": "アカウントをお持ちでない方は登録",
    "login.loginError": "ユーザー名またはパスワードが間違っているか、アカウントがまだ承認されていません",
    "register.title": "アカウント登録",
    "register.username": "ユーザー名",
    "register.usernamePlaceholder": "英数字とアンダースコア、3-30文字",
    "register.usernameAvailable": "使用可能",
    "register.usernameTaken": "使用済み",
    "register.email": "メールアドレス",
    "register.emailPlaceholder": "your@email.com",
    "register.password": "パスワード",
    "register.passwordPlaceholder": "8文字以上、大小文字と数字を含む",
    "register.confirmPassword": "パスワード確認",
    "register.confirmPasswordPlaceholder": "もう一度入力してください",
    "register.passwordMismatch": "パスワードが一致しません",
    "register.submit": "登録",
    "register.success": "登録完了！管理者の承認をお待ちください。",
    "register.backToLogin": "ログインに戻る",
    "register.usernameTakenError": "このユーザー名は既に使用されています",
    "register.emailTakenError": "このメールアドレスは既に登録されています",
    "register.passwordWeakError": "パスワードは8文字以上で、大文字・小文字・数字を含む必要があります",
    "forgot.title": "パスワードをお忘れの方",
    "forgot.email": "登録時のメールアドレス",
    "forgot.submit": "リセットリンクを送信",
    "forgot.success": "このメールアドレスが登録されている場合、リセットリンクを送信しました。",
    "forgot.backToLogin": "ログインに戻る",
    "reset.title": "パスワードリセット",
    "reset.newPassword": "新しいパスワード",
    "reset.confirmPassword": "新しいパスワード（確認）",
    "reset.submit": "パスワードをリセット",
    "reset.success": "パスワードがリセットされました！新しいパスワードでログインしてください。",
    "reset.invalidToken": "リンクが無効または期限切れです。再度お申し込みください。",
    "reset.backToLogin": "ログインに戻る",
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/i18n.ts
git commit -m "feat: add i18n keys for registration, login, forgot/reset password

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Update login page with credentials form

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Add credentials login form to login page**

Replace the entire `app/login/page.tsx` content. The key changes from the current version:
- Add username + password form fields
- Add divider "or" between Google and credentials
- Add "Forgot password?" and "Register" links
- Use `signIn("credentials", ...)` for form submission
- Add error state for failed login

```typescript
"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import SmokeParticles from "@/app/components/SmokeParticles";
import ThemeToggle from "@/app/components/ThemeToggle";
import { useLocale } from "@/app/components/LocaleProvider";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";

function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Line|FBAN|FBAV|Instagram|MicroMessenger|Twitter|Threads/i.test(ua);
}

export default function LoginPage() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [inApp, setInApp] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setInApp(isInAppBrowser());
    setCurrentUrl(window.location.href);
    if (searchParams.get("error")) setError(true);
  }, [searchParams]);

  const handleOpenExternal = () => {
    const ua = navigator.userAgent || "";
    if (/Line/i.test(ua)) {
      window.location.href = `https://line.me/R/browse?url=${encodeURIComponent(currentUrl)}`;
    } else {
      window.open(currentUrl, "_system");
    }
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(false);
    const result = await signIn("credentials", {
      username: username.trim(),
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(true);
    } else {
      window.location.href = "/";
    }
  };

  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
      <SmokeParticles />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="text-center space-y-6 animate-fade-in-up" style={{ opacity: 0 }}>
        {/* Logo */}
        <h1 className="text-5xl sm:text-6xl font-bold tracking-[0.15em] text-gold" style={{ fontFamily: "var(--font-calligraphy)" }}>
          {t("app.title")}
        </h1>
        <p className="font-display text-lg text-stone italic tracking-wide">
          {t("app.subtitle")}
        </p>

        <div className="mx-auto w-32 gold-line" />

        {inApp ? (
          <div className="mx-auto max-w-xs space-y-4 text-sm text-mist/80">
            <p className="text-gold font-semibold">{t("login.openExternal")}</p>
            <p>{t("login.inAppWarning")}</p>
            <p className="text-mist/60 text-xs leading-relaxed">{t("login.openExternalHint")}</p>
            <button onClick={handleOpenExternal} className="mx-auto px-8 py-3.5 min-h-[44px] border border-gold/30 rounded-sm text-gold hover:bg-gold/15 transition-all duration-500 font-serif tracking-widest">
              {t("login.openExternalBtn")}
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(currentUrl); alert(t("login.urlCopied")); }}
              className="mx-auto px-6 py-2.5 min-h-[44px] text-mist/60 hover:text-gold transition-all duration-300 text-xs tracking-widest flex items-center gap-2"
            >
              📋 {t("login.copyUrl")}
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-xs space-y-4">
            <p className="text-sm text-mist/60 tracking-wide">{t("login.hint")}</p>

            {/* Google Sign In */}
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="mx-auto px-8 py-3.5 min-h-[44px] border border-gold/30 rounded-sm text-gold hover:bg-gold/15 transition-all duration-500 font-serif tracking-widest flex items-center gap-3"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {t("login.google")}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gold/15" />
              <span className="text-xs text-stone/50 font-serif">{t("login.or")}</span>
              <div className="flex-1 h-px bg-gold/15" />
            </div>

            {/* Credentials Login */}
            <form onSubmit={handleCredentialsLogin} className="space-y-3">
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(false); }}
                placeholder={t("login.username")}
                className="w-full"
                autoComplete="username"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                placeholder={t("login.password")}
                className="w-full"
                autoComplete="current-password"
              />
              {error && (
                <p className="text-xs text-red-400">{t("login.loginError")}</p>
              )}
              <button
                type="submit"
                disabled={loading || !username.trim() || !password}
                className="w-full py-3 min-h-[44px] border border-gold/30 rounded-sm text-gold hover:bg-gold/15 transition-all duration-500 font-serif tracking-widest disabled:opacity-40"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
                ) : (
                  t("login.loginBtn")
                )}
              </button>
            </form>

            <div className="flex justify-between text-xs">
              <a href="/forgot-password" className="text-stone/60 hover:text-gold transition-colors">
                {t("login.forgotPassword")}
              </a>
              <a href="/register" className="text-gold/70 hover:text-gold transition-colors">
                {t("login.registerLink")}
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-center">
        <div className="mx-auto w-16 gold-line mb-4" />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: add credentials login form with username/password to login page

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Create registration page

**Files:**
- Create: `app/register/page.tsx`

- [ ] **Step 1: Create the registration page**

Create `app/register/page.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import SmokeParticles from "@/app/components/SmokeParticles";
import ThemeToggle from "@/app/components/ThemeToggle";
import { useLocale } from "@/app/components/LocaleProvider";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function RegisterPage() {
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Debounced username check
  const checkUsername = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (value: string) => {
        clearTimeout(timer);
        if (!value || !USERNAME_REGEX.test(value)) {
          setUsernameStatus("idle");
          return;
        }
        setUsernameStatus("checking");
        timer = setTimeout(async () => {
          try {
            const res = await fetch(`/api/auth/check-username?q=${encodeURIComponent(value)}`);
            const data = await res.json();
            setUsernameStatus(data.available ? "available" : "taken");
          } catch {
            setUsernameStatus("idle");
          }
        }, 500);
      };
    })(),
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!USERNAME_REGEX.test(username)) {
      setError(t("register.usernamePlaceholder"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("register.passwordMismatch"));
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      setError(t("register.passwordWeakError"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "username_taken") setError(t("register.usernameTakenError"));
        else if (data.error === "email_taken") setError(t("register.emailTakenError"));
        else if (data.error === "password_weak") setError(t("register.passwordWeakError"));
        else setError(data.message || "Registration failed");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
        <SmokeParticles />
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
        <div className="text-center space-y-6 max-w-sm animate-fade-in-up" style={{ opacity: 0 }}>
          <h1 className="text-3xl font-bold text-gold" style={{ fontFamily: "var(--font-calligraphy)" }}>
            {t("app.title")}
          </h1>
          <div className="mx-auto w-24 gold-line" />
          <p className="text-sm text-cream leading-relaxed">{t("register.success")}</p>
          <a href="/login" className="inline-block text-sm text-gold/70 hover:text-gold transition-colors">
            {t("register.backToLogin")}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
      <SmokeParticles />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6 animate-fade-in-up" style={{ opacity: 0 }}>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gold" style={{ fontFamily: "var(--font-calligraphy)" }}>
            {t("app.title")}
          </h1>
          <p className="mt-2 text-sm text-stone">{t("register.title")}</p>
          <div className="mx-auto mt-4 w-24 gold-line" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="text-xs text-stone mb-1 block">{t("register.username")}</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                  setUsername(v);
                  checkUsername(v);
                }}
                placeholder={t("register.usernamePlaceholder")}
                className="w-full"
                maxLength={30}
                autoComplete="username"
              />
              {usernameStatus === "available" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-500">{t("register.usernameAvailable")}</span>
              )}
              {usernameStatus === "taken" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-400">{t("register.usernameTaken")}</span>
              )}
              {usernameStatus === "checking" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-gold/30 border-t-gold rounded-full animate-spin" />
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-xs text-stone mb-1 block">{t("register.email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("register.emailPlaceholder")}
              className="w-full"
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-xs text-stone mb-1 block">{t("register.password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("register.passwordPlaceholder")}
              className="w-full"
              autoComplete="new-password"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs text-stone mb-1 block">{t("register.confirmPassword")}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("register.confirmPasswordPlaceholder")}
              className="w-full"
              autoComplete="new-password"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-400 mt-1">{t("register.passwordMismatch")}</p>
            )}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || usernameStatus === "taken"}
            className="w-full py-3 min-h-[44px] border border-gold/30 rounded-sm text-gold hover:bg-gold/15 transition-all duration-500 font-serif tracking-widest disabled:opacity-40"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            ) : (
              t("register.submit")
            )}
          </button>
        </form>

        <p className="text-center">
          <a href="/login" className="text-xs text-stone/60 hover:text-gold transition-colors">
            {t("register.backToLogin")}
          </a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/register/page.tsx
git commit -m "feat: add registration page with username availability check

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Create forgot-password and reset-password pages

**Files:**
- Create: `app/forgot-password/page.tsx`
- Create: `app/reset-password/page.tsx`

- [ ] **Step 1: Create forgot-password page**

Create `app/forgot-password/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import SmokeParticles from "@/app/components/SmokeParticles";
import ThemeToggle from "@/app/components/ThemeToggle";
import { useLocale } from "@/app/components/LocaleProvider";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // Always show success to not reveal email existence
    }
    setLoading(false);
    setSent(true);
  };

  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
      <SmokeParticles />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6 animate-fade-in-up" style={{ opacity: 0 }}>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gold" style={{ fontFamily: "var(--font-calligraphy)" }}>
            {t("app.title")}
          </h1>
          <p className="mt-2 text-sm text-stone">{t("forgot.title")}</p>
          <div className="mx-auto mt-4 w-24 gold-line" />
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-cream leading-relaxed">{t("forgot.success")}</p>
            <a href="/login" className="inline-block text-sm text-gold/70 hover:text-gold transition-colors">
              {t("forgot.backToLogin")}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-stone mb-1 block">{t("forgot.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full"
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3 min-h-[44px] border border-gold/30 rounded-sm text-gold hover:bg-gold/15 transition-all duration-500 font-serif tracking-widest disabled:opacity-40"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              ) : (
                t("forgot.submit")
              )}
            </button>
            <p className="text-center">
              <a href="/login" className="text-xs text-stone/60 hover:text-gold transition-colors">
                {t("forgot.backToLogin")}
              </a>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create reset-password page**

Create `app/reset-password/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import SmokeParticles from "@/app/components/SmokeParticles";
import ThemeToggle from "@/app/components/ThemeToggle";
import { useLocale } from "@/app/components/LocaleProvider";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function ResetPasswordPage() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("register.passwordMismatch"));
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      setError(t("register.passwordWeakError"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(t("reset.invalidToken"));
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
        <SmokeParticles />
        <div className="text-center space-y-4">
          <p className="text-sm text-red-400">{t("reset.invalidToken")}</p>
          <a href="/login" className="text-sm text-gold/70 hover:text-gold transition-colors">
            {t("reset.backToLogin")}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-screen px-6">
      <SmokeParticles />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6 animate-fade-in-up" style={{ opacity: 0 }}>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gold" style={{ fontFamily: "var(--font-calligraphy)" }}>
            {t("app.title")}
          </h1>
          <p className="mt-2 text-sm text-stone">{t("reset.title")}</p>
          <div className="mx-auto mt-4 w-24 gold-line" />
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-cream leading-relaxed">{t("reset.success")}</p>
            <a href="/login" className="inline-block text-sm text-gold/70 hover:text-gold transition-colors">
              {t("reset.backToLogin")}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-stone mb-1 block">{t("reset.newPassword")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("register.passwordPlaceholder")}
                className="w-full"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-xs text-stone mb-1 block">{t("reset.confirmPassword")}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("register.confirmPasswordPlaceholder")}
                className="w-full"
                autoComplete="new-password"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1">{t("register.passwordMismatch")}</p>
              )}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 min-h-[44px] border border-gold/30 rounded-sm text-gold hover:bg-gold/15 transition-all duration-500 font-serif tracking-widest disabled:opacity-40"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              ) : (
                t("reset.submit")
              )}
            </button>
            <p className="text-center">
              <a href="/login" className="text-xs text-stone/60 hover:text-gold transition-colors">
                {t("reset.backToLogin")}
              </a>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/forgot-password/page.tsx app/reset-password/page.tsx
git commit -m "feat: add forgot-password and reset-password pages

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Update admin page to show auth provider

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Update admin user list to show auth provider badge**

In the admin page, find the user status display area (where `status.text` is shown). After the status badge, add an auth provider indicator. Find the line that renders `{status.text}` and add after it:

```tsx
                            {user.authProvider === "credentials" && (
                              <span className="text-[10px] px-1.5 py-0.5 border border-stone/20 rounded text-stone/50">
                                ID
                              </span>
                            )}
```

Also update the fetch response handling to include `authProvider`. In the `UserItem` interface, add:

```typescript
  authProvider?: string;
```

- [ ] **Step 2: Update the protected layout to handle unverified status**

In `app/(protected)/layout.tsx`, update the pending check to also catch `unverified`:

Find the line:
```typescript
  if (!userData || userData.status === "pending") {
```

Replace with:
```typescript
  if (!userData || userData.status === "pending" || userData.status === "unverified") {
```

- [ ] **Step 3: Update the admin users API to return authProvider**

In `app/api/admin/users/route.ts`, the list mapping currently returns `{ email, ...data }`. The `data` from `readUsers()` doesn't include `authProvider`. Update the list mapping to include it.

In `app/lib/users.ts`, update the `readUsers` function to also return `authProvider`:

In the `UserData` interface, add:
```typescript
  authProvider?: string;
```

In the `readUsers` function, add to the store mapping:
```typescript
      authProvider: row.authProvider,
```

- [ ] **Step 4: Verify TypeScript compiles and build**

Run: `npx tsc --noEmit && npx next build`

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx app/lib/users.ts "app/(protected)/layout.tsx" app/api/admin/users/route.ts
git commit -m "feat: show auth provider in admin user list, handle unverified status

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Push schema and deploy

- [ ] **Step 1: Push DB schema changes to Neon**

```bash
export $(grep -E '^POSTGRES_' .env.local | xargs) && export POSTGRES_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}/${POSTGRES_DATABASE}?sslmode=require" && npx drizzle-kit push
```

- [ ] **Step 2: Push all commits**

```bash
git push
```
