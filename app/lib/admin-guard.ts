import { auth } from "@/app/lib/auth";
import { ADMIN_EMAIL } from "@/app/lib/users";

export async function requireAdmin(): Promise<
  | { ok: true }
  | { ok: false; response: Response }
> {
  const session = await auth();
  if (session?.user?.email !== ADMIN_EMAIL) {
    return {
      ok: false,
      response: Response.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true };
}
