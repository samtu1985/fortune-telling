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
