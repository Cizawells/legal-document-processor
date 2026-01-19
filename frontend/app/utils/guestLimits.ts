// Utility functions for handling guest session limits

export interface GuestLimitError {
  message: string;
  code: "GUEST_LIMIT_EXCEEDED";
  currentCount: number;
  maxCount: number;
  feature: "merge" | "redaction";
}

export function isGuestLimitError(
  error: any
): error is { response: { data: GuestLimitError } } {
  return (
    error?.response?.data?.code === "GUEST_LIMIT_EXCEEDED" &&
    error?.response?.status === 403
  );
}

export function showPricingModal() {
  // This will trigger the pricing modal
  // You can implement this based on your existing modal system
  console.log("Guest limit exceeded - showing pricing modal");

  // For now, we'll show a simple alert, but you can replace this with your modal
  const message = `
🚀 Upgrade to Premium!

You've reached the free limit for guest users. 
Upgrade to get unlimited access to all features:

✅ Unlimited PDF merging
✅ Unlimited redactions  
✅ Priority processing
✅ Advanced features

Click OK to view pricing plans.
  `;

  if (confirm(message)) {
    // Redirect to pricing page or open pricing modal
    window.location.href = "/pricing";
  }
}

export function handleGuestLimitError(error: any) {
  if (isGuestLimitError(error)) {
    const limitError = error.response.data;
    console.log("Guest limit exceeded:", limitError);
    showPricingModal();
    return true; // Indicates the error was handled
  }
  
  // Also check for 403 status without the specific error structure
  if (error?.response?.status === 403) {
    console.log("Guest limit likely exceeded (403 error)");
    showPricingModal();
    return true;
  }
  
  return false; // Not a guest limit error
}
