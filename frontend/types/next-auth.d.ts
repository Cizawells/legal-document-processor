import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user?: DefaultSession["user"] & {
      id: string;
      plan?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    plan?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    sub?: string;
    email?: string;
    name?: string;
    plan?: string;
  }
}
