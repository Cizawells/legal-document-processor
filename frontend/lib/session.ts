import { getSession } from "next-auth/react";
import { auth } from "@/auth";

/**
 * Get session on server side (App Router)
 */
export async function getServerSession() {
  return await auth();
}

/**
 * Get session on client side
 */
export async function getClientSession() {
  return await getSession();
}

/**
 * Create authenticated fetch wrapper that includes session data
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const session = await getClientSession();

  // Debug logging
  console.log("authenticatedFetch - Session:", {
    user: session?.user,
    backendUser: (session as any)?.backendUser,
  });

  const headers = new Headers(options.headers);

  // Add Content-Type if not already set
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Add session info for backend authentication
  if (session?.user?.id) {
    headers.set("X-User-Id", session.user.id);
    headers.set("X-User-Email", session.user.email || "");
    console.log("Setting user headers:", {
      "X-User-Id": session.user.id,
      "X-User-Email": session.user.email,
    });
  }

  // Add backend token if available (from credentials login)
  const backendUser = (session as any)?.backendUser;
  if (backendUser?.access_token) {
    headers.set("Authorization", `Bearer ${backendUser.access_token}`);
    console.log("Setting Authorization header with backend token");
  } else {
    // For OAuth users, we'll rely on user ID headers for now
    // The backend should create a temporary token or use a different auth method
    console.warn(
      "No backend token found in session. Using user ID headers for authentication."
    );
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include", // Include cookies for backend session
  });
}

/**
 * Server-side authenticated fetch
 */
export async function serverAuthenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const session = await getServerSession();

  const headers = new Headers(options.headers);

  // Add Content-Type if not already set
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Add session info for backend authentication
  if (session?.user?.id) {
    headers.set("X-User-Id", session.user.id);
    headers.set("X-User-Email", session.user.email || "");
  }

  // Add backend token if available
  const backendUser = (session as any)?.backendUser;
  if (backendUser?.access_token) {
    headers.set("Authorization", `Bearer ${backendUser.access_token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getClientSession();
  return !!session?.user;
}

/**
 * Get user info from session
 */
export async function getCurrentUser() {
  const session = await getClientSession();
  return session?.user || null;
}

/**
 * Session hook for components
 */
export function useAuthenticatedFetch() {
  return {
    authenticatedFetch,
    isAuthenticated,
    getCurrentUser,
  };
}
