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
