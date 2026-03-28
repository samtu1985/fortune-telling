import { auth } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import { ADMIN_EMAIL } from "@/app/lib/users";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const email = session.user?.email;
  if (email !== ADMIN_EMAIL) redirect("/");

  return <>{children}</>;
}
