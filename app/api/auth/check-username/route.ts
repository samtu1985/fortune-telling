import { NextRequest } from "next/server";
import { checkUsernameAvailable } from "@/app/lib/users";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  if (!q || q.length < 3 || !/^[a-zA-Z0-9_]+$/.test(q)) {
    return Response.json({ available: false });
  }
  const available = await checkUsernameAvailable(q);
  return Response.json({ available });
}
