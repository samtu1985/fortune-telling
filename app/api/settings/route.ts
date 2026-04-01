import { auth } from "@/app/lib/auth";
import { getReasoningDepth, setReasoningDepth, type ReasoningDepth } from "@/app/lib/users";
import { NextRequest } from "next/server";

const VALID_DEPTHS: ReasoningDepth[] = ["high", "medium", "low", "off"];

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const reasoningDepth = await getReasoningDepth(email);
  return Response.json({ reasoningDepth });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reasoningDepth } = await request.json();
  if (!VALID_DEPTHS.includes(reasoningDepth)) {
    return Response.json({ error: "Invalid reasoning depth" }, { status: 400 });
  }

  const ok = await setReasoningDepth(email, reasoningDepth);
  if (!ok) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }
  return Response.json({ success: true, reasoningDepth });
}
