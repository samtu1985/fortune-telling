import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { registerUser } from "./users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        await registerUser(user.email, user.name ?? null, user.image ?? null);
        console.log("[auth] User registered on signIn:", user.email);
      } catch (e) {
        // Don't block login even if registration fails.
        // The protected layout will retry registration as backup.
        console.error("[auth] Failed to register user on signIn:", user.email, e);
      }
      return true;
    },
  },
});
