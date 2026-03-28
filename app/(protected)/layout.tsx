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

  // Admin always has access
  if (email === ADMIN_EMAIL) {
    // Ensure admin is registered in storage
    try {
      await registerUser(email, session.user?.name ?? null, session.user?.image ?? null);
    } catch (e) {
      console.error("[layout] Failed to register admin:", e);
    }
    return <>{children}</>;
  }

  let userData = await getUser(email);

  // Backup registration: if signIn callback failed to register the user,
  // register them now on first protected page access
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

  if (!userData || userData.status === "pending") {
    return <PendingScreen type="pending" />;
  }

  if (userData.status === "disabled") {
    return <PendingScreen type="disabled" />;
  }

  return <>{children}</>;
}
