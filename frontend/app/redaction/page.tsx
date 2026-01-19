"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import PricingModal from "../components/PricingModal";
import TrialCountdown from "../components/TrialCountdown";
import {
  saveStateBeforeCheckout,
  getRedactionState,
  isReturningFromCheckout,
  clearCheckoutFlag,
  hasStoredState,
  base64ToFile,
} from "@/lib/redactionState";
import { addRecentDocument, updateRecentDocument } from "@/lib/recentDocuments";
import { authenticatedFetch } from "@/lib/session";
import { useFilesContext, UploadFile } from "../context/context";
import {
  ArrowLeft,
  Upload,
  Shield,
  FileSearch,
  Zap,
  X,
  Square,
  MousePointer,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Lock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import Header from "@/components/ui/header";
import ToolPageLayout from "../components/shared/ToolPageLayout";
import UnifiedUploadArea from "../components/shared/UnifiedUploadArea";
import FeatureGrid from "../components/shared/FeatureGrid";
import TrustIndicators from "../components/shared/TrustIndicators";

// Dynamically import the PDF viewer to avoid SSR issues
const ImprovedPDFViewer = dynamic(
  () => import("./components/ImprovedPDFViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    ),
  }
);

interface RedactionArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  type: "text" | "image" | "custom";
  piiType?: string;
  reason?: string;
  isVerified: boolean;
  text?: string;
}

// Using UploadFile type from context instead of local PDFFile interface

function CompletedRedactionPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  console.log("sessssionnnnnnnnnnnnnnn data", session);
  const searchParams = useSearchParams();
  const { files, setFiles, setProcessingResult } = useFilesContext();

  // File management
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);

  // Redaction state
  const [redactionAreas, setRedactionAreas] = useState<RedactionArea[]>([]);
  const [selectedTool, setSelectedTool] = useState<"select" | "redact">(
    "select"
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false); // For mobile sidebar toggle

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadRetryCount, setUploadRetryCount] = useState(0);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  const [detectionResults, setDetectionResults] = useState<any>(null);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showTrialBanner, setShowTrialBanner] = useState(false);
  const [showStateRestored, setShowStateRestored] = useState(false);

  // Guest mode state
  const isGuest = !session?.user;
  const [guestRedactionCount, setGuestRedactionCount] = useState(0);
  const maxGuestRedactions = 3;
  const maxGuestFileSize = 5 * 1024 * 1024; // 5MB in bytes

  // Drawing state (handled by ImprovedPDFViewer component)

  // Guest mode - no auth redirect needed
  // Users can access redaction in guest mode with limitations

  // Auto-upload files from context (e.g., from homepage)
  useEffect(() => {
    if (files.length > 0 && !uploadedFileId && !isUploading) {
      // File exists in context but hasn't been uploaded to backend yet
      const firstFile = files[0];
      console.log("Auto-uploading file from context:", firstFile.name);
      uploadFileToBackend(firstFile).catch(console.error);
    }
  }, [files, uploadedFileId, isUploading]);

  // Handle checkout success and trial start
  useEffect(() => {
    const checkoutSuccess = searchParams.get("checkout_success");
    const trialStarted = searchParams.get("trial_started");

    if (checkoutSuccess === "true" && trialStarted === "true") {
      setShowTrialBanner(true);

      // Restore state if returning from checkout
      if (isReturningFromCheckout() && hasStoredState()) {
        const savedState = getRedactionState();
        console.log("Restoring state after checkout:", savedState);

        // Restore PDF file completely if we have base64 data
        if (savedState.pdfFile && files.length === 0) {
          if (savedState.pdfFile.base64Data) {
            try {
              // Restore the complete PDF file from base64
              const restoredFile = base64ToFile(
                savedState.pdfFile.base64Data,
                savedState.pdfFile.name,
                savedState.pdfFile.type || "application/pdf"
              );

              const pdfFileObj: UploadFile = {
                id: savedState.pdfFile.id,
                file: restoredFile,
                name: savedState.pdfFile.name,
                size: savedState.pdfFile.size,
                pages: Math.floor(Math.random() * 50) + 1, // Add pages property
              };

              setFiles([pdfFileObj]);
              setUploadedFileId(savedState.uploadedFileId);

              console.log("PDF file completely restored from base64");
            } catch (error) {
              console.error("Failed to restore PDF from base64:", error);
              setUploadedFileId(savedState.uploadedFileId);
            }
          } else {
            // Fallback: only restore uploadedFileId
            setUploadedFileId(savedState.uploadedFileId);
          }
        }

        // Restore redaction areas
        setRedactionAreas(savedState.redactionAreas);
        setCurrentPage(savedState.currentPage);
        setTotalPages(savedState.totalPages);
        setDetectionResults(savedState.detectionResults);

        // Show restoration notification
        setShowStateRestored(true);

        clearCheckoutFlag();
      }

      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchParams, files]);

  // File upload handlers
  const handleFileUpload = (uploadedFiles: File[]) => {
    // Clear any previous errors
    setUploadError(null);

    // Validate files
    const validationErrors: string[] = [];
    const validFiles: File[] = [];

    Array.from(uploadedFiles).forEach((file) => {
      // Check file type
      if (file.type !== "application/pdf") {
        validationErrors.push(`\"${file.name}\" is not a PDF file.`);
        return;
      }

      // Check file size (5MB for guests, 50MB for authenticated users)
      const maxSize = isGuest ? maxGuestFileSize : 50 * 1024 * 1024;
      const maxSizeText = isGuest ? "5MB" : "50MB";
      if (file.size > maxSize) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        if (isGuest) {
          validationErrors.push(
            `\"${file.name}\" is ${fileSizeMB}MB, which exceeds the 5MB limit for guest users. Please select a smaller file or sign up for files up to 50MB.`
          );
        } else {
          validationErrors.push(
            `\"${file.name}\" is too large (${fileSizeMB}MB). Maximum size is ${maxSizeText}.`
          );
        }
        return;
      }

      // Check if file is empty
      if (file.size === 0) {
        validationErrors.push(`\"${file.name}\" appears to be empty.`);
        return;
      }

      validFiles.push(file);
    });

    // Show validation errors if any
    if (validationErrors.length > 0) {
      setUploadError(validationErrors.join(" "));
      return;
    }

    if (validFiles.length === 0) {
      setUploadError("Please select a valid PDF file.");
      return;
    }

    const pdfFiles = validFiles.map((file, index) => ({
      id: Date.now().toString() + index,
      file,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
      pages: Math.floor(Math.random() * 50) + 1, // Add pages property for UploadFile type
    }));

    // Batch all state updates to prevent multiple rerenders
    setFiles(pdfFiles);

    // Reset redaction state for new file
    setRedactionAreas([]);
    setCurrentPage(1);
    setTotalPages(1);
    setDetectionResults(null);

    // If we had restored state, hide the restoration notification
    if (showStateRestored) {
      setShowStateRestored(false);
    }

    // Upload to backend in parallel, don't block PDF display
    uploadFileToBackend(pdfFiles[0]).catch(console.error);

    // Add to recent documents
    addRecentDocument({
      id: pdfFiles[0].id,
      name: pdfFiles[0].name,
      size: pdfFiles[0].size,
      uploadedFileId: null, // Will be updated after backend upload
      redactionCount: 0, // Reset for new file
      lastModified: pdfFiles[0].file.lastModified,
    });
  };

  const uploadFileToBackend = async (
    pdfFile: UploadFile,
    retryAttempt: number = 0
  ) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    setShowUploadSuccess(false);

    try {
      // Simulate upload progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 20;
        });
      }, 200);

      const formData = new FormData();
      formData.append("files", pdfFile.file);

      // Use regular fetch for guests, authenticatedFetch for logged-in users
      const response = isGuest
        ? await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/pdfs`, {
            method: "POST",
            body: formData,
          })
        : await authenticatedFetch(
            `${process.env.NEXT_PUBLIC_API_URL}/upload/pdfs`,
            {
              method: "POST",
              body: formData,
            }
          );

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        const data = await response.json();
        const fileId = data.files[0].fileId;
        setUploadedFileId(fileId);
        setUploadRetryCount(0);
        setShowUploadSuccess(true);

        // Update recent document with backend file ID
        updateRecentDocument(pdfFile.id, {
          uploadedFileId: fileId,
        });

        console.log("File uploaded successfully:", fileId);

        // Hide success message after 3 seconds
        setTimeout(() => setShowUploadSuccess(false), 3000);
      } else {
        // Handle HTTP error responses
        let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;

        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          // If we can't parse the response, use the default error message
          console.warn("Could not parse error response:", parseError);
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadProgress(0);

      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";

      // Check if it's a network error and we should retry
      const isNetworkError =
        errorMessage.includes("fetch") ||
        errorMessage.includes("network") ||
        errorMessage.includes("Failed to fetch");

      // Don't retry for 400 Bad Request errors (client errors)
      const is400Error =
        errorMessage.includes("400") ||
        errorMessage.includes("Bad Request") ||
        errorMessage.includes("Guest users are limited to 5MB");

      if (isNetworkError && !is400Error && retryAttempt < 2) {
        // Auto-retry for network errors (up to 2 times), but not for 400 errors
        setUploadRetryCount(retryAttempt + 1);
        setUploadError(`Connection issue. Retrying... (${retryAttempt + 1}/2)`);

        setTimeout(() => {
          uploadFileToBackend(pdfFile, retryAttempt + 1);
        }, 2000);
        return;
      }

      // Set user-friendly error message
      if (errorMessage.includes("Guest users are limited to 5MB")) {
        setUploadError(
          "File is too large for guest users. Please select a PDF under 5MB or sign up for larger file uploads (up to 50MB)."
        );
      } else if (
        errorMessage.includes("413") ||
        errorMessage.includes("too large")
      ) {
        setUploadError("File is too large. Please select a PDF under 50MB.");
      } else if (
        errorMessage.includes("400") ||
        errorMessage.includes("Bad Request")
      ) {
        // Handle other 400 errors
        if (errorMessage.includes("PDF")) {
          setUploadError(
            "Invalid file format. Please select a valid PDF file."
          );
        } else {
          setUploadError(
            errorMessage.includes("Guest users")
              ? errorMessage
              : "Invalid request. Please check your file and try again."
          );
        }
      } else if (isNetworkError) {
        setUploadError(
          "Connection failed. Please check your internet and try again."
        );
      } else {
        setUploadError("Upload failed. Please try again or contact support.");
      }

      setUploadRetryCount(retryAttempt);
    } finally {
      setIsUploading(false);
    }
  };

  const retryUpload = () => {
    if (files.length > 0) {
      uploadFileToBackend(files[0], 0);
    }
  };

  const clearUploadError = () => {
    setUploadError(null);
    setUploadProgress(0);
    setUploadRetryCount(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Auto-detect PII
  const handleAutoDetect = async () => {
    if (!uploadedFileId) {
      alert("Please upload a PDF file first");
      return;
    }

    // For guest users, show pricing modal for Auto-Detect PII
    if (isGuest) {
      console.log(
        "Guest user trying to use Auto-Detect PII, showing pricing modal"
      );
      setShowPricingModal(true);
      return;
    }

    console.log("User is logged in:", session?.user?.email);

    // Check subscription status from backend
    try {
      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/lemonsqueezy/subscription-status`
      );

      if (response.ok) {
        const subscriptionData = await response.json();
        console.log("Subscription data:", subscriptionData);

        // Check if user has active subscription or valid trial
        const hasAccess =
          subscriptionData.isActive === true ||
          subscriptionData.status === "active" ||
          subscriptionData.status === "trialing" ||
          (subscriptionData.trialEndsAt &&
            new Date(subscriptionData.trialEndsAt) > new Date());

        console.log("User has access:", hasAccess);
        console.log("Subscription status:", subscriptionData.status);
        console.log("Is active:", subscriptionData.isActive);
        console.log("Trial ends at:", subscriptionData.trialEndsAt);

        if (hasAccess) {
          // User has access, proceed with PII detection
          console.log("User has access, proceeding with PII detection");
          await performPIIDetection();
          return;
        } else {
          // User doesn't have active subscription, show pricing modal
          console.log("User does not have access, showing pricing modal");
          setShowPricingModal(true);
          return;
        }
      } else {
        console.error(
          "Subscription status check failed:",
          response.status,
          response.statusText
        );
        // API error, assume no access and show pricing modal
        console.log("API error, showing pricing modal as fallback");
        setShowPricingModal(true);
        return;
      }
    } catch (error) {
      console.error("Failed to check subscription status:", error);
      // Network error, assume no access and show pricing modal
      console.log("Network error, showing pricing modal as fallback");
      setShowPricingModal(true);
      return;
    }
  };

  const performPIIDetection = async () => {
    setIsDetecting(true);

    try {
      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/redaction/detect-pii`,
        {
          method: "POST",
          body: JSON.stringify({
            fileId: uploadedFileId,
            categories: [
              "SSN",
              "EMAIL",
              "PHONE",
              "NAME",
              "ADDRESS",
              "CREDIT_CARD",
              "DATE_OF_BIRTH",
            ],
            confidenceThreshold: 0.7,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Add detected areas - convert bbox to x, y, width, height
        const newAreas: RedactionArea[] = data.findings.map((finding: any) => {
          const [x1, y1, x2, y2] = finding.bbox;
          return {
            id: finding.id,
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1,
            page: finding.page,
            type: "text" as const,
            piiType: finding.category,
            isVerified: false,
            text: finding.text || "",
          };
        });

        setRedactionAreas(newAreas);
        setDetectionResults(data.statistics);
      } else if (response.status === 403) {
        setShowPricingModal(true);
      } else if (response.status === 503) {
        alert(
          "PII detection service is not available. Please ensure the Python service is running on port 5001."
        );
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Detection failed" }));
        throw new Error(errorData.message);
      }
    } catch (error) {
      console.error("Detection error:", error);
      if (error instanceof TypeError && error.message.includes("fetch")) {
        alert(
          "Cannot connect to backend service. Please ensure the NestJS server is running on port 5000."
        );
      } else {
        alert(
          `Failed to detect PII: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    } finally {
      setIsDetecting(false);
    }
  };

  // Manual redaction drawing is now handled by ImprovedPDFViewer component

  // Process redaction
  const processRedaction = async () => {
    if (!uploadedFileId || redactionAreas.length === 0) {
      alert("Please mark areas for redaction before processing");
      return;
    }

    const unverified = redactionAreas.filter((a) => !a.isVerified).length;
    if (unverified > 0) {
      if (!confirm(`${unverified} areas are unverified. Continue anyway?`)) {
        return;
      }
    }

    setIsProcessing(true);

    try {
      const requestBody = {
        fileId: uploadedFileId,
        outputName: "redacted-document.pdf",
        areas: redactionAreas.map((area) => ({
          id: area.id,
          page: area.page,
          x: area.x,
          y: area.y,
          width: area.width,
          height: area.height,
          type: area.type || "custom",
          reason: area.reason,
          verified: area.isVerified,
          category: area.piiType,
        })),
        settings: {
          complianceMode: "standard",
          redactionColor: "#000000",
          preserveFormatting: true,
          addWatermark: false,
          removeMetadata: true,
        },
      };

      console.log(
        "Sending redaction request:",
        JSON.stringify(requestBody, null, 2)
      );

      // Use regular fetch for guests, authenticatedFetch for logged-in users
      const response = isGuest
        ? await fetch(`${process.env.NEXT_PUBLIC_API_URL}/redaction`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          })
        : await authenticatedFetch(
            `${process.env.NEXT_PUBLIC_API_URL}/redaction`,
            {
              method: "POST",
              body: JSON.stringify(requestBody),
            }
          );

      if (!response.ok) throw new Error("Redaction failed");

      const data = await response.json();
      setProcessingResult({
        success: true,
        downloadUrl: data.downloadUrl,
        fileName: data.fileName,
        message: "PDFs merged successfully",
      });
      router.push(`/download/${data.fileName}`);
    } catch (error) {
      console.error("Redaction error:", error);
      alert("Failed to process redaction. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Utility functions
  const removeArea = (id: string) => {
    setRedactionAreas((areas) => areas.filter((a) => a.id !== id));
  };

  const toggleVerify = (id: string) => {
    setRedactionAreas((areas) =>
      areas.map((a) => (a.id === id ? { ...a, isVerified: !a.isVerified } : a))
    );
  };

  const verifyAll = () => {
    setRedactionAreas((areas) =>
      areas.map((a) => ({ ...a, isVerified: true }))
    );
  };

  const clearAll = () => {
    if (confirm("Clear all redaction areas?")) {
      setRedactionAreas([]);
      setDetectionResults(null);
      setGuestRedactionCount(0);
    }
  };

  // Guest mode utility functions
  const canAddRedaction = () => {
    if (!isGuest) return true;
    return redactionAreas.length < maxGuestRedactions;
  };

  const addRedactionArea = (area: RedactionArea) => {
    if (isGuest && redactionAreas.length >= maxGuestRedactions) {
      setShowPricingModal(true);
      return false;
    }
    setRedactionAreas((areas) => [...areas, area]);
    if (isGuest) {
      setGuestRedactionCount(redactionAreas.length + 1);
    }
    return true;
  };

  const handleGuestLimitReached = () => {
    setShowPricingModal(true);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
      <Header title="PDF Redaction" />

      {/* Trial Success Banner */}
      {showTrialBanner && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5" />
              <div>
                <p className="font-semibold">
                  🎉 Welcome to your 14-day free trial!
                </p>
                <p className="text-sm opacity-90">
                  You now have full access to Auto-Detect PII and all premium
                  features.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowTrialBanner(false)}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Trial Countdown */}
      <TrialCountdown />

      {/* State Restored Notification */}
      {showStateRestored && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5" />
              <div>
                <p className="font-semibold">
                  🎉 Welcome back! Your work is ready!
                </p>
                <p className="text-sm opacity-90">
                  We've restored your PDF and {redactionAreas.length} redaction
                  area{redactionAreas.length !== 1 ? "s" : ""} from before
                  checkout.
                  <span className="ml-1 font-medium">
                    You can continue exactly where you left off!
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowStateRestored(false)}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Guest Mode Warning */}
      {isGuest && files.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="font-semibold">Guest Mode - Limited Features</p>
                <p className="text-sm opacity-90">
                  You can redact up to {maxGuestRedactions} areas and files
                  under 5MB.
                  <span className="ml-1 font-medium">
                    Sign up for unlimited redactions and Auto-PII detection!
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPricingModal(true)}
              className="bg-white text-amber-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors"
            >
              Upgrade
            </button>
          </div>
        </div>
      )}

      {files.length === 0 ? (
        <div className="min-h-screen bg-white">
          {/* Hero Section - Matching Homepage Style */}
          <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
            <div className="max-w-7xl mx-auto">
              <div className="text-center max-w-4xl mx-auto mb-12">
                <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full mb-6">
                  <FileSearch className="w-6 h-6 text-slate-700" />
                  <span className="text-sm font-semibold text-slate-700">
                    Professional Tool
                  </span>
                </div>
                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                  Secure PDF Redaction
                </h1>
                <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                  Protect sensitive information in legal documents with
                  professional-grade security. Auto-detect PII or manually
                  redact specific areas to ensure complete privacy compliance.
                </p>
              </div>

              {/* Main Content */}
              <div className="space-y-20">
                {/* Upload Error Display */}
                {uploadError && (
                  <div className="max-w-4xl mx-auto mb-8">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-red-800 mb-1">
                            Upload Error
                          </h3>
                          <p className="text-sm text-red-700">{uploadError}</p>
                          {isGuest && uploadError.includes("too large") && (
                            <div className="mt-3 flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={() => setShowPricingModal(true)}
                                className="inline-flex items-center px-3 py-2 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 transition-colors"
                              >
                                Upgrade for 50MB Files
                              </button>
                              <button
                                onClick={() => setUploadError(null)}
                                className="inline-flex items-center px-3 py-2 bg-white text-red-600 text-xs font-medium rounded-md border border-red-300 hover:bg-red-50 transition-colors"
                              >
                                Try Another File
                              </button>
                            </div>
                          )}
                          {!isGuest && uploadError.includes("too large") && (
                            <button
                              onClick={() => setUploadError(null)}
                              className="mt-3 inline-flex items-center px-3 py-2 bg-white text-red-600 text-xs font-medium rounded-md border border-red-300 hover:bg-red-50 transition-colors"
                            >
                              Try Another File
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => setUploadError(null)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload Area */}
                <UnifiedUploadArea
                  onFileUpload={handleFileUpload}
                  title="Upload PDF to Redact"
                  subtitle={`Drag & drop or click to browse • Max ${
                    isGuest ? "5MB" : "50MB"
                  } • Secure Processing`}
                  features={
                    isGuest
                      ? ["Secure", "Manual Redaction", "3 Areas Max"]
                      : ["Secure", "Auto-PII Detection", "HIPAA Compliant"]
                  }
                  primaryColor="from-slate-700 to-slate-900"
                  showCloudOptions={false}
                />

                {/* Features */}
                <FeatureGrid
                  features={[
                    {
                      icon: Zap,
                      title: "Auto-Detect PII",
                      description:
                        "Automatically identify and mark SSNs, emails, phone numbers, addresses, and other sensitive information with AI-powered detection",
                      color: "text-blue-600",
                      badge: "Pro Feature",
                    },
                    {
                      icon: Square,
                      title: "Manual Redaction",
                      description:
                        "Draw precise redaction boxes over any sensitive content you want to permanently remove from your documents",
                      color: "text-green-600",
                      badge: "Free",
                    },
                    {
                      icon: Shield,
                      title: "True Redaction",
                      description:
                        "Permanently remove content from the PDF structure - not just visual covering. Meets legal compliance standards",
                      color: "text-red-600",
                      badge: "Secure",
                    },
                  ]}
                />

                {/* Trust Indicators */}
                <TrustIndicators />
              </div>
            </div>
          </section>
        </div>
      ) : (
        // Redaction Interface
        <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] lg:overflow-hidden">
          {/* Main Canvas Area */}
          <div className="flex-1 flex flex-col bg-white min-h-0">
            {/* Toolbar */}
            <div className="border-b border-slate-200 p-2 sm:p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Tool Selection */}
                  <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1">
                    <button
                      onClick={() => setSelectedTool("select")}
                      className={`flex items-center space-x-1 px-2 sm:px-3 py-2 rounded transition text-xs sm:text-sm ${
                        selectedTool === "select"
                          ? "bg-white shadow-sm"
                          : "hover:bg-slate-200"
                      }`}
                    >
                      <MousePointer className="w-4 h-4" />
                      <span className="font-medium">Select</span>
                    </button>
                    <button
                      onClick={() => setSelectedTool("redact")}
                      className={`flex items-center space-x-1 px-2 sm:px-3 py-2 rounded transition text-xs sm:text-sm ${
                        selectedTool === "redact"
                          ? "bg-red-600 text-white"
                          : "hover:bg-slate-200"
                      }`}
                    >
                      <Square className="w-4 h-4" />
                      <span className="font-medium">Redact</span>
                    </button>
                  </div>

                  {/* Auto-Detect Button */}
                  <button
                    onClick={handleAutoDetect}
                    disabled={isDetecting || isUploading || isGuest}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition disabled:opacity-50 text-xs sm:text-sm whitespace-nowrap ${
                      isGuest
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                    }`}
                  >
                    {isDetecting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Detecting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {isGuest
                            ? "Auto-Detect PII (Pro)"
                            : "Auto-Detect PII"}
                        </span>
                        <span className="sm:hidden">
                          {isGuest ? "Pro Feature" : "Auto-PII"}
                        </span>
                        {(isGuest ||
                          !session?.user?.plan ||
                          session?.user?.plan === "free") && (
                          <Lock className="w-3 h-3" />
                        )}
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center space-x-1 px-2 sm:px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition text-xs sm:text-sm"
                  >
                    {showPreview ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">
                      {showPreview ? "Hide" : "Show"} Preview
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs sm:text-sm text-slate-600">
                    {isGuest ? (
                      <>
                        {redactionAreas.length}/{maxGuestRedactions} areas
                        {redactionAreas.length >= maxGuestRedactions && (
                          <span className="text-amber-600 font-medium ml-1">
                            (Limit reached)
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {redactionAreas.length} area
                        {redactionAreas.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </span>
                  {/* Mobile Sidebar Toggle */}
                  <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="lg:hidden flex items-center space-x-1 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition text-xs sm:text-sm"
                  >
                    <Square className="w-4 h-4" />
                    <span>Areas ({redactionAreas.length})</span>
                  </button>

                  <button
                    onClick={processRedaction}
                    disabled={isProcessing || redactionAreas.length === 0}
                    className="flex items-center space-x-1 px-4 sm:px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold disabled:opacity-50 text-xs sm:text-sm"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          Apply Redaction
                        </span>
                        <span className="sm:hidden">Apply</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Detection Results */}
              {detectionResults && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900">
                        Found {detectionResults.total} PII instances
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        Review and verify each area before applying redactions
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PDF Viewer with Thumbnails */}
            <div className="flex-1 min-h-0">
              {/* Upload Progress/Error States */}
              {isUploading && (
                <div className="h-full flex items-center justify-center bg-slate-50">
                  <div className="text-center max-w-md mx-auto p-8">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                      <div
                        className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"
                        style={{
                          background: `conic-gradient(from 0deg, #2563eb ${
                            uploadProgress * 3.6
                          }deg, transparent ${uploadProgress * 3.6}deg)`,
                        }}
                      ></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-semibold text-slate-700">
                          {Math.round(uploadProgress)}%
                        </span>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {uploadRetryCount > 0
                        ? `Retrying Upload (${uploadRetryCount}/2)`
                        : "Uploading PDF"}
                    </h3>
                    <p className="text-slate-600 mb-4">
                      {uploadRetryCount > 0
                        ? "Connection issue detected, retrying automatically..."
                        : "Please wait while we securely upload your document"}
                    </p>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Error State */}
              {uploadError && !isUploading && (
                <div className="h-full flex items-center justify-center bg-slate-50">
                  <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      Upload Failed
                    </h3>
                    <p className="text-slate-600 mb-6">{uploadError}</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        onClick={retryUpload}
                        className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Try Again</span>
                      </button>
                      <button
                        onClick={() => {
                          clearUploadError();
                          setFiles([]);
                        }}
                        className="inline-flex items-center space-x-2 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
                      >
                        <X className="w-4 h-4" />
                        <span>Choose Different File</span>
                      </button>
                    </div>
                    {uploadRetryCount > 0 && (
                      <p className="text-xs text-slate-500 mt-4">
                        Attempted {uploadRetryCount + 1} time
                        {uploadRetryCount > 0 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Upload Success State */}
              {showUploadSuccess && !isUploading && !uploadError && (
                <div className="absolute top-4 right-4 z-10">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 shadow-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-900">
                        File uploaded successfully!
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* PDF Viewer */}
              {!isUploading &&
              !uploadError &&
              files.length > 0 &&
              files[0].file ? (
                <div className="transition-all duration-300 ease-in-out">
                  <ImprovedPDFViewer
                    file={files[0].file}
                    selectedTool={selectedTool}
                    redactionAreas={redactionAreas}
                    onRedactionAreasChange={(areas) => {
                      // Handle guest limits when adding redaction areas
                      if (
                        isGuest &&
                        areas.length > redactionAreas.length &&
                        areas.length > maxGuestRedactions
                      ) {
                        handleGuestLimitReached();
                        return;
                      }
                      setRedactionAreas(areas);
                    }}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    showPreview={showPreview}
                    redactionColor="#000000"
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center bg-slate-50">
                  <div className="text-center">
                    <FileSearch className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">No PDF loaded</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Floating Toggle Button for Redaction Sidebar - Tablet/Mobile */}
          {!showSidebar && (
            <button
              onClick={() => setShowSidebar(true)}
              className="lg:hidden fixed bottom-20 md:bottom-6 right-4 z-30 p-3 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-all hover:scale-110"
              title="Show redaction areas"
            >
              <div className="relative">
                <Square className="w-6 h-6" />
                {redactionAreas.length > 0 && (
                  <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {redactionAreas.length}
                  </div>
                )}
              </div>
            </button>
          )}

          {/* Mobile Backdrop Overlay */}
          {showSidebar && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity duration-300"
              onClick={() => setShowSidebar(false)}
            />
          )}

          {/* Right Sidebar - Redaction Areas */}
          <div
            className={`
            fixed lg:relative inset-0 lg:inset-auto z-50 lg:z-auto
            w-full lg:w-80 bg-white 
            border-t lg:border-t-0 lg:border-l border-slate-200 
            flex flex-col 
            transition-transform duration-300 ease-in-out
            ${
              showSidebar
                ? "translate-y-0"
                : "translate-y-full lg:translate-y-0"
            }
            lg:max-h-none
          `}
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">
                  Redaction Areas
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  {redactionAreas.length} total •{" "}
                  {redactionAreas.filter((a) => a.isVerified).length} verified
                </p>
              </div>
              {/* Close button for mobile */}
              <button
                onClick={() => setShowSidebar(false)}
                className="lg:hidden text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {redactionAreas.filter((a) => !a.isVerified).length > 0 && (
              <div className="p-4 bg-yellow-50 border-b border-yellow-200">
                <div className="flex items-start space-x-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    {redactionAreas.filter((a) => !a.isVerified).length} areas
                    need verification
                  </p>
                </div>
                <button
                  onClick={verifyAll}
                  className="w-full px-3 py-2 bg-yellow-600 text-white rounded text-sm font-medium hover:bg-yellow-700 transition"
                >
                  Verify All
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {redactionAreas.length === 0 ? (
                <div className="text-center py-12">
                  <Square className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No areas marked yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Use the redact tool or auto-detect
                  </p>
                </div>
              ) : (
                redactionAreas.map((area, index) => (
                  <div
                    key={area.id}
                    className={`p-3 border rounded-lg ${
                      area.isVerified
                        ? "border-green-200 bg-green-50"
                        : "border-yellow-200 bg-yellow-50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            area.type === "text"
                              ? "bg-blue-500"
                              : "bg-slate-500"
                          }`}
                        />
                        <span className="text-sm font-medium text-slate-900">
                          Area {index + 1}
                        </span>
                        {area.isVerified && (
                          <ShieldCheck className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <button
                        onClick={() => removeArea(area.id)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 mb-2">
                      <div>Page {area.page}</div>
                      {area.piiType && (
                        <div className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {area.piiType.toUpperCase()}
                        </div>
                      )}
                    </div>

                    {!area.isVerified && (
                      <button
                        onClick={() => toggleVerify(area.id)}
                        className="w-full px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition"
                      >
                        Verify
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {redactionAreas.length > 0 && (
              <div className="p-4 border-t border-slate-200">
                <button
                  onClick={clearAll}
                  className="w-full px-3 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 transition text-sm font-medium"
                >
                  Clear All Areas
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        feature="Auto-Detect PII"
        onCheckoutStart={async () => {
          // Save current state before checkout
          const currentFile = files[0]?.file || null;
          const currentFileInfo = files[0]
            ? {
                id: files[0].id,
                name: files[0].name,
                size: files[0].size,
              }
            : null;

          await saveStateBeforeCheckout(
            currentFile,
            currentFileInfo,
            uploadedFileId,
            redactionAreas,
            currentPage,
            totalPages,
            detectionResults
          );
        }}
      />
    </div>
  );
}

// Wrap the component in Suspense to handle useSearchParams() SSR
export default function RedactionPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      }
    >
      <CompletedRedactionPage />
    </Suspense>
  );
}
