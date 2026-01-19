"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  FileText,
  Scissors,
  Archive,
  FileImage,
  Plus,
  User,
  Clock,
  Shield,
  BarChart3,
  Settings,
} from "lucide-react";
import Link from "next/link";
import RecentDocuments from "../components/RecentDocuments";
import TrialStatusCard from "../components/TrialStatusCard";
import SubscriptionBadge from "../components/SubscriptionBadge";
import { Session } from "next-auth";

interface ActivityStats {
  documentsProcessed: number;
  pagesRedacted: number;
  thisMonth: number;
  avgProcessingTime: number;
}

interface UsageQuota {
  feature: string;
  used: number;
  limit: number;
  periodEnd: string;
}

// Helper function to make authenticated requests with existing session data
const makeAuthenticatedRequest = async (url: string, session: Session | null): Promise<Response> => {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  // Add session info for backend authentication if user is authenticated
  if (session?.user?.id) {
    headers.set("X-User-Id", session.user.id);
    headers.set("X-User-Email", session.user.email || "");
  }

  // Add backend token if available (from credentials login)
  const backendUser = (session as any)?.backendUser;
  if (backendUser?.access_token) {
    headers.set("Authorization", `Bearer ${backendUser.access_token}`);
  }

  return fetch(url, {
    headers,
    credentials: "include", // Include cookies for backend session
  });
};

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(
    null
  );
  const [statsLoading, setStatsLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    plan: string;
    status: string;
    isActive: boolean;
    trialEndsAt: string | null;
    daysUntilTrialEnd: number | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [usageQuotas, setUsageQuotas] = useState<UsageQuota[]>([]);

  useEffect(() => {
    const loadActivityStats = async () => {
      if (status === "loading") return;
      if (!session) {
        setStatsLoading(false);
        return;
      }

      try {
        const response = await makeAuthenticatedRequest(
          `${process.env.NEXT_PUBLIC_API_URL}/activity/stats`,
          session
        );
        
        if (response.ok) {
          const stats = await response.json();
          setActivityStats(stats);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error("Failed to load activity stats:", error);
        // Use default stats on error
        setActivityStats({
          documentsProcessed: 0,
          pagesRedacted: 0,
          thisMonth: 0,
          avgProcessingTime: 0,
        });
      } finally {
        setStatsLoading(false);
      }
    };

    loadActivityStats();
  }, [session?.user?.id, status]); // Only re-fetch when user ID changes, not entire session object

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const pdfTools = [
    {
      name: "Document Redaction",
      icon: Shield,
      url: "/redaction",
      color: "bg-slate-50 text-slate-700 border border-slate-200",
      description: "Redact privileged & confidential information",
      badge: "Core",
    },
    {
      name: "Merge Documents",
      icon: Plus,
      url: "/merge_pdf",
      color: "bg-slate-50 text-slate-700 border border-slate-200",
      description: "Combine exhibits and filings",
      badge: null,
    },
    {
      name: "Split Documents",
      icon: Scissors,
      url: "/pdf_to_split",
      color: "bg-slate-50 text-slate-700 border border-slate-200",
      description: "Extract specific pages",
      badge: null,
    },
    {
      name: "Compress Files",
      icon: Archive,
      url: "/compression",
      color: "bg-slate-50 text-slate-700 border border-slate-200",
      description: "Optimize for e-filing",
      badge: null,
    },
    {
      name: "PDF to Word",
      icon: FileText,
      url: "/pdf_to_word",
      color: "bg-slate-50 text-slate-700 border border-slate-200",
      description: "Convert to editable format",
      badge: null,
    },
    {
      name: "PDF to PowerPoint",
      icon: FileImage,
      url: "/pdf_to_powerpoint",
      color: "bg-slate-50 text-slate-700 border border-slate-200",
      description: "Create presentations",
      badge: null,
    },
  ];

  const getPlanLimits = (plan: string) => {
    switch (plan?.toLowerCase()) {
      case "solo":
        return { redactions: 100, storage: "50GB", users: 1 };
      case "firm":
        return { redactions: 1000, storage: "500GB", users: 10 };
      case "enterprise":
        return { redactions: "Unlimited", storage: "5TB", users: "Unlimited" };
      default:
        return { redactions: 5, storage: "1GB", users: 1 };
    }
  };

  const limits = getPlanLimits(subscriptionStatus?.plan || "free");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">
                  LegalRedactor
                </span>
              </Link>
            </div>
            <nav className="flex items-center space-x-4">
              <Link
                href="/settings"
                className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100"
              >
                <Settings className="w-5 h-5" />
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back,{" "}
            {session?.user?.name ||
              session?.user?.email?.split("@")[0] ||
              "User"}
            !
          </h1>
          <p className="text-gray-600">
            Manage your documents and access all PDF tools from your dashboard.
          </p>
          <div className="mt-3">
            <SubscriptionBadge />
          </div>
        </div>

        {/* Trial Status Card */}
        <TrialStatusCard className="mb-8" />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <FileText className="w-5 h-5 text-slate-700" />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Total
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">
                Documents Processed
              </p>
              {statsLoading ? (
                <div className="h-8 bg-slate-100 rounded animate-pulse"></div>
              ) : (
                <p className="text-3xl font-semibold text-slate-900">
                  {activityStats?.documentsProcessed || 0}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Shield className="w-5 h-5 text-slate-700" />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Redactions
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">
                Areas Redacted
              </p>
              {statsLoading ? (
                <div className="h-8 bg-slate-100 rounded animate-pulse"></div>
              ) : (
                <div>
                  <p className="text-3xl font-semibold text-slate-900">
                    {activityStats?.pagesRedacted || 0}
                  </p>
                  {typeof limits.redactions === "number" && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Monthly Quota</span>
                        <span>
                          {activityStats?.thisMonth || 0} / {limits.redactions}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-slate-700 h-1.5 rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              ((activityStats?.thisMonth || 0) /
                                limits.redactions) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Clock className="w-5 h-5 text-slate-700" />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Speed
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">
                Avg Processing Time
              </p>
              {statsLoading ? (
                <div className="h-8 bg-slate-100 rounded animate-pulse"></div>
              ) : (
                <p className="text-3xl font-semibold text-slate-900">
                  {activityStats?.avgProcessingTime
                    ? `${activityStats.avgProcessingTime}s`
                    : "—"}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-slate-700" />
              </div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Period
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">
                This Month
              </p>
              {statsLoading ? (
                <div className="h-8 bg-slate-100 rounded animate-pulse"></div>
              ) : (
                <div>
                  <p className="text-3xl font-semibold text-slate-900">
                    {activityStats?.thisMonth || 0}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {subscriptionStatus?.currentPeriodEnd
                      ? `Resets ${new Date(
                          subscriptionStatus.currentPeriodEnd
                        ).toLocaleDateString()}`
                      : "Monthly usage"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Compliance & Audit Section */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Compliance & Security
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                All documents are processed with enterprise-grade security and
                audit logging
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-slate-700">
                    SOC 2 Type II
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-slate-700">
                    GDPR Compliant
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-slate-700">
                    256-bit Encryption
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                  <Clock className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">
                    30-day Retention
                  </span>
                </div>
              </div>
            </div>
            <Link
              href="/activity"
              className="text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-300 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition"
            >
              View Audit Log →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* PDF Tools */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-900 mb-4">PDF Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pdfTools.map((tool) => (
                <Link
                  key={tool.name}
                  href={tool.url}
                  className="bg-white p-6 rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition group"
                >
                  <div className="flex items-start">
                    <div className={`p-3 ${tool.color} rounded-lg`}>
                      <tool.icon className="w-6 h-6" />
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">
                          {tool.name}
                        </h3>
                        {tool.badge && (
                          <span className="text-xs font-medium px-2 py-0.5 bg-slate-900 text-white rounded">
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Documents */}
          <div>
            <RecentDocuments />

            <div className="mt-6">
              <Link
                href="/activity"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all activity →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
