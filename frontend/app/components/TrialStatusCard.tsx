"use client";

import React, { useState, useEffect } from "react";
import { Clock, Crown, CheckCircle, AlertTriangle } from "lucide-react";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

interface SubscriptionStatus {
  plan: string;
  status: string;
  isActive: boolean;
  trialEndsAt: string | null;
  daysUntilTrialEnd: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface TrialStatusCardProps {
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

const TrialStatusCard: React.FC<TrialStatusCardProps> = ({ className = "" }) => {
  const { data: session } = useSession();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      try {
        const response = await makeAuthenticatedRequest(
          `${process.env.NEXT_PUBLIC_API_URL}/lemonsqueezy/subscription-status`,
          session
        );
        
        if (response.ok) {
          const data = await response.json();
          setSubscriptionStatus(data);
        }
      } catch (error) {
        console.error("Failed to fetch subscription status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionStatus();
    
    // Refresh every 5 minutes to avoid excessive polling
    const interval = setInterval(fetchSubscriptionStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session?.user?.id]); // Only re-run when user ID changes, not the entire session object

  if (loading) {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-slate-100 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-slate-100 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!subscriptionStatus) return null;

  const getStatusInfo = () => {
    if (subscriptionStatus.status === 'trialing') {
      const daysLeft = subscriptionStatus.daysUntilTrialEnd || 0;
      const isExpiringSoon = daysLeft <= 3;
      
      return {
        icon: isExpiringSoon ? AlertTriangle : Crown,
        title: isExpiringSoon ? 'Trial Expiring Soon!' : 'Free Trial Active',
        description: `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`,
        color: isExpiringSoon ? 'text-amber-600' : 'text-blue-600',
        bgColor: isExpiringSoon ? 'bg-amber-50' : 'bg-blue-50',
        borderColor: isExpiringSoon ? 'border-amber-200' : 'border-blue-200',
      };
    }
    
    if (subscriptionStatus.status === 'active') {
      return {
        icon: CheckCircle,
        title: 'Premium Active',
        description: `${subscriptionStatus.plan} plan`,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    }
    
    return {
      icon: Clock,
      title: 'Free Plan',
      description: 'Upgrade to unlock premium features',
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-200',
    };
  };

  const statusInfo = getStatusInfo();
  const IconComponent = statusInfo.icon;

  return (
    <div className={`bg-white rounded-xl border ${statusInfo.borderColor} p-6 ${className}`}>
      <div className="flex items-start space-x-4">
        <div className={`p-3 ${statusInfo.bgColor} rounded-lg`}>
          <IconComponent className={`w-6 h-6 ${statusInfo.color}`} />
        </div>
        <div className="flex-1">
          <h3 className={`font-semibold ${statusInfo.color} mb-1`}>
            {statusInfo.title}
          </h3>
          <p className="text-sm text-slate-600 mb-3">
            {statusInfo.description}
          </p>
          
          {subscriptionStatus.status === 'trialing' && (
            <div className="space-y-2">
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    (subscriptionStatus.daysUntilTrialEnd || 0) <= 3 
                      ? 'bg-amber-500' 
                      : 'bg-blue-500'
                  }`}
                  style={{ 
                    width: `${Math.max(10, ((subscriptionStatus.daysUntilTrialEnd || 0) / 14) * 100)}%` 
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Trial Progress</span>
                <span>{14 - (subscriptionStatus.daysUntilTrialEnd || 0)} of 14 days used</span>
              </div>
            </div>
          )}
          
          {subscriptionStatus.status === 'active' && subscriptionStatus.currentPeriodEnd && (
            <p className="text-xs text-slate-500">
              Renews {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrialStatusCard;
