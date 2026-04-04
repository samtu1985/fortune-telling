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
