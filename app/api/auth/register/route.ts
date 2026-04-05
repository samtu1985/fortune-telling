import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import {
  checkUsernameAvailable,
  checkEmailAvailable,
  registerCredentialsUser,
  ADMIN_EMAIL,
} from "@/app/lib/users";
import { sendVerificationEmail } from "@/app/lib/email";

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

  if (!email || !/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
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

  // Block registration with admin email
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return Response.json(
      { error: "email_taken", message: "Email is already registered" },
      { status: 409 }
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
    const verifyToken = randomUUID();
    await registerCredentialsUser({ username, email, password, verifyToken });
    await sendVerificationEmail(email, verifyToken);
    return Response.json({ success: true }, { status: 201 });
  } catch (e) {
    console.error("[register] Failed:", e);
    return Response.json(
      { error: "server_error", message: "Registration failed" },
      { status: 500 }
    );
  }
}
