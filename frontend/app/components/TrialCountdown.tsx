"use client";

import React, { useState, useEffect } from "react";
import { Clock, Crown, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { authenticatedFetch } from "@/lib/session";

interface TrialCountdownProps {
  className?: string;
}

interface SubscriptionStatus {
  plan: string;
  status: string;
  isActive: boolean;
  trialEndsAt: string | null;
  daysUntilTrialEnd: number | null;
}

const TrialCountdown: React.FC<TrialCountdownProps> = ({ className = "" }) => {
  const { data: session } = useSession();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!session?.user) {
        setLoading(false);
        return;
      }

      try {
        const response = await authenticatedFetch(
          `${process.env.NEXT_PUBLIC_API_URL}/lemonsqueezy/subscription-status`
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
    
    // Refresh every 5 minutes to keep data current
    const interval = setInterval(fetchSubscriptionStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session?.user?.id]); // Only re-run when user ID changes, not the entire session object

  if (loading || !subscriptionStatus || !isVisible) return null;

  // Only show for users in trial period
  if (subscriptionStatus.status !== 'trialing' && subscriptionStatus.daysUntilTrialEnd === null) {
    return null;
  }

  const daysLeft = subscriptionStatus.daysUntilTrialEnd || 0;
  const isExpiringSoon = daysLeft <= 3;

  return (
    <div className={`bg-gradient-to-r ${
      isExpiringSoon 
        ? 'from-amber-500 to-orange-600' 
        : 'from-blue-500 to-purple-600'
    } text-white px-4 py-3 ${className}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {isExpiringSoon ? (
            <Clock className="w-5 h-5 animate-pulse" />
          ) : (
            <Crown className="w-5 h-5" />
          )}
          <div>
            <p className="font-semibold">
              {isExpiringSoon 
                ? `⚠️ Trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}!`
                : `🎉 ${daysLeft} days left in your free trial`
              }
            </p>
            <p className="text-sm opacity-90">
              {isExpiringSoon 
                ? 'Upgrade now to continue using premium features'
                : 'Enjoying the premium features? Upgrade to keep them forever'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {isExpiringSoon && (
            <button
              onClick={() => window.location.href = '/redaction'}
              className="bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-sm"
            >
              Upgrade Now
            </button>
          )}
          <button
            onClick={() => setIsVisible(false)}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialCountdown;
