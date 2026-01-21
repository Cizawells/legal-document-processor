"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useFilesContext } from "./context/context";
import { getBatchPdfPageCounts } from "@/lib/pdfUtils";
import {
  Shield,
  FileSearch,
  Lock,
  CheckCircle,
  ArrowRight,
  Zap,
  Users,
  Scale,
  Upload,
  ChevronRight,
  FileText,
  Scissors,
  Archive,
  FileImage,
  Plus,
  User,
  LogOut,
  Crown,
  Check,
  Star,
} from "lucide-react";
import { AuthButtons } from "@/components/auth/AuthButtons";
import PricingModal from "./components/PricingModal";

export default function LegalRedactorHomepage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { files, setFiles } = useFilesContext();
  console.log("sesssssion", session);

  // Check for pending upgrades and refresh session
  useEffect(() => {
    const checkPendingUpgrade = async () => {
      if (typeof window !== "undefined") {
        const pendingUpgrade = window.localStorage.getItem("pendingUpgrade");
        if (pendingUpgrade === "true" && session?.user) {
          // Remove the flag
          window.localStorage.removeItem("pendingUpgrade");

          // Force session refresh
          console.log("Refreshing session after upgrade...");
          await update();

          // Also force a page reload as backup
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      }
    };

    // Check when component mounts and when session changes
    if (status === "authenticated") {
      checkPendingUpgrade();
    }
  }, [session, status, update]);

  // Helper functions to determine user's current plan status
  const isAuthenticated = !!session?.user;
  const userPlan = session?.user?.plan || "free";
  const isFreePlan = userPlan === "free" || !session?.user?.plan;
  const isProfessionalPlan =
    userPlan === "professional" || userPlan === "pro" || userPlan === "solo";
  console.log("plaaaaaaaaaaaaaaaaaaaaaaaaan", session, userPlan, isFreePlan);
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

  // Handle subscription for authenticated users
  const handleSubscribe = async () => {
    try {
      // Import the subscription functions
      const { createCheckoutSession, LEMONSQUEEZY_VARIANTS } =
        await import("@/lib/stripe");

      const variantId = LEMONSQUEEZY_VARIANTS["solo"];
      if (!variantId) {
        alert("LemonSqueezy is not configured. Please contact support.");
        return;
      }

      // Store callback to refresh session after successful checkout
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pendingUpgrade", "true");
      }

      await createCheckoutSession(variantId);
    } catch (error) {
      console.error("Subscription error:", error);
      alert("Failed to start checkout. Please try again.");
    }
  };

  const pdfTools = [
    {
      name: "Merge PDF",
      icon: Plus,
      url: "/merge_pdf",
      color: "bg-blue-50 text-blue-600",
    },
    {
      name: "Split PDF",
      icon: Scissors,
      url: "/pdf_to_split",
      color: "bg-green-50 text-green-600",
    },
    {
      name: "Compress PDF",
      icon: Archive,
      url: "/compression",
      color: "bg-purple-50 text-purple-600",
    },
    {
      name: "PDF to Word",
      icon: FileText,
      url: "/pdf_to_word",
      color: "bg-orange-50 text-orange-600",
    },
    {
      name: "PDF to PowerPoint",
      icon: FileImage,
      url: "/pdf_to_powerpoint",
      color: "bg-pink-50 text-pink-600",
    },
  ];

  // File upload handlers
  const handleMainFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(Array.from(e.target.files), "redaction");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(Array.from(e.dataTransfer.files), "redaction");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileUpload = async (
    uploadedFiles: File[],
    intent: string = "redaction",
  ) => {
    const validFiles = Array.from(uploadedFiles).filter(
      (file) => file.type === "application/pdf",
    );

    // Get actual page counts for all valid files
    const pageCounts = await getBatchPdfPageCounts(validFiles);

    const pdfFiles = validFiles.map((file, index) => ({
      id: Date.now().toString() + index,
      file,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
      pages: pageCounts[index],
    }));

    if (pdfFiles.length > 0) {
      // Clear existing files and add new ones
      setFiles(pdfFiles);

      // Route based on intent
      const routeMap: { [key: string]: string } = {
        redaction: "/redaction",
        merge: "/merge_pdf",
        split: "/pdf_to_split",
        compress: "/compression",
        convert: "/pdf_to_word",
      };

      const targetRoute = routeMap[intent] || "/redaction";
      router.push(targetRoute);
    } else {
      alert("Please select a valid PDF file.");
    }
  };

  const faqs = [
    {
      q: "How secure is my data?",
      a: "All files are encrypted in transit (SSL) and at rest. Files are automatically deleted after 24 hours and never stored permanently.",
    },
    {
      q: "What file formats do you support?",
      a: "We currently support PDF files up to 100MB. We're working on adding support for Word documents and images.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes, you can cancel your subscription anytime. No questions asked, no cancellation fees.",
    },
    {
      q: "Do you offer refunds?",
      a: "Yes, we offer a 14-day money-back guarantee if you're not satisfied with our service.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">
                LegalRedactor
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-slate-600 hover:text-slate-900 font-medium"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-slate-600 hover:text-slate-900 font-medium"
              >
                Pricing
              </a>
              <a
                href="#tools"
                className="text-slate-600 hover:text-slate-900 font-medium"
              >
                Tools
              </a>
              <AuthButtons />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full mb-6">
              <Scale className="w-4 h-4 text-slate-700" />
              <span className="text-sm font-semibold text-slate-700">
                Built for Legal Professionals
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Redact Legal Documents
              <br />
              <span className="text-slate-600">10x Faster</span>
            </h1>

            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Automatic PII detection, bulk processing, and HIPAA-compliant
              redaction for law firms. Stop wasting hours on manual redaction or
              paying $5/page to outsource it.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              {session ? (
                <>
                  {isProfessionalPlan ? (
                    <>
                      <a
                        href="/redaction"
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition shadow-lg"
                      >
                        <Crown className="w-5 h-5" />
                        Start Redacting (Pro)
                        <ArrowRight className="w-5 h-5" />
                      </a>
                      <a
                        href="/dashboard"
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-slate-200 text-slate-900 rounded-lg font-semibold hover:border-slate-300 hover:bg-slate-50 transition"
                      >
                        View Dashboard
                      </a>
                    </>
                  ) : (
                    <>
                      <a
                        href="/dashboard"
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition"
                      >
                        Go to Dashboard
                        <ArrowRight className="w-5 h-5" />
                      </a>
                      <a
                        href="/redaction"
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-slate-200 text-slate-900 rounded-lg font-semibold hover:border-slate-300 hover:bg-slate-50 transition"
                      >
                        Try Redaction Tool
                        <FileSearch className="w-5 h-5" />
                      </a>
                    </>
                  )}
                </>
              ) : (
                <>
                  <a
                    href="/auth/signup"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition"
                  >
                    Start Free Trial
                    <ArrowRight className="w-5 h-5" />
                  </a>
                  <a
                    href="/redaction"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-slate-200 text-slate-900 rounded-lg font-semibold hover:border-slate-300 hover:bg-slate-50 transition"
                  >
                    Try Redaction Tool
                    <FileSearch className="w-5 h-5" />
                  </a>
                </>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Smart Upload Area */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg border-2 border-slate-200 p-8">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition cursor-pointer ${
                  isDragOver
                    ? "border-slate-900 bg-slate-50 shadow-lg"
                    : "border-slate-300 hover:border-slate-400"
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() =>
                  document.getElementById("main-file-input")?.click()
                }
              >
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition ${
                    isDragOver
                      ? "bg-slate-900"
                      : "bg-gradient-to-br from-slate-700 to-slate-900"
                  }`}
                >
                  <Upload className="w-8 h-8 text-white" />
                </div>
                <p className="text-xl font-bold text-slate-900 mb-2">
                  {isDragOver
                    ? "Drop to start redacting"
                    : "Upload PDF to Redact"}
                </p>
                <p className="text-sm text-slate-600 mb-4">
                  {isDragOver
                    ? "We'll automatically detect sensitive information"
                    : "Drag & drop or click to browse • Max 100MB"}
                </p>
                <div className="flex items-center justify-center space-x-4 text-xs text-slate-500">
                  <div className="flex items-center space-x-1">
                    <Shield className="w-3 h-3" />
                    <span>Secure</span>
                  </div>
                  <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                  <div className="flex items-center space-x-1">
                    <Zap className="w-3 h-3" />
                    <span>Auto-PII Detection</span>
                  </div>
                  <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                  <div className="flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>HIPAA Compliant</span>
                  </div>
                </div>
              </div>
              <input
                id="main-file-input"
                type="file"
                accept=".pdf"
                onChange={handleMainFileUpload}
                className="hidden"
              />
            </div>

            {/* Alternative Actions */}
            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600 mb-3">
                Or choose a specific tool:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => router.push("/merge_pdf")}
                  className="inline-flex items-center space-x-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  <span>Merge</span>
                </button>
                <button
                  onClick={() => router.push("/pdf_to_split")}
                  className="inline-flex items-center space-x-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm font-medium"
                >
                  <Scissors className="w-4 h-4" />
                  <span>Split</span>
                </button>
                <button
                  onClick={() => router.push("/compression")}
                  className="inline-flex items-center space-x-1 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition text-sm font-medium"
                >
                  <Archive className="w-4 h-4" />
                  <span>Compress</span>
                </button>
                <button
                  onClick={() => router.push("/pdf_to_word")}
                  className="inline-flex items-center space-x-1 px-3 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition text-sm font-medium"
                >
                  <FileText className="w-4 h-4" />
                  <span>Convert</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              The Redaction Problem
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Law firms waste thousands of hours and dollars on manual redaction
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center p-8 bg-slate-50 rounded-xl">
              <div className="text-5xl mb-4">⏱️</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Hours Wasted
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Manual redaction takes 2-5 minutes per page. For 100-page
                documents, that's 3-8 hours of billable time lost.
              </p>
            </div>

            <div className="text-center p-8 bg-slate-50 rounded-xl">
              <div className="text-5xl mb-4">💰</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Expensive Outsourcing
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Redaction services charge $2-5 per page. A single 100-page
                document costs $200-500 to outsource.
              </p>
            </div>

            <div className="text-center p-8 bg-slate-50 rounded-xl">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Compliance Risk
              </h3>
              <p className="text-slate-600 leading-relaxed">
                One missed SSN or client name can lead to bar complaints,
                sanctions, or malpractice claims.
              </p>
            </div>
          </div>

          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-2xl font-bold text-slate-900">
              <span>LegalRedactor Solution:</span>
              <span className="text-green-600">$0.20/page</span>
              <span className="text-slate-400">•</span>
              <span className="text-green-600">10 seconds/page</span>
              <span className="text-slate-400">•</span>
              <span className="text-green-600">99.9% accuracy</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Automated Redaction Features
            </h2>
            <p className="text-xl text-slate-600">
              Everything you need to redact documents quickly and compliantly
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
              <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mb-4">
                <FileSearch className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Auto-Detect PII
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Automatically find SSNs, credit cards, addresses, phone numbers,
                and email addresses across all pages.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
              <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Bulk Processing
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Process 100+ discovery documents at once. Apply the same
                redaction rules to entire document sets.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
              <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Audit Trails
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Complete logs of who redacted what and when. Perfect for
                compliance and discovery requirements.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
              <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                HIPAA Compliant
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Files automatically deleted after 24 hours. End-to-end
                encryption. Zero-knowledge processing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Choose the plan that fits your needs. No hidden fees. Cancel
              anytime.
            </p>
            <button
              onClick={() => setShowPricingModal(true)}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition text-lg"
            >
              View All Plans & Pricing
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Pricing Overview */}
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div
              className={`text-center p-8 rounded-xl hover:shadow-lg transition relative ${
                isAuthenticated && isFreePlan
                  ? "bg-green-50 border-2 border-green-300"
                  : "bg-slate-50"
              }`}
            >
              {isAuthenticated && isFreePlan && (
                <div className="absolute -top-3 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Current Plan
                </div>
              )}
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Free</h3>
              <div className="text-4xl font-bold text-slate-900 mb-3">$0</div>
              <p className="text-slate-600 mb-6">
                Perfect for trying professional redaction
              </p>
              <ul className="text-sm text-slate-600 space-y-2 mb-6">
                <li className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  50 redactions per month
                </li>
                <li className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Files up to 20MB
                </li>
                <li className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Manual text selection
                </li>
                <li className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  24-hour file retention
                </li>
              </ul>
              {(() => {
                const freeButtonContent = getPlanButtonContent("free");
                return (
                  <button
                    onClick={
                      freeButtonContent.disabled
                        ? undefined
                        : () => router.push("/auth/signup")
                    }
                    disabled={freeButtonContent.disabled}
                    className={`w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
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

            <div
              className={`text-center p-8 rounded-xl border-2 relative hover:shadow-xl transition ${
                isAuthenticated && isProfessionalPlan
                  ? "bg-green-50 border-green-300"
                  : "bg-blue-50 border-blue-500"
              }`}
            >
              {isAuthenticated && isProfessionalPlan ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Crown className="w-3 h-3" />
                  Current Plan
                </div>
              ) : (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                  <span>⭐</span>
                  Most Popular
                </div>
              )}
              <h3 className="text-2xl font-bold text-slate-900 mb-3">
                Professional
              </h3>
              <div className="text-4xl font-bold text-slate-900 mb-3">
                $19<span className="text-lg text-slate-600">/mo</span>
              </div>
              <p className="text-slate-600 mb-6">
                Everything you need for professional redaction
              </p>
              <ul className="text-sm text-slate-600 space-y-2 mb-6">
                <li className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <strong>Unlimited redactions</strong>
                </li>
                <li className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Files up to 100MB
                </li>
                <li className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <strong>Auto-PII detection</strong>
                </li>
                <li className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <strong>Priority processing (2x faster)</strong>
                </li>
                <li className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  API access & audit logs
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
                            ? handleSubscribe
                            : () =>
                                router.push("/auth/signup?plan=professional")
                      }
                      disabled={proButtonContent.disabled}
                      className={`w-full py-3 rounded-lg font-semibold transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2 ${
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
                      <p className="text-xs text-slate-500 mt-2">
                        14-day free trial, no credit card required
                      </p>
                    )}
                    {proButtonContent.variant === "current" && (
                      <p className="text-xs text-green-600 mt-2 font-medium">
                        ✓ You're on the Professional plan
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-slate-500">
              All plans include 14-day free trial • No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* Additional PDF Tools Section */}
      <section id="tools" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Complete PDF Toolkit Included
            </h2>
            <p className="text-lg text-slate-600">
              All plans include access to our full suite of PDF tools
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {pdfTools.map((tool) => (
              <div
                key={tool.name}
                className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-lg hover:border-slate-300 transition group cursor-pointer"
                onClick={() => {
                  // Create file input for this specific tool
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf";
                  input.multiple = tool.name === "Merge PDF";
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    if (target.files && target.files.length > 0) {
                      const intent =
                        tool.name === "Merge PDF"
                          ? "merge"
                          : tool.name === "Split PDF"
                            ? "split"
                            : tool.name === "Compress PDF"
                              ? "compress"
                              : tool.name === "PDF to Word"
                                ? "convert"
                                : "redaction";
                      handleFileUpload(Array.from(target.files), intent);
                    }
                  };
                  input.click();
                }}
              >
                <div
                  className={`w-12 h-12 ${tool.color} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition`}
                >
                  <tool.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">
                  {tool.name}
                </h3>
                <div className="flex items-center gap-1 text-sm text-slate-500 group-hover:text-slate-700">
                  <span>
                    Upload &{" "}
                    {tool.name === "Merge PDF"
                      ? "merge"
                      : tool.name === "Split PDF"
                        ? "split"
                        : tool.name === "Compress PDF"
                          ? "compress"
                          : "convert"}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-slate-200 rounded-lg">
                <button
                  onClick={() =>
                    setActiveFaq(activeFaq === index ? null : index)
                  }
                  className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-slate-50 transition"
                >
                  <span className="font-semibold text-slate-900">{faq.q}</span>
                  <ChevronRight
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      activeFaq === index ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {activeFaq === index && (
                  <div className="px-6 pb-4 text-slate-600 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section. */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Transform Your Redaction Workflow?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join law firms saving 20+ hours per week on document redaction
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {session ? (
              <>
                <a
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-lg font-semibold hover:bg-slate-100 transition"
                >
                  Go to Dashboard
                  <ArrowRight className="w-5 h-5" />
                </a>
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white text-white rounded-lg font-semibold hover:bg-white hover:text-slate-900 transition"
                >
                  Schedule Demo
                </a>
              </>
            ) : (
              <>
                <a
                  href="/auth/signup"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-lg font-semibold hover:bg-slate-100 transition"
                >
                  Start Your Free Trial
                  <ArrowRight className="w-5 h-5" />
                </a>
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-white text-white rounded-lg font-semibold hover:bg-white hover:text-slate-900 transition"
                >
                  Schedule Demo
                </a>
              </>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-6">
            14-day free trial • No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-slate-900">
                  LegalRedactor
                </span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Professional redaction software built for legal professionals
                who demand security and compliance.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#features"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="/redaction"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Redaction Tool
                  </a>
                </li>
                <li>
                  <a
                    href="#tools"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    PDF Tools
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="/about"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="/contact"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <a
                    href="/privacy"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Privacy
                  </a>
                </li>
                <li>
                  <a
                    href="/terms"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Terms
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="/blog"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    href="/docs"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="/support"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Support
                  </a>
                </li>
                <li>
                  <a
                    href="/security"
                    className="text-slate-600 hover:text-slate-900"
                  >
                    Security
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-600">
            <p>
              © 2025 LegalRedactor. Built by{" "}
              <a
                href="https://twitter.com/cizawells"
                className="underline hover:text-slate-900"
              >
                Ciza Wells
              </a>
            </p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-600" />
                256-bit Encryption
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                HIPAA Compliant
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        feature="professional redaction tools"
      />
    </div>
  );
}
