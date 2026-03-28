import { NextRequest } from "next/server";
import { auth } from "@/app/lib/auth";
import { getProfile, updateProfile, type UserProfile } from "@/app/lib/users";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getProfile(email);
  return Response.json({ profile: profile ?? null });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as UserProfile;

  const ok = await updateProfile(email, {
    birthDate: body.birthDate || "",
    birthTime: body.birthTime || "",
    gender: body.gender || "",
    birthPlace: body.birthPlace || "",
  });

  if (!ok) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
