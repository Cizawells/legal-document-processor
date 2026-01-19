"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useFilesContext } from "../context/context";
import { authenticatedFetch } from "@/lib/session";
import {
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  Info,
  Archive,
  Shield,
  Zap,
  FileText,
  X,
  Plus,
} from "lucide-react";
import Header from "@/components/ui/header";
import PricingModal from "@/app/components/PricingModal";

interface CompressionResult {
  message: string;
  status: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionLevel: string;
  downloadUrl: string;
  originalSizeFormatted: string;
  compressedSizeFormatted: string;
  uploadedSize?: number;
  uploadedSizeFormatted?: string;
}

type CompressionLevel = "low" | "medium" | "high";

const compressionLevels: Record<
  CompressionLevel,
  { label: string; description: string; quality: string }
> = {
  high: {
    label: "High Quality",
    description: "Minimal compression, best quality (90% image quality)",
    quality: "Best for documents with important images",
  },
  medium: {
    label: "Medium Quality",
    description: "Balanced compression and quality (70% image quality)",
    quality: "Recommended for most documents",
  },
  low: {
    label: "Maximum Compression",
    description: "Highest compression, smaller file size (50% image quality)",
    quality: "Best for large files or web sharing",
  },
};

export default function CompressionPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { setFiles, processingResult, setProcessingResult } = useFilesContext();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [compressionLevel, setCompressionLevel] =
    useState<CompressionLevel>("medium");
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      setResult(null);
      setError(null);
    } else {
      setError("Please select a valid PDF file");
    }
  }, []);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    onDrop(droppedFiles);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileUpload = (uploadedFiles: File[]) => {
    const file = uploadedFiles[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      setResult(null);
      setError(null);
    } else {
      setError("Please select a valid PDF file");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const uploadWithProgress = (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("files", file); // Use 'files' field name for the pdfs endpoint

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const uploadProgress = Math.round((event.loaded / event.total) * 50); // Upload is 50% of total progress
          setProgress(uploadProgress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            // Extract the first file from the files array since we're uploading only one
            const uploadedFile = response.files && response.files[0];
            if (uploadedFile) {
              resolve(uploadedFile);
            } else {
              reject(new Error("No file data received"));
            }
          } catch (e) {
            reject(new Error("Invalid response format"));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.message || "Upload failed"));
          } catch (e) {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed"));
      });

      xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL}/upload/pdfs`);
      
      // Add authentication headers for logged-in users
      if (session?.user) {
        xhr.setRequestHeader("X-User-Id", session.user.id || "");
        xhr.setRequestHeader("X-User-Email", session.user.email || "");
      }
      
      xhr.send(formData);
    });
  };

  const compressPdf = async () => {
    if (!selectedFile) return;

    setIsCompressing(true);
    setError(null);
    setProgress(0);

    try {
      // Step 1: Upload file with real progress tracking
      const uploadData = await uploadWithProgress(selectedFile);
      setProgress(50);

      // Step 2: Compress the uploaded file
      const userAuthenticated = session?.user;
      const compressResponse = userAuthenticated
        ? await authenticatedFetch(
            `${process.env.NEXT_PUBLIC_API_URL}/compression`,
            {
              method: "POST",
              body: JSON.stringify({
                fileId: uploadData.fileId,
                compressionLevel: compressionLevel,
              }),
            }
          )
        : await fetch(`${process.env.NEXT_PUBLIC_API_URL}/compression`, {
            credentials: "include", // VERY IMPORTANT for guest sessions
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileId: uploadData.fileId,
              compressionLevel: compressionLevel,
            }),
          });

      setProgress(90);

      if (!compressResponse.ok) {
        // Parse error response to get the actual message
        const errorData = await compressResponse.json().catch(() => ({}));
        const error = new Error(
          errorData.message || `Compression failed: ${compressResponse.statusText}`
        );
        (error as any).status = compressResponse.status;
        (error as any).data = errorData;
        throw error;
      }

      const compressData = await compressResponse.json();

      // Add original file info to result
      const result: CompressionResult = {
        ...compressData,
        uploadedSize: uploadData.size,
        uploadedSizeFormatted: formatFileSize(uploadData.size),
      };

      setResult(result);
      setProgress(100);

      // Set processing result for download page
      setProcessingResult({
        success: true,
        downloadUrl: result.downloadUrl,
        fileName: result.fileName,
        message: "PDF compressed successfully",
      });

      // Redirect to download page
      router.push(`/download/${result.fileName}`);

      // Track analytics
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "pdf_compression_success", {
          compression_level: compressionLevel,
          original_size: uploadData.size,
          compressed_size: result.compressedSize,
          compression_ratio: result.compressionRatio,
        });
      }
    } catch (error: any) {
      // Check if it's a guest limit error (400 or 403 status)
      if (error?.status === 400 || error?.status === 403) {
        const errorMessage =
          error.data?.message ||
          error.message ||
          "You've reached the guest limit. Please upgrade to continue.";

        // Show pricing modal immediately for guest limit errors
        setShowPricingModal(true);

        // Also set the error state in case user closes modal without upgrading
        setProcessingResult({
          success: false,
          error: errorMessage,
          message: "guest_limit_exceeded", // Flag to identify guest limit errors
        });
        return;
      }

      const errorMessage = error instanceof Error
        ? error.message
        : "An error occurred during compression";
      
      setError(errorMessage);
      setProcessingResult({
        success: false,
        error: errorMessage,
      });

      // Track error analytics
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "pdf_compression_error", {
          error: errorMessage,
          compression_level: compressionLevel,
        });
      }
    } finally {
      setIsCompressing(false);
    }
  };

  const downloadFile = () => {
    if (result) {
      const link = document.createElement("a");
      link.href = `${process.env.NEXT_PUBLIC_API_URL}${result.downloadUrl}`;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <Header title="PDF Compression" />

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        feature="PDF compression"
      />

      {/* Processing Error Display */}
      {processingResult && !processingResult.success && (
        <div className="pt-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-800 mb-1">
                    {processingResult.message === "guest_limit_exceeded"
                      ? "Guest Limit Reached"
                      : "Compression Error"}
                  </h3>
                  <p className="text-sm text-red-700">
                    {processingResult.error}
                  </p>
                  {processingResult.message === "guest_limit_exceeded" && (
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => setShowPricingModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        Upgrade to Premium
                      </button>
                      <button
                        onClick={() => setProcessingResult(null)}
                        className="px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                  {processingResult.message !== "guest_limit_exceeded" && (
                    <button
                      onClick={() => setProcessingResult(null)}
                      className="mt-3 px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                      Try Again
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setProcessingResult(null)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedFile && !result ? (
        // Initial Upload State
        <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-4xl mx-auto">
              <div className="mb-12">
                <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full mb-6">
                  <Archive className="w-4 h-4 text-slate-700" />
                  <span className="text-sm font-semibold text-slate-700">
                    PDF Compression Tool
                  </span>
                </div>

                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                  Compress PDF Files
                  <br />
                  <span className="text-slate-600">Reduce File Size</span>
                </h1>

                <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-3xl mx-auto">
                  Reduce your PDF file size while maintaining quality. Choose your
                  compression level and get instant results with our advanced
                  optimization algorithms.
                </p>
              </div>

              {/* Upload Area */}
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
                      document.getElementById("file-input")?.click()
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
                        ? "Drop to start compressing"
                        : "Upload PDF to Compress"}
                    </p>
                    <p className="text-sm text-slate-600 mb-4">
                      {isDragOver
                        ? "We'll optimize it for smaller file size"
                        : "Drag & drop or click to browse • Max 50MB"}
                    </p>
                    <div className="flex items-center justify-center space-x-4 text-xs text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Shield className="w-3 h-3" />
                        <span>Quality Preserved</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                      <div className="flex items-center space-x-1">
                        <Archive className="w-3 h-3" />
                        <span>Advanced Compression</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                      <div className="flex items-center space-x-1">
                        <Zap className="w-3 h-3" />
                        <span>Fast Processing</span>
                      </div>
                    </div>
                    <input
                      id="file-input"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        if (e.target.files) {
                          handleFileUpload(Array.from(e.target.files));
                        }
                      }}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Features Grid */}
              <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    Quality Preserved
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Advanced algorithms ensure your documents maintain readability
                    and visual quality while reducing file size.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    Fast Processing
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Get your compressed PDF in seconds with our optimized
                    compression engine and real-time progress tracking.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Archive className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    Multiple Levels
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Choose from high, medium, or maximum compression levels to
                    balance file size and quality for your needs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        // File Processing State
        <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Grid Layout with Sidebar */}
            <div className="grid lg:grid-cols-4 gap-8">
              {/* Main Content Area */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  {/* Selected File Info */}
                  {selectedFile && !result && (
                    <>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-slate-800">
                          PDF Compression
                        </h2>
                        <span className="text-sm text-slate-600">
                          Ready to compress
                        </span>
                      </div>

                      <div className="flex items-center p-4 bg-slate-50 rounded-xl mb-6">
                        <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-red-600" />
                        </div>
                        <div className="flex-1 ml-4">
                          <h3 className="font-semibold text-slate-800 truncate">
                            {selectedFile.name}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                        <button
                          onClick={resetForm}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Compression Level Selection */}
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                          Choose Compression Level
                        </h3>
                        <div className="space-y-3">
                          {Object.entries(compressionLevels).map(([level, config]) => (
                            <div
                              key={level}
                              className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                                compressionLevel === level
                                  ? "border-blue-400 bg-blue-50"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                              onClick={() =>
                                setCompressionLevel(level as CompressionLevel)
                              }
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-semibold text-slate-900">
                                    {config.label}
                                  </h4>
                                  <p className="text-sm text-slate-600 mt-1">
                                    {config.description}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {config.quality}
                                  </p>
                                </div>
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    compressionLevel === level
                                      ? "border-blue-500 bg-blue-500"
                                      : "border-slate-300"
                                  }`}
                                >
                                  {compressionLevel === level && (
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {isCompressing && (
                        <div className="mb-6">
                          <div className="bg-slate-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-slate-600 mt-2">
                            {progress < 50
                              ? `Uploading... ${Math.round(progress)}%`
                              : progress < 90
                              ? `Compressing... ${Math.round(progress)}%`
                              : `Finalizing... ${Math.round(progress)}%`}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Results */}
                  {result && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-slate-800">
                          Compression Complete
                        </h2>
                        <span className="text-sm text-slate-600">
                          Ready to download
                        </span>
                      </div>

                      <div className="flex items-center p-4 bg-green-50 border border-green-200 rounded-xl">
                        <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
                        <p className="text-green-800 font-semibold">{result.message}</p>
                      </div>

                      {/* Compression Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-50 p-6 rounded-xl text-center">
                          <h4 className="font-semibold text-slate-900 mb-2">
                            Original Size
                          </h4>
                          <p className="text-2xl font-bold text-slate-700">
                            {result.originalSizeFormatted}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-xl text-center">
                          <h4 className="font-semibold text-slate-900 mb-2">
                            Compressed Size
                          </h4>
                          <p className="text-2xl font-bold text-blue-600">
                            {result.compressedSizeFormatted}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-xl text-center">
                          <h4 className="font-semibold text-slate-900 mb-2">
                            Size Reduction
                          </h4>
                          <p className="text-2xl font-bold text-green-600">
                            {result.compressionRatio}%
                          </p>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex items-start p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                          <p className="font-semibold mb-1">Compression Details:</p>
                          <p>
                            Level:{" "}
                            {
                              compressionLevels[
                                result.compressionLevel as CompressionLevel
                              ].label
                            }
                          </p>
                          <p>
                            Your file has been compressed using advanced PDF
                            optimization techniques.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Sidebar */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8">
                  {/* Compress Button */}
                  {selectedFile && !result && (
                    <button
                      onClick={compressPdf}
                      disabled={isCompressing}
                      className={`w-full py-4 rounded-xl transition-all duration-200 font-semibold text-lg mb-6 flex items-center justify-center space-x-2 ${
                        isCompressing
                          ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                          : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
                      }`}
                    >
                      {isCompressing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Compressing...</span>
                        </>
                      ) : (
                        <>
                          <Archive className="w-5 h-5" />
                          <span>Compress PDF</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Download Buttons */}
                  {result && (
                    <div className="space-y-3">
                      <button
                        onClick={downloadFile}
                        className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 font-semibold text-lg flex items-center justify-center space-x-2"
                      >
                        <Download className="w-5 h-5" />
                        <span>Download PDF</span>
                      </button>
                      <button
                        onClick={resetForm}
                        className="w-full bg-slate-500 text-white py-3 rounded-xl hover:bg-slate-600 transition-all duration-200 font-medium flex items-center justify-center space-x-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Compress Another</span>
                      </button>
                    </div>
                  )}

                  {/* Error Message in Sidebar */}
                  {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-red-800 text-sm">Error</h4>
                          <p className="text-red-700 text-sm mt-1">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Compression Info */}
                  <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                    <h4 className="font-semibold text-slate-800 mb-3">Compression Levels</h4>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex justify-between">
                        <span>High Quality:</span>
                        <span>90% quality</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Medium:</span>
                        <span>70% quality</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Maximum:</span>
                        <span>50% quality</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
