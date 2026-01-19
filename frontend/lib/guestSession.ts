/**
 * Guest Session Management for Frontend
 * Handles guest user session tracking and limits
 */

export interface GuestSession {
  id: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
  redactionCount: number;
  mergeCount: number;
  lastActivity: string;
}

export interface GuestLimitCheck {
  allowed: boolean;
  currentCount: number;
  maxCount: number;
}

/**
 * Check if user can perform merge operation
 */
export async function checkGuestMergeLimit(): Promise<GuestLimitCheck> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/guest-session/merge-limit`,
      {
        method: "GET",
        credentials: "include", // Include cookies for session
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error checking guest merge limit:", error);
    // Return conservative limit on error
    return {
      allowed: false,
      currentCount: 3,
      maxCount: 3,
    };
  }
}

/**
 * Check if user can perform redaction operation
 */
export async function checkGuestRedactionLimit(): Promise<GuestLimitCheck> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/guest-session/redaction-limit`,
      {
        method: "GET",
        credentials: "include", // Include cookies for session
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error checking guest redaction limit:", error);
    // Return conservative limit on error
    return {
      allowed: false,
      currentCount: 3,
      maxCount: 3,
    };
  }
}

/**
 * Get current guest session info
 */
export async function getGuestSession(): Promise<GuestSession | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/guest-session/info`,
      {
        method: "GET",
        credentials: "include", // Include cookies for session
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null; // No session found
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting guest session:", error);
    return null;
  }
}

/**
 * Create or refresh guest session
 */
export async function createGuestSession(): Promise<GuestSession | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/guest-session/create`,
      {
        method: "POST",
        credentials: "include", // Include cookies for session
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating guest session:", error);
    return null;
  }
}

/**
 * Enhanced guest limit error handler with better UX
 */
export function isGuestLimitError(error: any): boolean {
  return (
    error?.response?.data?.code === "GUEST_LIMIT_EXCEEDED" ||
    error?.response?.status === 403
  );
}

/**
 * Handle guest limit reached scenario
 */
export function handleGuestLimitReached(
  feature: "merge" | "redaction",
  currentCount: number,
  maxCount: number,
  onShowPricing: () => void
) {
  const featureText = feature === "merge" ? "PDF merging" : "PDF redaction";

  // Show user-friendly message
  const message = `You've reached the free limit for ${featureText} (${currentCount}/${maxCount}). Upgrade to continue with unlimited access!`;

  // You could also show a toast notification here instead of alert
  if (confirm(`${message}\n\nWould you like to see our pricing plans?`)) {
    onShowPricing();
  }
}
