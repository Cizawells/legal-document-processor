"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { authenticatedFetch } from "@/lib/session";

export default function DebugSubscription() {
  const { data: session, status } = useSession();
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchSubscriptionStatus = async () => {
    if (!session) return;

    setLoading(true);
    try {
      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/lemonsqueezy/subscription-status`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSubscriptionData(data);
        setMessage("Subscription status fetched successfully");
      } else {
        setMessage(`Failed to fetch subscription status: ${response.status}`);
      }
    } catch (error) {
      setMessage(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const activateTrial = async () => {
    if (!session) return;

    setLoading(true);
    try {
      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/lemonsqueezy/activate-trial`,
        { method: 'POST' }
      );
      
      const result = await response.json();
      setMessage(`Trial activation: ${result.message}`);
      
      // Refresh subscription status
      await fetchSubscriptionStatus();
    } catch (error) {
      setMessage(`Error activating trial: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const syncSubscription = async () => {
    if (!session) return;

    setLoading(true);
    try {
      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/lemonsqueezy/sync-subscription`,
        { method: 'POST' }
      );
      
      const result = await response.json();
      setMessage(`Subscription sync: ${result.message}`);
      
      // Refresh subscription status
      await fetchSubscriptionStatus();
    } catch (error) {
      setMessage(`Error syncing subscription: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchSubscriptionStatus();
    }
  }, [session]);

  if (status === "loading") {
    return <div className="p-8">Loading...</div>;
  }

  if (!session) {
    return <div className="p-8">Please sign in to debug subscription</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Subscription Debug Panel</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Info</h2>
          <div className="space-y-2">
            <p><strong>Email:</strong> {session.user?.email}</p>
            <p><strong>Name:</strong> {session.user?.name}</p>
            <p><strong>User ID:</strong> {(session as any)?.user?.id}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-x-4">
            <button
              onClick={fetchSubscriptionStatus}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh Status"}
            </button>
            
            <button
              onClick={activateTrial}
              disabled={loading}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Activate Trial"}
            </button>
            
            <button
              onClick={syncSubscription}
              disabled={loading}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Sync Subscription"}
            </button>
          </div>
        </div>

        {message && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
            {message}
          </div>
        )}

        {subscriptionData && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Subscription Data</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify(subscriptionData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
