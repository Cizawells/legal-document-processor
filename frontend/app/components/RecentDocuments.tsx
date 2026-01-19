"use client";

import React, { useState, useEffect } from "react";
import { FileText, Clock, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

interface RecentDocument {
  id: string;
  name: string;
  size: string;
  type: string;
  lastModified: number;
  timestamp: number;
  redactionCount: number;
  fileId?: string;
}

interface RecentDocumentsProps {
  className?: string;
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

const RecentDocuments: React.FC<RecentDocumentsProps> = ({ className = "" }) => {
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    const loadRecentDocs = async () => {
      if (status === "loading") return;
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await makeAuthenticatedRequest(
          `${process.env.NEXT_PUBLIC_API_URL}/activity/recent-documents?limit=10`,
          session
        );
        
        if (response.ok) {
          const docs = await response.json();
          setRecentDocs(docs);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (err) {
        console.error('Failed to load recent documents:', err);
        setError('Failed to load recent documents');
        setRecentDocs([]);
      } finally {
        setLoading(false);
      }
    };

    loadRecentDocs();
  }, [session?.user?.id, status]); // Only re-fetch when user ID changes, not entire session object

  const handleOpenDocument = (doc: RecentDocument) => {
    // Navigate to redaction page with file context if available
    if (doc.fileId) {
      router.push(`/redaction?fileId=${doc.fileId}`);
    } else {
      router.push('/redaction');
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-slate-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Recent Documents</h3>
          <Clock className="w-5 h-5 text-slate-400" />
        </div>
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Sign in to view recent documents</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Recent Documents</h3>
          <Clock className="w-5 h-5 text-slate-400" />
        </div>
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Recent Documents</h3>
        <Clock className="w-5 h-5 text-slate-400" />
      </div>

      {recentDocs.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No recent documents</p>
          <p className="text-slate-400 text-xs mt-1">
            Documents you work on will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recentDocs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => handleOpenDocument(doc)}
              className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0">
                  <FileText className="w-8 h-8 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-900 truncate">
                    {doc.name}
                  </h4>
                  <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                    <span>{doc.size}</span>
                    <span>•</span>
                    <span>{doc.redactionCount} redaction{doc.redactionCount !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(doc.timestamp)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDocument(doc);
                  }}
                  className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                  title="Open document"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recentDocs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <button
            onClick={() => router.push('/redaction')}
            className="w-full text-center text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            Start new redaction →
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentDocuments;
