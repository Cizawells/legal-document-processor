"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle, Star, Loader2, Crown, Check } from "lucide-react";
import { createCheckoutSession, LEMONSQUEEZY_VARIANTS } from "@/lib/stripe";
import { authenticatedFetch } from "@/lib/session";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
  onCheckoutStart?: () => void;
}

const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  feature = "this feature",
  onCheckoutStart,
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [testTrialLoading, setTestTrialLoading] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);
  const router = useRouter();
  const { data: session, update } = useSession();

  // Helper functions to determine user's current plan status
  const isAuthenticated = !!session?.user;
  const userPlan = session?.user?.plan || "free";
  const isFreePlan = userPlan === "free" || !session?.user?.plan;
  const isProfessionalPlan = userPlan === "professional" || userPlan === "pro" || userPlan === "solo";

  // Function to get plan-specific button content
  const getPlanButtonContent = (planType: "free" | "professional") => {
    if (!isAuthenticated) {
      return planType === "free"
        ? { text: "Sign Up Free", disabled: false, variant: "default" }
        : { text: "Start Free Trial", disabled: false, variant: "primary" };
    }

    if (planType === "free") {
      if (isFreePlan) {
        return { text: "Current Plan", disabled: true, variant: "current" };
      } else {
        return {
          text: "Downgrade to Free",
          disabled: false,
          variant: "downgrade",
        };
      }
    }

    if (planType === "professional") {
      if (isProfessionalPlan) {
        return { text: "Current Plan", disabled: true, variant: "current" };
      } else {
        return { text: "Upgrade to Pro", disabled: false, variant: "upgrade" };
      }
    }

    return { text: "Select Plan", disabled: false, variant: "default" };
  };

  const handleTestTrial = async () => {
    setTestTrialLoading(true);
    try {
      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/lemonsqueezy/activate-trial`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("Trial activation result:", result);
        alert(`Trial activation: ${result.message}`);
        if (result.success) {
          onClose();
          // Refresh the page to update subscription status
          window.location.reload();
        }
      } else {
        const error = await response.json();
        alert(`Failed to activate trial: ${error.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Trial activation error:", error);
      alert("Failed to activate trial. Please try again.");
    } finally {
      setTestTrialLoading(false);
    }
  };

  const handleSignUpFree = () => {
    // Track analytics
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "pricing_plan_click", {
        plan: "free",
        billing_cycle: "monthly",
      });
    }
    router.push("/auth/signup");
    onClose();
  };

  const handleStartTrial = () => {
    // Track analytics
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "pricing_plan_click", {
        plan: "professional",
        billing_cycle: isAnnual ? "annual" : "monthly",
      });
    }
    router.push("/auth/signup?plan=professional");
    onClose();
  };

  const handleSubscribe = async (plan: "solo" | "firm") => {
    setLoading(plan);
    try {
      // Save current state before checkout
      onCheckoutStart?.();

      // Store callback to refresh session after successful checkout
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('pendingUpgrade', 'true');
      }

      const variantId = LEMONSQUEEZY_VARIANTS[plan];
      if (!variantId) {
        alert("LemonSqueezy is not configured. Please contact support.");
        return;
      }
      await createCheckoutSession(variantId);
    } catch (error) {
      console.error("Subscription error:", error);
      alert("Failed to start checkout. Please try again.");
      setLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Choose Your Plan
            </h2>
            <p className="text-slate-600 mt-1">
              Unlock {feature} and all premium features
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <div className="p-6">
          {/* Monthly/Annual Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-slate-100 p-1 rounded-lg flex">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  !isAnnual
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  isAnnual
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Annual
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid lg:grid-cols-2 gap-8 max-w-4xl mx-auto mb-8">
            {/* Free Tier */}
            <div
              className={`bg-white border-2 rounded-xl p-8 transition hover:shadow-lg relative ${
                isAuthenticated && isFreePlan
                  ? "border-green-300 bg-green-50/30"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {isAuthenticated && isFreePlan && (
                <div className="absolute -top-3 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Current Plan
                </div>
              )}
              <h3 className="text-xl font-bold text-slate-900 mb-2">Free</h3>
              <div className="mb-4">
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-bold text-slate-900">$0</span>
                  <span className="text-slate-600">/month</span>
                </div>
                <p className="text-sm text-slate-600 mt-2">
                  Perfect for trying professional redaction
                </p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    50 redactions per month
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    20 operations per month
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    Files up to 20MB
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    7-day file history
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    24-hour file retention
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    Redaction verification report
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    Manual text selection
                  </span>
                </li>
              </ul>
              {(() => {
                const freeButtonContent = getPlanButtonContent("free");
                return (
                  <button
                    onClick={
                      freeButtonContent.disabled ? undefined : handleSignUpFree
                    }
                    disabled={freeButtonContent.disabled}
                    className={`w-full py-3 text-center rounded-lg font-semibold transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 ${
                      freeButtonContent.variant === "current"
                        ? "bg-green-100 text-green-800 border-2 border-green-200 cursor-not-allowed"
                        : freeButtonContent.variant === "downgrade"
                        ? "bg-slate-100 text-slate-700 border-2 border-slate-200 hover:bg-slate-200"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    {freeButtonContent.variant === "current" && (
                      <Check className="w-4 h-4" />
                    )}
                    {freeButtonContent.text}
                  </button>
                );
              })()}
            </div>

            {/* Professional Tier - Most Popular */}
            <div
              className={`bg-white border-2 rounded-xl p-8 relative shadow-xl hover:shadow-2xl transition ${
                isAuthenticated && isProfessionalPlan
                  ? "border-green-300 bg-green-50/30"
                  : "border-blue-500"
              }`}
            >
              {isAuthenticated && isProfessionalPlan ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Crown className="w-3 h-3" />
                  Current Plan
                </div>
              ) : (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Star className="w-3 h-3" />
                  Most Popular
                </div>
              )}
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Professional
              </h3>
              <div className="mb-4">
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-bold text-slate-900">
                    ${isAnnual ? "199" : "19"}
                  </span>
                  <span className="text-slate-600">
                    /{isAnnual ? "year" : "month"}
                  </span>
                </div>
                {isAnnual && (
                  <div className="text-sm text-green-600 font-medium mt-1">
                    Save 13% • $228/year if monthly
                  </div>
                )}
                <p className="text-sm text-slate-600 mt-2">
                  Everything you need for professional redaction
                </p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    <strong>Unlimited redactions</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    <strong>Unlimited operations</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    Pattern matching & regex
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    Files up to 100MB
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    <strong>Priority processing (2x faster)</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    30-day file retention
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    OCR for scanned documents
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    Metadata removal
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    API access (1,000 calls/month)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">
                    Bates numbering
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-600">Audit logs</span>
                </li>
              </ul>
              {(() => {
                const proButtonContent = getPlanButtonContent("professional");
                return (
                  <>
                    <button
                      onClick={
                        proButtonContent.disabled
                          ? undefined
                          : proButtonContent.variant === "upgrade"
                          ? () => handleSubscribe("solo")
                          : handleStartTrial
                      }
                      disabled={proButtonContent.disabled}
                      className={`w-full py-3 text-center rounded-lg font-semibold transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2 ${
                        proButtonContent.variant === "current"
                          ? "bg-green-100 text-green-800 border-2 border-green-200 cursor-not-allowed"
                          : proButtonContent.variant === "upgrade"
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800"
                          : "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800"
                      }`}
                    >
                      {proButtonContent.variant === "current" && (
                        <Crown className="w-4 h-4" />
                      )}
                      {proButtonContent.variant === "upgrade" && (
                        <Star className="w-4 h-4" />
                      )}
                      {proButtonContent.text}
                    </button>
                    {proButtonContent.variant !== "current" && (
                      <p className="text-xs text-slate-500 text-center mt-2">
                        14-day free trial, no credit card required
                      </p>
                    )}
                    {proButtonContent.variant === "current" && (
                      <p className="text-xs text-green-600 text-center mt-2 font-medium">
                        ✓ You're on the Professional plan
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Additional Links */}
          <div className="text-center space-y-3">
            {!isAuthenticated && (
              <p className="text-sm text-slate-600">
                Not sure?{" "}
                <button
                  onClick={onClose}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Try Guest mode - 3 free redactions, no signup required
                </button>
              </p>
            )}
            <button className="text-sm text-slate-500 hover:text-slate-700 underline">
              View detailed comparison
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
