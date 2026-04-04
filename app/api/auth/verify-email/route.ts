import { NextRequest } from "next/server";
import { verifyEmail } from "@/app/lib/users";
import { sendAdminNotification } from "@/app/lib/email";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new Response(renderHTML(false), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const result = await verifyEmail(token);

  if (!result) {
    return new Response(renderHTML(false), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Notify admin
  await sendAdminNotification(result.email, result.name);

  return new Response(renderHTML(true), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderHTML(success: boolean): string {
  const siteUrl = process.env.NEXTAUTH_URL || "https://fortune-for.me";
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>天機 — ${success ? "信箱驗證成功" : "驗證失敗"}</title>
  <style>
    body { font-family: serif; background: #0f0e0c; color: #ece6db; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { text-align: center; max-width: 400px; padding: 48px 32px; }
    h1 { color: #d4ad4a; font-size: 2rem; margin-bottom: 8px; }
    .line { width: 80px; height: 1px; background: linear-gradient(90deg, transparent, #d4ad4a, transparent); margin: 24px auto; }
    p { color: #b5ada4; line-height: 1.6; }
    a { display: inline-block; margin-top: 24px; padding: 12px 32px; border: 1px solid rgba(212,173,74,0.3); color: #d4ad4a; text-decoration: none; letter-spacing: 2px; font-size: 14px; }
    a:hover { background: rgba(212,173,74,0.1); }
    .error { color: #ef4444; }
  </style>
</head>
<body>
  <div class="card">
    <h1>天機</h1>
    <div class="line"></div>
    ${success
      ? `<p>信箱驗證成功！您的帳號正在等待管理員審核。</p>
         <p>Email verified! Your account is pending admin approval.</p>
         <a href="${siteUrl}/login">返回登入 / Back to Login</a>`
      : `<p class="error">驗證連結無效或已過期。</p>
         <p class="error">Verification link is invalid or expired.</p>
         <a href="${siteUrl}/register">重新註冊 / Register Again</a>`
    }
  </div>
</body>
</html>`;
}
