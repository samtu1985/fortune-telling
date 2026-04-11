import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL || "noreply@fortunefor.me";
const SITE_URL = process.env.NEXTAUTH_URL || "https://fortunefor.me";

console.log("[email] Resend configured:", !!resend, "FROM:", FROM, "SITE_URL:", SITE_URL);

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
    console.log("[email] Sending verification email from:", FROM, "to:", to);
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    console.log("[email] Verification email result:", JSON.stringify(result));
  } catch (e) {
    console.error("[email] Failed to send verification email:", e instanceof Error ? e.message : e);
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

export async function sendTrialNotification(
  to: string,
  singleCredits: number,
  multiCredits: number
): Promise<void> {
  const subject = "FortuneFor.me — 您收到免費體驗額度！";
  const html = `
    <div style="font-family: serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #1e1a14;">
      <h2 style="color: #7a5c10; text-align: center;">天機 FortuneFor.me</h2>
      <p>您收到了免費體驗額度：</p>
      <ul>
        <li><strong>個別問答（八字/紫微/星座）：</strong>${singleCredits} 輪</li>
        <li><strong>三師論道：</strong>${multiCredits} 次</li>
      </ul>
      <p>額度已加入您的帳戶，登入後點擊右上角頭像，即可查詢剩餘免費體驗次數。</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${SITE_URL}/login" style="display: inline-block; padding: 12px 32px; background: #7a5c10; color: #fff; text-decoration: none; border-radius: 4px; font-size: 14px;">
          登入 FortuneFor.me
        </a>
      </p>
    </div>
  `;

  if (!resend) {
    console.log("[email] Resend not configured. Trial notification for:", to);
    return;
  }

  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    console.log("[email] Trial notification sent to:", to);
  } catch (e) {
    console.error("[email] Failed to send trial notification:", e);
  }
}

export async function sendFeedbackAdminNotification(
  name: string,
  email: string,
  message: string,
  feedbackId: number
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || "geektu@gmail.com";
  const subject = "Fortune-For.me — 新使用者意見 / New User Feedback";
  const escapedMessage = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  const html = `
    <div style="font-family: serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #1e1a14;">
      <h2 style="color: #7a5c10; text-align: center;">天機 Fortune-For.me</h2>
      <p>您收到一則新的使用者意見：</p>
      <p>You received a new user feedback:</p>
      <div style="border-left: 3px solid #7a5c10; padding: 12px 16px; margin: 20px 0; background: #faf7f1;">
        <p style="margin: 0 0 6px 0;"><strong>From:</strong> ${name} &lt;${email}&gt;</p>
        <p style="margin: 0 0 12px 0; color: #847b72; font-size: 12px;">Feedback #${feedbackId}</p>
        <p style="margin: 0; white-space: pre-wrap;">${escapedMessage}</p>
      </div>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${SITE_URL}/admin?tab=feedback" style="display: inline-block; padding: 12px 32px; background: #7a5c10; color: #fff; text-decoration: none; border-radius: 4px; font-size: 14px;">
          前往後台查看 / View in Admin Panel
        </a>
      </p>
    </div>
  `;

  if (!resend) {
    console.log("[email] Resend not configured. Feedback notification for:", email);
    return;
  }

  try {
    await resend.emails.send({ from: FROM, to: adminEmail, subject, html });
    console.log("[email] Feedback notification sent for:", email);
  } catch (e) {
    console.error("[email] Failed to send feedback notification:", e);
  }
}

export async function sendFeedbackReply(
  to: string,
  name: string,
  originalMessage: string,
  replyMessage: string
): Promise<void> {
  const subject = "Fortune-For.me — 您的意見回覆 / Reply to Your Feedback";
  const escapedOriginal = originalMessage.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  const escapedReply = replyMessage.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  const html = `
    <div style="font-family: serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #1e1a14;">
      <h2 style="color: #7a5c10; text-align: center;">天機 Fortune-For.me</h2>
      <p>親愛的 ${name}，</p>
      <p>感謝您的意見回饋。我們已就您提出的問題做出回覆：</p>
      <p>Dear ${name}, thank you for your feedback. Here is our reply:</p>
      <div style="border-left: 3px solid #7a5c10; padding: 12px 16px; margin: 20px 0; background: #faf7f1;">
        <p style="margin: 0; white-space: pre-wrap;">${escapedReply}</p>
      </div>
      <p style="color: #847b72; font-size: 13px; margin-top: 24px;">您原先提出的意見 / Your original message:</p>
      <div style="border-left: 2px solid #c8bfa8; padding: 8px 14px; margin: 8px 0 24px 0; color: #847b72; font-size: 13px;">
        <p style="margin: 0; white-space: pre-wrap;">${escapedOriginal}</p>
      </div>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${SITE_URL}" style="display: inline-block; padding: 12px 32px; background: #7a5c10; color: #fff; text-decoration: none; border-radius: 4px; font-size: 14px;">
          返回 Fortune-For.me
        </a>
      </p>
    </div>
  `;

  if (!resend) {
    console.log("[email] Resend not configured. Feedback reply for:", to);
    return;
  }

  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    console.log("[email] Feedback reply sent to:", to);
  } catch (e) {
    console.error("[email] Failed to send feedback reply:", e);
  }
}

// ─── Payment Notifications (Task 12 will replace these stubs) ──────────────

type PurchaseNotificationArgs = {
  user: {
    id: number;
    email: string;
    singleCredits: number;
    multiCredits: number;
    singleUsed: number;
    multiUsed: number;
  };
  pkg: {
    name: string;
    singleCreditsGranted: number;
    multiCreditsGranted: number;
  };
  amount: number;
  currency: string;
  stripeSessionId: string;
};

type RefundNotificationArgs = {
  user: {
    id: number;
    email: string;
    singleCredits: number;
    multiCredits: number;
    singleUsed: number;
    multiUsed: number;
  };
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

export async function sendPurchaseAdminNotification(
  _args: PurchaseNotificationArgs
): Promise<void> {
  console.log("[email] (stub) sendPurchaseAdminNotification called");
}

export async function sendRefundAdminNotification(
  _args: RefundNotificationArgs
): Promise<void> {
  console.log("[email] (stub) sendRefundAdminNotification called");
}

export async function sendTrialInvitation(
  to: string,
  singleCredits: number,
  multiCredits: number
): Promise<void> {
  const subject = "FortuneFor.me — 邀請您免費體驗命理分析！";
  const html = `
    <div style="font-family: serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #1e1a14;">
      <h2 style="color: #7a5c10; text-align: center;">天機 FortuneFor.me</h2>
      <p>您被邀請免費體驗 FortuneFor.me 的 AI 命理分析服務！</p>
      <p>為您準備的免費體驗額度：</p>
      <ul>
        <li><strong>個別問答（八字/紫微/星座）：</strong>${singleCredits} 輪</li>
        <li><strong>三師論道：</strong>${multiCredits} 次</li>
      </ul>
      <p>註冊帳號並通過審核後，額度將自動加入您的帳戶。登入後點擊右上角頭像，即可查詢剩餘免費體驗次數。</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${SITE_URL}/register" style="display: inline-block; padding: 12px 32px; background: #7a5c10; color: #fff; text-decoration: none; border-radius: 4px; font-size: 14px;">
          免費註冊 FortuneFor.me
        </a>
      </p>
    </div>
  `;

  if (!resend) {
    console.log("[email] Resend not configured. Trial invitation for:", to);
    return;
  }

  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    console.log("[email] Trial invitation sent to:", to);
  } catch (e) {
    console.error("[email] Failed to send trial invitation:", e);
  }
}
