import { auth } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import { getUser, registerUser, ADMIN_EMAIL } from "@/app/lib/users";
import PendingScreen from "@/app/components/PendingScreen";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const email = session.user?.email;
  if (!email) redirect("/login");

  let userData = await getUser(email);

  // Only register if user doesn't exist yet (backup for when signIn callback fails)
  // This avoids unnecessary blob writes that could race with admin operations
  if (!userData) {
    try {
      await registerUser(
        email,
        session.user?.name ?? null,
        session.user?.image ?? null
      );
      userData = await getUser(email);
      console.log("[layout] Backup registered user:", email, userData?.status);
    } catch (e) {
      console.error("[layout] Failed to register user:", e);
    }
  }

  // Admin always has access
  if (email === ADMIN_EMAIL) {
    return <>{children}</>;
  }

  if (!userData || userData.status === "pending" || userData.status === "unverified") {
    return <PendingScreen type="pending" />;
  }

  if (userData.status === "disabled") {
    return <PendingScreen type="disabled" />;
  }

  return <>{children}</>;
}
