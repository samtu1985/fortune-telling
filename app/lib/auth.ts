import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { registerUser, verifyCredentials } from "./users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string;
        const password = credentials?.password as string;
        if (!username || !password) return null;

        const user = await verifyCredentials(username, password);
        if (!user) return null;

        // Only allow approved users to sign in
        if (user.status !== "approved") return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      // Only auto-register for Google OAuth (credentials users register via /api/auth/register)
      if (account?.provider === "google") {
        try {
          await registerUser(user.email, user.name ?? null, user.image ?? null);
          console.log("[auth] User registered on signIn:", user.email);
        } catch (e) {
          console.error("[auth] Failed to register user on signIn:", user.email, e);
        }
      }
      return true;
    },
  },
});
