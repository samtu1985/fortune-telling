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
      } catch (e) {
        console.error("Failed to register user:", e);
      }
      return true;
    },
  },
});
