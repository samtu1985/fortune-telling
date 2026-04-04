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
