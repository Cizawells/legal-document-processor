import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Call your backend login API
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            }
          );

          if (!res.ok) {
            return null;
          }

          const data = await res.json();

          // Backend returns { user, access_token }
          // Return user object that will be stored in the token
          if (data && data.id) {
            return {
              id: data.id,
              email: data.email,
              name: data.name,
              backendToken: data.access_token || null,
            };
          }

          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.plan = user.plan || "free";
      }

      // For OAuth providers, sync user to your database
      if (account?.provider === "google" && user) {
        try {
          // Check if user exists in your database or create them
          const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/auth/oauth`;
          console.log("OAuth sync - calling:", apiUrl);

          const res = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              provider: account.provider,
            }),
          });

          console.log("OAuth sync response:", res.status, res.statusText);

          if (res.ok) {
            const dbUser = await res.json();
            console.log("OAuth sync successful:", dbUser);
            token.id = dbUser.id;
            token.backendUser = dbUser;
          } else {
            const errorText = await res.text();
            console.error("OAuth sync failed:", res.status, errorText);
          }
        } catch (error) {
          console.error("OAuth sync error:", error);
        }
      }

      // For credentials login, the user object already contains backend user data
      if (account?.provider === "credentials" && user) {
        token.backendUser = user;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || token.sub || "";
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.plan = token.plan as string;
        // Add backend user data to session for API calls
        (session as any).backendUser = token.backendUser;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
});
