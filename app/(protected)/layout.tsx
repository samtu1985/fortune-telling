import { auth } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import { getUser, ADMIN_EMAIL } from "@/app/lib/users";
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
  if (email === ADMIN_EMAIL) return <>{children}</>;

  const userData = await getUser(email);

  if (!userData || userData.status === "pending") {
    return <PendingScreen type="pending" />;
  }

  if (userData.status === "disabled") {
    return <PendingScreen type="disabled" />;
  }

  return <>{children}</>;
}
