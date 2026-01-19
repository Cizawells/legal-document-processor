"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Filter,
  Download,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { authenticatedFetch } from "@/lib/session";

// Activity interface matching backend schema
interface Activity {
  id: string;
  userId: string;
  type: string;
  action: string;
  fileName: string;
  fileSize?: string;
  fileId?: string;
  status: string;
  metadata?: any;
  duration?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface ActivityResponse {
  activities: Activity[];
  total: number;
}

export default function ActivityLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 20;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?redirect=/activity");
    }
  }, [status, router]);

  useEffect(() => {
    const loadActivities = async () => {
      if (status === "loading" || !session) return;

      try {
        setLoading(true);

        // Build query parameters
        const params = new URLSearchParams();
        if (typeFilter) params.append("type", typeFilter);
        if (statusFilter) params.append("status", statusFilter);
        params.append("limit", limit.toString());
        params.append("offset", ((currentPage - 1) * limit).toString());

        const response = await authenticatedFetch(
          `${
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
          }/activity?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch activities: ${response.statusText}`);
        }

        const data: ActivityResponse = await response.json();
        setActivities(data.activities);
        setTotal(data.total);
      } catch (error) {
        console.error("Failed to load activities:", error);
        setActivities([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
  }, [session, status, currentPage, typeFilter, statusFilter]);

  const filteredActivities = activities.filter((activity) => {
    if (!searchQuery) return true;
    return activity.fileName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalPages = Math.ceil(total / limit);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "pending":
      case "processing":
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: "bg-green-50 text-green-700 border-green-200",
      failed: "bg-red-50 text-red-700 border-red-200",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      processing: "bg-blue-50 text-blue-700 border-blue-200",
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-medium border rounded-md ${
          styles[status] || "bg-slate-50 text-slate-700 border-slate-200"
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const exportToCSV = () => {
    const headers = [
      "Timestamp",
      "Type",
      "Action",
      "File Name",
      "Status",
      "Duration (ms)",
      "Error",
    ];
    const rows = activities.map((a) => [
      new Date(a.createdAt).toISOString(),
      a.type,
      a.action,
      a.fileName,
      a.status,
      a.duration || "",
      a.errorMessage || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-slate-600 hover:text-slate-900 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Activity & Audit Log
                </h1>
                <p className="text-sm text-slate-600">
                  Complete history of all document operations
                </p>
              </div>
            </div>
            <button
              onClick={exportToCSV}
              disabled={activities.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-slate-600" />
            <h3 className="font-semibold text-slate-900">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Search Files
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by file name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Operation Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm"
              >
                <option value="">All Types</option>
                <option value="redaction">Redaction</option>
                <option value="merge">Merge</option>
                <option value="split">Split</option>
                <option value="compress">Compress</option>
                <option value="convert">Convert</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm"
              >
                <option value="">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
              </select>
            </div>
          </div>
        </div>

        {/* Activity Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
              <p className="text-slate-600 text-sm">Loading activities...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">No activities found</p>
              <p className="text-slate-500 text-sm mt-1">
                {searchQuery || typeFilter || statusFilter
                  ? "Try adjusting your filters"
                  : "Start processing documents to see activity"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Operation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        File Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredActivities.map((activity) => (
                      <tr
                        key={activity.id}
                        className="hover:bg-slate-50 transition"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <div>
                              <div className="text-sm font-medium text-slate-900">
                                {new Date(activity.createdAt).toLocaleString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  }
                                )}
                              </div>
                              <div className="text-xs text-slate-500">
                                {new Date(
                                  activity.createdAt
                                ).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {activity.type === "redaction" ? (
                              <Shield className="w-4 h-4 text-slate-600" />
                            ) : (
                              <FileText className="w-4 h-4 text-slate-600" />
                            )}
                            <div>
                              <div className="text-sm font-medium text-slate-900 capitalize">
                                {activity.type}
                              </div>
                              <div className="text-xs text-slate-500 capitalize">
                                {activity.action}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-xs">
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {activity.fileName}
                            </div>
                            {activity.fileSize && (
                              <div className="text-xs text-slate-500">
                                {activity.fileSize}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(activity.status)}
                            {getStatusBadge(activity.status)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">
                            {activity.duration
                              ? `${(activity.duration / 1000).toFixed(2)}s`
                              : "—"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="max-w-xs">
                            {activity.metadata &&
                              typeof activity.metadata === "object" && (
                                <div className="text-xs text-slate-600">
                                  {JSON.stringify(activity.metadata)
                                    .replace(/[{}\"]/g, "")
                                    .replace(/,/g, ", ")}
                                </div>
                              )}
                            {activity.errorMessage && (
                              <div className="text-xs text-red-600">
                                {activity.errorMessage}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Showing {(currentPage - 1) * limit + 1} to{" "}
                    {Math.min(currentPage * limit, total)} of {total} activities
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm text-slate-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Compliance Notice */}
        <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Audit Retention Policy:</span> All
            activity logs are retained for 90 days for compliance purposes.
            Enterprise customers can request extended retention periods. For
            questions, contact{" "}
            <a
              href="mailto:compliance@legalredactor.com"
              className="text-slate-900 underline"
            >
              compliance@legalredactor.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
