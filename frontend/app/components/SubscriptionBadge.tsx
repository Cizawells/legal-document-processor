"use client";

import React, { useState, useEffect } from "react";
import { Crown, Clock, CheckCircle, AlertTriangle } from "lucide-react";
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

interface SubscriptionBadgeProps {
  className?: string;
  showDetails?: boolean;
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

const SubscriptionBadge: React.FC<SubscriptionBadgeProps> = ({ 
  className = "", 
  showDetails = false 
}) => {
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
  }, [session?.user?.id]); // Only re-run when user ID changes, not the entire session object

  if (loading || !subscriptionStatus) return null;

  const getPlanDisplay = () => {
    const plan = subscriptionStatus.plan || 'free';
    
    switch (plan.toLowerCase()) {
      case 'solo':
        return { name: 'Solo Plan', color: 'bg-blue-100 text-blue-800', icon: Crown };
      case 'firm':
        return { name: 'Firm Plan', color: 'bg-purple-100 text-purple-800', icon: Crown };
      case 'enterprise':
        return { name: 'Enterprise', color: 'bg-gold-100 text-gold-800', icon: Crown };
      default:
        return { name: 'Free Plan', color: 'bg-gray-100 text-gray-800', icon: Clock };
    }
  };

  const getStatusDisplay = () => {
    if (subscriptionStatus.status === 'trialing') {
      const daysLeft = subscriptionStatus.daysUntilTrialEnd || 0;
      const isExpiringSoon = daysLeft <= 3;
      
      return {
        text: `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`,
        color: isExpiringSoon ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800',
        icon: isExpiringSoon ? AlertTriangle : CheckCircle
      };
    }
    
    if (subscriptionStatus.status === 'active') {
      return {
        text: 'Active',
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle
      };
    }
    
    return {
      text: 'Free',
      color: 'bg-gray-100 text-gray-800',
      icon: Clock
    };
  };

  const planDisplay = getPlanDisplay();
  const statusDisplay = getStatusDisplay();
  const PlanIcon = planDisplay.icon;
  const StatusIcon = statusDisplay.icon;

  if (!showDetails) {
    // Compact badge version
    return (
      <div className={`inline-flex items-center space-x-2 ${className}`}>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${planDisplay.color}`}>
          <PlanIcon className="w-3 h-3 mr-1" />
          {planDisplay.name}
        </span>
        {subscriptionStatus.status === 'trialing' && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusDisplay.color}`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusDisplay.text}
          </span>
        )}
      </div>
    );
  }

  // Detailed version
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Subscription</h3>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${planDisplay.color}`}>
          <PlanIcon className="w-3 h-3 mr-1" />
          {planDisplay.name}
        </span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Status:</span>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.color}`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusDisplay.text}
          </span>
        </div>
        
        {subscriptionStatus.status === 'trialing' && subscriptionStatus.trialEndsAt && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Trial ends:</span>
              <span className="text-gray-900">
                {new Date(subscriptionStatus.trialEndsAt).toLocaleDateString()}
              </span>
            </div>
            
            {subscriptionStatus.daysUntilTrialEnd !== null && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Trial Progress</span>
                  <span>{14 - subscriptionStatus.daysUntilTrialEnd} of 14 days used</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      subscriptionStatus.daysUntilTrialEnd <= 3 
                        ? 'bg-amber-500' 
                        : 'bg-green-500'
                    }`}
                    style={{ 
                      width: `${Math.max(10, ((14 - subscriptionStatus.daysUntilTrialEnd) / 14) * 100)}%` 
                    }}
                  ></div>
                </div>
              </div>
            )}
          </>
        )}
        
        {subscriptionStatus.status === 'active' && subscriptionStatus.currentPeriodEnd && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Renews:</span>
            <span className="text-gray-900">
              {new Date(subscriptionStatus.currentPeriodEnd).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionBadge;
