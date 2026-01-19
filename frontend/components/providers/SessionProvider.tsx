"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export default function SessionProvider({ children }: { children: ReactNode }) {
  // More conservative settings for development to prevent infinite loops
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <NextAuthSessionProvider
      // Disable automatic session polling completely in development
      refetchInterval={isDevelopment ? 0 : 5 * 60} // No polling in dev, 5 min in prod
      refetchOnWindowFocus={false} // Disable refetch on window focus
      refetchWhenOffline={false} // Disable refetch when offline
    >
      {children}
    </NextAuthSessionProvider>
  );
}
