import { authenticatedFetch } from "./session";

/**
 * LemonSqueezy checkout integration
 */
export const createLemonSqueezyCheckout = (checkoutUrl: string) => {
  if (checkoutUrl) {
    window.location.href = checkoutUrl;
  }
};

/**
 * Create a checkout session and redirect to LemonSqueezy
 */
export async function createCheckoutSession(variantId: string) {
  try {
    const response = await authenticatedFetch(
      `${process.env.NEXT_PUBLIC_API_URL}/lemonsqueezy/create-checkout-session`,
      {
        method: "POST",
        body: JSON.stringify({ variantId }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Checkout error response:", errorData);
      throw new Error(`Failed to create checkout session: ${response.status}`);
    }

    const { url } = await response.json();

    // Redirect to LemonSqueezy Checkout
    if (url) {
      window.location.href = url;
    }
  } catch (error) {
    console.error("Checkout error:", error);
    throw error;
  }
}

/**
 * Create a customer portal session and redirect
 */
export async function createPortalSession() {
  try {
    const response = await authenticatedFetch(
      `${process.env.NEXT_PUBLIC_API_URL}/lemonsqueezy/create-portal-session`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to create portal session");
    }

    const { url } = await response.json();

    // Redirect to LemonSqueezy Customer Portal
    if (url) {
      window.location.href = url;
    }
  } catch (error) {
    console.error("Portal error:", error);
    throw error;
  }
}

/**
 * Get subscription status
 */
export async function getSubscriptionStatus() {
  try {
    const response = await authenticatedFetch(
      `${process.env.NEXT_PUBLIC_API_URL}/lemonsqueezy/subscription-status`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get subscription status");
    }

    return await response.json();
  } catch (error) {
    console.error("Subscription status error:", error);
    throw error;
  }
}

/**
 * Get usage statistics
 */
export async function getUsageStats() {
  try {
    const response = await authenticatedFetch(
      `${process.env.NEXT_PUBLIC_API_URL}/lemonsqueezy/usage-stats`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get usage stats");
    }

    return await response.json();
  } catch (error) {
    console.error("Usage stats error:", error);
    throw error;
  }
}

// LemonSqueezy Variant IDs - these should match your LemonSqueezy Dashboard
export const LEMONSQUEEZY_VARIANTS = {
  solo: process.env.NEXT_PUBLIC_LEMONSQUEEZY_SOLO_VARIANT_ID || "",
  firm: process.env.NEXT_PUBLIC_LEMONSQUEEZY_FIRM_VARIANT_ID || "",
  enterprise: process.env.NEXT_PUBLIC_LEMONSQUEEZY_ENTERPRISE_VARIANT_ID || "",
};
