import { auth } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import {
  getUser,
  getUserWithQuota,
  registerUser,
  ADMIN_EMAIL,
} from "@/app/lib/users";
import PendingScreen from "@/app/components/PendingScreen";
import { QuotaExhaustedProvider } from "@/app/components/QuotaExhaustedGate";

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

  // Fetch numeric user id for the quota provider (needed by PurchaseModal's
  // Stripe `client-reference-id`). Runs before all branches so admin is also
  // wrapped — admin is quota-exempt but child components still call
  // useQuotaExhausted() unconditionally, which throws without a provider.
  const quotaRow = await getUserWithQuota(email);

  // Admin always has access. Wrap with a provider so useQuotaExhausted() works
  // in child pages; admin never hits 402 because isExempt() short-circuits,
  // so the provider is effectively inert for them.
  if (email === ADMIN_EMAIL) {
    if (!quotaRow) {
      // Admin row missing entirely — shouldn't happen, but don't crash.
      return <>{children}</>;
    }
    return (
      <QuotaExhaustedProvider userId={quotaRow.id}>
        {children}
      </QuotaExhaustedProvider>
    );
  }

  if (!userData || userData.status === "pending" || userData.status === "unverified") {
    return <PendingScreen type="pending" />;
  }

  if (userData.status === "disabled") {
    return <PendingScreen type="disabled" />;
  }

  if (!quotaRow) {
    // Should not happen after registerUser above, but fall back gracefully.
    return <PendingScreen type="pending" />;
  }

  // Age verification gate — blocks approved users who haven't verified yet
  if (!userData.ageVerifiedAt) {
    const AgeVerificationModal = (await import("@/app/components/AgeVerificationModal")).default;
    return (
      <QuotaExhaustedProvider userId={quotaRow.id}>
        {children}
        <AgeVerificationModal />
      </QuotaExhaustedProvider>
    );
  }

  return (
    <QuotaExhaustedProvider userId={quotaRow.id}>
      {children}
    </QuotaExhaustedProvider>
  );
}
