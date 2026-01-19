"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CreditCard,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
  Shield,
  Clock,
} from "lucide-react";
import { getSubscriptionStatus, getUsageStats, createPortalSession } from "@/lib/stripe";

export default function SubscriptionPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      loadData();
    }
  }, [status, router]);

  const loadData = async () => {
    try {
      const [subData, usageData] = await Promise.all([
        getSubscriptionStatus(),
        getUsageStats(),
      ]);
      setSubscription(subData);
      setUsage(usageData);
    } catch (error) {
      console.error("Failed to load subscription data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      await createPortalSession();
    } catch (error) {
      console.error("Portal error:", error);
      alert("Failed to open billing portal. Please try again.");
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-600 bg-green-50";
      case "trialing":
        return "text-blue-600 bg-blue-50";
      case "past_due":
        return "text-orange-600 bg-orange-50";
      case "canceled":
        return "text-red-600 bg-red-50";
      default:
        return "text-slate-600 bg-slate-50";
    }
  };

  const getPlanName = (plan: string) => {
    switch (plan) {
      case "solo":
        return "Solo Attorney";
      case "firm":
        return "Small Firm";
      case "enterprise":
        return "Enterprise";
      default:
        return "Free";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Subscription & Billing</h1>
          <p className="text-slate-600 mt-2">
            Manage your subscription, billing, and usage
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Current Plan */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  Current Plan
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-slate-900">
                    {getPlanName(subscription?.plan || "free")}
                  </span>
                  {subscription?.status && (
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                        subscription.status
                      )}`}
                    >
                      {subscription.status === "trialing"
                        ? "Free Trial"
                        : subscription.status.charAt(0).toUpperCase() +
                          subscription.status.slice(1)}
                    </span>
                  )}
                </div>
              </div>
              {subscription?.isActive && (
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {portalLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Manage Subscription
                      <ExternalLink className="w-3 h-3" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Trial Info */}
            {subscription?.status === "trialing" && subscription?.daysUntilTrialEnd && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">
                      {subscription.daysUntilTrialEnd} days left in your free trial
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Your trial ends on {formatDate(subscription.trialEndsAt)}.
                      You won't be charged until then.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Billing Info */}
            {subscription?.isActive && (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-slate-200">
                  <span className="text-slate-600">Billing Cycle</span>
                  <span className="font-medium text-slate-900">Monthly</span>
                </div>
                {subscription?.currentPeriodEnd && (
                  <div className="flex items-center justify-between py-3 border-b border-slate-200">
                    <span className="text-slate-600">Next Billing Date</span>
                    <span className="font-medium text-slate-900">
                      {formatDate(subscription.currentPeriodEnd)}
                    </span>
                  </div>
                )}
                {subscription?.cancelAtPeriodEnd && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-900">
                          Subscription Ending
                        </p>
                        <p className="text-sm text-orange-700 mt-1">
                          Your subscription will end on{" "}
                          {formatDate(subscription.currentPeriodEnd)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Free Plan CTA */}
            {subscription?.plan === "free" && (
              <div className="mt-6 p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl">
                <h3 className="text-xl font-bold mb-2">Upgrade to Pro</h3>
                <p className="text-slate-300 mb-4">
                  Unlock Auto-PII detection, bulk processing, and more
                </p>
                <button
                  onClick={() => router.push("/pricing")}
                  className="px-6 py-3 bg-white text-slate-900 rounded-lg font-semibold hover:bg-slate-100 transition"
                >
                  View Plans
                </button>
              </div>
            )}
          </div>

          {/* Usage Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Usage This Month
            </h2>

            {usage ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="text-3xl font-bold text-slate-900 mb-1">
                    {usage.total}
                  </div>
                  <div className="text-sm text-slate-600">Total Operations</div>
                </div>

                <div className="space-y-3">
                  {Object.entries(usage.byFeature || {}).map(([feature, count]: [string, any]) => (
                    <div key={feature} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600 capitalize">
                        {feature.replace(/_/g, " ")}
                      </span>
                      <span className="font-medium text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>

                {usage.total === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No usage recorded this month
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Loading usage data...</p>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Your Plan Includes
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subscription?.plan !== "free" && (
              <>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900">Auto-PII Detection</p>
                    <p className="text-sm text-slate-600">
                      Automatically find sensitive information
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900">Bulk Processing</p>
                    <p className="text-sm text-slate-600">
                      Process multiple files at once
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-slate-900">Priority Support</p>
                    <p className="text-sm text-slate-600">
                      Get help when you need it
                    </p>
                  </div>
                </div>
              </>
            )}
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">All PDF Tools</p>
                <p className="text-sm text-slate-600">
                  Merge, split, compress, and convert
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
