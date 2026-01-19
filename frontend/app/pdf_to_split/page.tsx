"use client";
import Header from "@/components/ui/header";
import {
  AlertTriangle,
  Cloud,
  Download,
  FileText,
  FolderOpen,
  Grid3X3,
  Info,
  Layers,
  Loader2,
  Plus,
  Scissors,
  Settings,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { UploadFile, useFilesContext } from "../context/context";
import { authenticatedFetch } from "@/lib/session";
import PricingModal from "../components/PricingModal";
import toast from "react-hot-toast";
import { getPdfPageCountSafe } from "@/lib/pdfUtils";

// TypeScript declarations
declare global {
  interface Window {
    gtag: (command: string, action: string, parameters?: any) => void;
    dataLayer: any[];
  }
}

interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pages?: number;
  preview?: string;
}

interface SplitOption {
  type: "pages" | "range" | "size" | "extract";
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface SplitRequest {
  fileId: string;
  splitType: string;
  options: {
    pages?: number[];
    ranges?: string;
    pageNumbers?: string;
    extractPages?: string;
    maxSizeKB?: number;
  };
}

interface SplitResponse {
  success: boolean;
  files?: { name: string; downloadUrl: string }[];
  error?: string;
  fileName: string;
}

const PDFSplitterApp = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { files, setFiles, processingResult, setProcessingResult } =
    useFilesContext();
  const [file, setFile] = useState<UploadFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitResult, setSplitResult] = useState<SplitResponse | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedSplitType, setSelectedSplitType] = useState<string>("pages");
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [isCalculatingPages, setIsCalculatingPages] = useState(false);

  // Split configuration states
  const [pagesPerSplit, setPagesPerSplit] = useState<number>(1);
  const [customRanges, setCustomRanges] = useState<string>("");
  const [extractPages, setExtractPages] = useState<string>("");
  const [maxFileSize, setMaxFileSize] = useState<number>(5000); // KB

  useEffect(() => {
    if (files) {
      setFile(files[0] ?? null); // example: take the first file
    }
  }, [files]);

  const splitOptions: SplitOption[] = [
    {
      type: "pages",
      label: "Split by Pages",
      description: "Split every N pages into separate files",
      icon: <Layers className="h-5 w-5" />,
    },
    {
      type: "range",
      label: "Split by Range",
      description: "Define custom page ranges (e.g., 1-5, 6-10)",
      icon: <Grid3X3 className="h-5 w-5" />,
    },
    {
      type: "extract",
      label: "Extract Pages",
      description: "Extract specific pages (e.g., 1, 3, 5-7)",
      icon: <Scissors className="h-5 w-5" />,
    },
    {
      type: "size",
      label: "Split by Size",
      description: "Split based on maximum file size",
      icon: <Settings className="h-5 w-5" />,
    },
  ];

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // Handle drop events
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      await handleFile(droppedFiles[0]);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Handle file input change
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  };

  // Process and validate file
  const handleFile = async (selectedFile: File) => {
    if (selectedFile.type !== "application/pdf") {
      alert("Please select a PDF file");
      return;
    }

    // Show loading state while calculating pages
    setIsUploading(true);

    try {
      // Get actual page count from PDF
      const pageCount = await getPdfPageCountSafe(selectedFile);

      const newFile: UploadFile = {
        id: Math.random().toString(36).substr(2, 9),
        file: selectedFile,
        name: selectedFile.name,
        size: selectedFile.size.toString(), // Keep as string for compatibility with existing interface
        pages: pageCount,
        actualSize: selectedFile.size, // Store actual size as number for accurate calculations
      };

      setFile(newFile);
      setSplitResult(null);
    } catch (error) {
      console.error("Error processing PDF file:", error);
      alert("Error reading PDF file. Please try again with a different file.");
    } finally {
      setIsUploading(false);
    }
  };

  // Remove file
  const removeFile = () => {
    setFile(null);
    setSplitResult(null);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Validate split configuration
  const validateSplitConfig = (): string | null => {
    if (!file) return "No file selected";

    switch (selectedSplitType) {
      case "pages":
        if (pagesPerSplit < 1 || pagesPerSplit >= (file.pages || 1)) {
          return "Pages per split must be between 1 and total pages";
        }
        break;
      case "range":
        if (!customRanges.trim()) {
          return "Please specify page ranges (e.g., 1-5, 6-10)";
        }
        // Validate page ranges don't exceed total pages
        const rangePattern = /(\d+)(?:-(\d+))?/g;
        let match;
        while ((match = rangePattern.exec(customRanges)) !== null) {
          const start = parseInt(match[1]);
          const end = match[2] ? parseInt(match[2]) : start;
          if (start > (file.pages || 1) || end > (file.pages || 1)) {
            return `Page range ${start}${
              match[2] ? "-" + end : ""
            } exceeds total pages (${file.pages})`;
          }
        }
        break;
      case "extract":
        if (!extractPages.trim()) {
          return "Please specify pages to extract (e.g., 1, 3, 5-7)";
        }
        // Validate extract pages don't exceed total pages
        const extractPattern = /(\d+)(?:-(\d+))?/g;
        let extractMatch;
        while ((extractMatch = extractPattern.exec(extractPages)) !== null) {
          const start = parseInt(extractMatch[1]);
          const end = extractMatch[2] ? parseInt(extractMatch[2]) : start;
          if (start > (file.pages || 1) || end > (file.pages || 1)) {
            return `Page ${start}${
              extractMatch[2] ? "-" + end : ""
            } exceeds total pages (${file.pages})`;
          }
        }
        break;
      case "size":
        if (maxFileSize < 100) {
          return "Maximum file size must be at least 100 KB";
        }
        break;
    }
    return null;
  };

  // Split PDF
  const splitPDF = async () => {
    const validationError = validateSplitConfig();
    if (validationError) {
      alert(validationError);
      return;
    }

    if (!file) return;

    setIsSplitting(true);
    setSplitResult(null);

    try {
      // Check if user is authenticated using existing session data
      const userAuthenticated = !!session?.user;

      // Upload file first
      const formData = new FormData();
      formData.append("files", file.file);

      // Use authenticatedFetch for authenticated users, regular fetch for guests
      const uploadResponse = userAuthenticated
        ? await authenticatedFetch(
            `${process.env.NEXT_PUBLIC_API_URL}/upload/pdfs`,
            {
              method: "POST",
              body: formData,
            }
          )
        : await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/pdfs`, {
            credentials: "include", // VERY IMPORTANT for guest sessions
            method: "POST",
            body: formData,
          });

      if (!uploadResponse.ok) {
        // Parse error response to get the actual message
        const errorData = await uploadResponse.json().catch(() => ({}));
        const error = new Error(
          errorData.message || `Upload failed: ${uploadResponse.statusText}`
        );
        (error as any).status = uploadResponse.status;
        (error as any).data = errorData;
        throw error;
      }

      const uploadResult = await uploadResponse.json();
      console.log("uploadddd REsultttt", uploadResult);

      // Prepare split request
      const splitRequest: SplitRequest = {
        fileId: uploadResult.files.map((f: any) => f.fileId)[0],
        splitType: selectedSplitType,
        options: {},
      };

      switch (selectedSplitType) {
        case "pages":
          splitRequest.options.pages = [pagesPerSplit];
          break;
        case "range":
          splitRequest.options.ranges = customRanges;
          break;
        case "extract":
          splitRequest.options.extractPages = extractPages;
          break;
        case "size":
          splitRequest.options.maxSizeKB = maxFileSize;
          break;
      }

      // Determine endpoint and payload based on split type
      let endpoint: string;
      let payload: any;

      switch (selectedSplitType) {
        case "pages":
          endpoint = "/split/pattern";
          payload = {
            fileId: splitRequest.fileId,
            splitByPattern: splitRequest.options.pages?.[0]?.toString() || "1",
            outputName: `split-pages-${Date.now()}`,
          };
          break;
        case "range":
          endpoint = "/split/range";
          payload = {
            fileId: splitRequest.fileId,
            splitByRange: splitRequest.options.ranges || "1-1",
            outputName: `split-range-${Date.now()}`,
          };
          break;
        case "extract":
          endpoint = "/split/extract";
          payload = {
            fileId: splitRequest.fileId,
            extractPages: splitRequest.options.extractPages || "1",
            outputName: `extracted-${Date.now()}`,
          };
          break;
        case "size":
          endpoint = "/split/size";
          payload = {
            fileId: splitRequest.fileId,
            maxSizeKB: splitRequest.options.maxSizeKB || 1024,
            outputName: `split-size-${Date.now()}`,
          };
          break;
        default:
          throw new Error("Invalid split type selected");
      }

      // Split PDF
      // Use authenticatedFetch for authenticated users, regular fetch for guests
      const splitResponse = userAuthenticated
        ? await authenticatedFetch(
            `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`,
            {
              method: "POST",
              body: JSON.stringify(payload),
            }
          )
        : await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
            credentials: "include", // VERY IMPORTANT for guest sessions
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

      if (!splitResponse.ok) {
        // Parse error response to get the actual message
        const errorData = await splitResponse.json().catch(() => ({}));
        const error = new Error(
          errorData.message || `Split failed: ${splitResponse.statusText}`
        );
        (error as any).status = splitResponse.status;
        (error as any).data = errorData;
        throw error;
      }

      const splitResult = await splitResponse.json();
      console.log("splittt response", splitResult);

      setProcessingResult({
        success: true,
        downloadUrl: splitResult.zipFile.downloadUrl,
        fileName: splitResult.zipFile.name,
        message: "PDFs merged successfully",
      });
      router.push(`/download/${splitResult.zipFile.name}`); // navigate to /dashboard

      // Track analytics
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "pdf_split_success", {
          split_type: selectedSplitType,
          total_pages: file.pages,
          file_size: file.size,
          output_files: splitResult.files?.length || 0,
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

      setSplitResult(null);
      setProcessingResult({
        success: false,
        error: "Failed to split PDF. Please try again.",
      });

      // Track error analytics
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "pdf_split_error", {
          error: error.message,
        });
      }
    } finally {
      setIsSplitting(false);
    }
  };

  // Download split files
  const downloadFile = async () => {
    if (!splitResult) return toast.error("File not found");
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/download/${splitResult?.fileName}`,
        { method: "GET" }
      );

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = splitResult?.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Track download
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "pdf_download_success", {
          filename: splitResult.fileName,
        });
      }
    } catch (error: any) {
      console.error("Download failed:", error);
      alert("Failed to download file. Please try again.");
    }
  };

  // Download all files
  const downloadAllFiles = async () => {
    if (!splitResult) toast.error("no file to download");
    if (!splitResult?.files) return;

    await downloadFile();
    // Small delay between downloads
    // await new Promise((resolve) => setTimeout(resolve, 500));
  };

  const renderSplitConfiguration = () => {
    switch (selectedSplitType) {
      case "pages":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pages per split
              </label>
              <input
                type="number"
                min="1"
                max={file?.pages || 1}
                value={pagesPerSplit}
                onChange={(e) =>
                  setPagesPerSplit(parseInt(e.target.value) || 1)
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-slate-500 mt-1">
                Split every {pagesPerSplit} page(s) into separate files (Total:{" "}
                {file?.pages || 0} pages)
              </p>
            </div>
          </div>
        );

      case "range":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Page Ranges
              </label>
              <input
                type="text"
                placeholder="e.g., 1-5, 6-10, 11-15"
                value={customRanges}
                onChange={(e) => setCustomRanges(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-slate-500 mt-1">
                Specify page ranges separated by commas (e.g., 1-5, 8-12) •
                Total: {file?.pages || 0} pages
              </p>
            </div>
          </div>
        );

      case "extract":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pages to Extract
              </label>
              <input
                type="text"
                placeholder="e.g., 1, 3, 5-7, 10"
                value={extractPages}
                onChange={(e) => setExtractPages(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-slate-500 mt-1">
                Specify individual pages or ranges (e.g., 1, 3, 5-7, 10) •
                Total: {file?.pages || 0} pages
              </p>
            </div>
          </div>
        );

      case "size":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Maximum File Size (KB)
              </label>
              <input
                type="number"
                min="100"
                value={maxFileSize}
                onChange={(e) =>
                  setMaxFileSize(parseInt(e.target.value) || 5000)
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-slate-500 mt-1">
                Split into files no larger than{" "}
                {formatFileSize(maxFileSize * 1024)}
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <Header title="PDF Split" />

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        feature="PDF splitting"
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
                      : "Split Error"}
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

      {!file ? (
        // Initial Upload State
        <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-4xl mx-auto">
              <div className="mb-12">
                <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full mb-6">
                  <Scissors className="w-4 h-4 text-slate-700" />
                  <span className="text-sm font-semibold text-slate-700">
                    PDF Split Tool
                  </span>
                </div>

                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                  Split PDF Files
                  <br />
                  <span className="text-slate-600">Multiple Ways</span>
                </h1>

                <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-3xl mx-auto">
                  Split your PDF document into multiple files. Choose from
                  various splitting options like page ranges, file size limits,
                  or extract specific pages.
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
                      {isUploading ? (
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      ) : (
                        <Upload className="w-8 h-8 text-white" />
                      )}
                    </div>
                    <p className="text-xl font-bold text-slate-900 mb-2">
                      {isUploading
                        ? "Analyzing PDF..."
                        : isDragOver
                        ? "Drop to start splitting"
                        : "Upload PDF to Split"}
                    </p>
                    <p className="text-sm text-slate-600 mb-4">
                      {isDragOver
                        ? "We'll help you split it your way"
                        : "Drag & drop or click to browse • Max 50MB"}
                    </p>
                    <div className="flex items-center justify-center space-x-4 text-xs text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Scissors className="w-3 h-3" />
                        <span>Multiple Options</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                      <div className="flex items-center space-x-1">
                        <FileText className="w-3 h-3" />
                        <span>PDF Only</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                      <div className="flex items-center space-x-1">
                        <Download className="w-3 h-3" />
                        <span>Fast Processing</span>
                      </div>
                    </div>
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf"
                    onChange={handleInputChange}
                    className="hidden"
                  />
                </div>

                {/* Upload Options */}
                <div className="flex justify-center space-x-4 mt-6">
                  <button className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">
                    <Cloud className="w-5 h-5 text-slate-600" />
                    <span className="text-slate-700">From Google Drive</span>
                  </button>
                  <button className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">
                    <FolderOpen className="w-5 h-5 text-slate-600" />
                    <span className="text-slate-700">From Dropbox</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        // Files Uploaded State
        <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Files Uploaded State */}
            <div className="grid lg:grid-cols-4 gap-8">
              {/* File Preview Area */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">
                      Selected PDF
                    </h2>
                    <button
                      onClick={removeFile}
                      className="text-red-600 hover:text-red-700 font-medium flex items-center space-x-1"
                    >
                      <X className="w-4 h-4" />
                      <span>Remove</span>
                    </button>
                  </div>

                  <div className="flex items-center p-4 bg-slate-50 rounded-xl border-2 border-transparent">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
                      <FileText className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800 truncate max-w-xs">
                        {file.name}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-slate-600">
                        <span>
                          {formatFileSize(
                            file.actualSize || parseInt(file.size)
                          )}
                        </span>
                        <span>•</span>
                        <span>{file.pages} pages</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Split Options */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-6">
                    Choose Split Method
                  </h3>

                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    {splitOptions.map((option) => (
                      <button
                        key={option.type}
                        onClick={() => setSelectedSplitType(option.type)}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                          selectedSplitType === option.type
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 hover:border-slate-300 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center mb-3">
                          <div
                            className={`p-2 rounded-lg mr-3 ${
                              selectedSplitType === option.type
                                ? "bg-blue-500 text-white"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {option.icon}
                          </div>
                          <h4 className="font-semibold text-slate-800">
                            {option.label}
                          </h4>
                        </div>
                        <p className="text-sm text-slate-600">
                          {option.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Results Section */}
                {splitResult && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6">
                    {splitResult.success ? (
                      <div>
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Download className="w-8 h-8 text-green-600" />
                          </div>
                          <h3 className="text-2xl font-bold text-slate-800 mb-2">
                            PDF Split Successfully!
                          </h3>
                          <p className="text-slate-600 mb-6">
                            Your PDF has been split into{" "}
                            {splitResult.files?.length || 0} file(s)
                          </p>
                          <button
                            onClick={downloadAllFiles}
                            className="bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 font-semibold text-lg mb-6 flex items-center justify-center space-x-2 mx-auto"
                          >
                            <Download className="w-5 h-5" />
                            <span>Download All Files</span>
                          </button>
                        </div>

                        {/* Individual File Downloads */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-slate-800 mb-4">
                            Individual Downloads:
                          </h4>
                          {splitResult.files?.map((file, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-4 bg-slate-50 rounded-xl"
                            >
                              <div className="flex items-center">
                                <FileText className="w-5 h-5 text-red-600 mr-3" />
                                <span className="font-medium text-slate-700">
                                  {file.name}
                                </span>
                              </div>
                              <button
                                onClick={() => downloadFile()}
                                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2"
                              >
                                <Download className="w-4 h-4" />
                                <span>Download</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <X className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">
                          Split Failed
                        </h3>
                        <p className="text-slate-600 mb-6">
                          {splitResult.error ||
                            "An error occurred while splitting the PDF"}
                        </p>
                        <button
                          onClick={() => setSplitResult(null)}
                          className="bg-slate-500 text-white px-6 py-3 rounded-xl hover:bg-slate-600 transition-all duration-200 font-semibold"
                        >
                          Try Again
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Sidebar */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8">
                  {/* Split Button */}
                  <button
                    onClick={splitPDF}
                    disabled={isSplitting}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-semibold text-lg mb-6 flex items-center justify-center space-x-2"
                  >
                    {isSplitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Scissors className="w-5 h-5" />
                    )}
                    <span>
                      {isSplitting ? "Splitting PDF..." : "Split PDF"}
                    </span>
                  </button>

                  {/* Configuration Panel */}
                  <div className="space-y-6 mb-6">
                    <h3 className="font-semibold text-slate-800">
                      Split Configuration
                    </h3>
                    <div className="bg-slate-50 rounded-lg p-4">
                      {renderSplitConfiguration()}
                    </div>
                  </div>

                  {/* Upload Sources */}
                  <div className="space-y-3 mb-6">
                    <h3 className="font-semibold text-slate-800">
                      Upload new file
                    </h3>
                    <button
                      onClick={() =>
                        document.getElementById("file-input-new")?.click()
                      }
                      className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Plus className="w-4 h-4 text-slate-600" />
                        <span className="text-sm text-slate-700">
                          Select New File
                        </span>
                      </div>
                    </button>
                    <input
                      id="file-input-new"
                      type="file"
                      accept=".pdf"
                      onChange={handleInputChange}
                      className="hidden"
                    />
                  </div>

                  {/* Info */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex space-x-3">
                      <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900 mb-1">
                          How it works
                        </h4>
                        <p className="text-sm text-blue-800">
                          Choose your split method and configure the options.
                          Your PDF will be divided according to your
                          specifications.
                        </p>
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
};

export default PDFSplitterApp;
