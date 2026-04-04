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

  if (!username || !USERNAME_REGEX.test(username)) {
    return Response.json(
      { error: "username_invalid", message: "Username must be 3-30 characters, alphanumeric and underscore only" },
      { status: 400 }
    );
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { error: "email_invalid", message: "Invalid email format" },
      { status: 400 }
    );
  }

  if (!password || !PASSWORD_REGEX.test(password)) {
    return Response.json(
      { error: "password_weak", message: "Password must be at least 8 characters with uppercase, lowercase, and digit" },
      { status: 400 }
    );
  }

  if (!(await checkUsernameAvailable(username))) {
    return Response.json(
      { error: "username_taken", message: "Username is already taken" },
      { status: 409 }
    );
  }

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
