"use client";

import {
  ArrowLeft,
  ChevronRight,
  Cloud,
  Download,
  FileText,
  FolderOpen,
  GripVertical,
  Info,
  Loader,
  Plus,
  Upload,
  X,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { UploadFile, useFilesContext } from "../context/context";
import { handleGuestLimitError } from "../utils/guestLimits";
import { authenticatedFetch } from "@/lib/session";
import Header from "@/components/ui/header";
import PricingModal from "@/app/components/PricingModal";
import { getBatchPdfPageCounts } from "@/lib/pdfUtils";

const MergePDFPage = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { files, setFiles, processingResult, setProcessingResult } =
    useFilesContext();
  let fileIds = files.map((file) => file.id);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedFile, setDraggedFile] = useState<UploadFile | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputAdditionalRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (newFiles: FileList | File[]) => {
    // Clear any previous errors
    setUploadError(null);

    // Validate files
    const validationErrors: string[] = [];
    const validFiles: File[] = [];

    Array.from(newFiles).forEach((file) => {
      // Check file type
      if (file.type !== "application/pdf") {
        validationErrors.push(`"${file.name}" is not a PDF file.`);
        return;
      }

      // Check file size (50MB limit for all users, backend will handle guest limits)
      if (file.size > 50 * 1024 * 1024) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        validationErrors.push(
          `"${file.name}" is too large (${fileSizeMB}MB). Maximum size is 50MB.`
        );
        return;
      }

      // Check if file is empty
      if (file.size === 0) {
        validationErrors.push(`"${file.name}" appears to be empty.`);
        return;
      }

      validFiles.push(file);
    });

    // If there are validation errors, show them
    if (validationErrors.length > 0) {
      setUploadError(validationErrors[0]); // Show the first error
      return;
    }

    // Get actual page counts for all valid files
    const pageCounts = await getBatchPdfPageCounts(validFiles);

    const pdfFiles = validFiles.map((file, index) => ({
      id: Date.now().toString() + index,
      file,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + " MB", // Store formatted size
      pages: pageCounts[index],
    }));

    setFiles((prev: UploadFile[]) => [...prev, ...pdfFiles]);

    // Clear any upload error since files were successfully added
    setUploadError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    handleFileUpload(Array.from(droppedFiles));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileUpload(Array.from(e.target.files));
    }
  };

  const removeFile = (id: string) => {
    setFiles((files: UploadFile[]) => files.filter((file) => file.id !== id));
  };

  const handleFileDragStart = (e: React.DragEvent, file: UploadFile) => {
    setDraggedFile(file);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFileDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleFileDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (!draggedFile) return;

    const dragIndex = files.findIndex((f) => f.id === draggedFile.id);
    if (dragIndex === dropIndex) return;

    const newFiles = [...files];
    const [removed] = newFiles.splice(dragIndex, 1);
    newFiles.splice(dropIndex, 0, removed);

    setFiles(newFiles);
    setDraggedFile(null);
    setDragOverIndex(null);
  };

  const handleMerge = () => {
    console.log("Merging files:", uploadedFiles);
    // In a real app, this would trigger the merge process
  };

  const mergePDFs = async () => {
    console.log("filess length", files.length);
    if (files.length < 2) {
      alert("Please select at least 2 PDF files to merge");
      return;
    }

    setIsMerging(true);
    setProcessingResult(null);

    try {
      // Check if user is authenticated using existing session data
      const userAuthenticated = !!session?.user;
      // Upload all files at once using the new multiple upload endpoint
      const formData = new FormData();
      files.forEach((pdfFile) => {
        formData.append("files", pdfFile.file);
      });

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
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();

      // Now merge the uploaded files
      const mergeRequest = {
        fileIds: uploadResult.files.map((f: any) => f.fileId),
        outputName: "merged-document.pdf",
      };

      // Use authenticatedFetch for authenticated users, regular fetch for guests
      const mergeResponse = userAuthenticated
        ? await authenticatedFetch(`${process.env.NEXT_PUBLIC_API_URL}/merge`, {
            method: "POST",
            body: JSON.stringify(mergeRequest),
          })
        : await fetch(`${process.env.NEXT_PUBLIC_API_URL}/merge`, {
            credentials: "include", // VERY IMPORTANT for guest sessions
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(mergeRequest),
          });

      if (!mergeResponse.ok) {
        // Parse error response to get the actual message
        const errorData = await mergeResponse.json().catch(() => ({}));
        const error = new Error(
          errorData.message || `Merge failed: ${mergeResponse.statusText}`
        );
        (error as any).status = mergeResponse.status;
        (error as any).data = errorData;
        throw error;
      }

      const mergeResult = await mergeResponse.json();
      setProcessingResult({
        success: true,
        downloadUrl: mergeResult.downloadUrl,
        fileName: mergeResult.fileName,
        message: "PDFs merged successfully",
      });
      router.push(`/download/${mergeResult.fileName!}`); // navigate to /dashboard

      // Track analytics (Week 2 requirement)
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "pdf_merge_success", {
          files_count: files.length,
          total_size_mb: files
            .reduce((sum, file) => {
              // Convert bytes to MB for analytics
              return sum + Number(file.size) / (1024 * 1024);
            }, 0)
            .toFixed(2),
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

      setProcessingResult({
        success: false,
        error: "Failed to merge PDFs. Please try again.",
      });

      // Track error analytics
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "pdf_merge_error", {
          error: error.message,
        });
      }
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <Header title="PDF Merge" />

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        feature="PDF merging"
      />

      {/* Main Content */}
      <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Guest Limit Warning */}
          {/* <GuestLimitWarning /> */}

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
                    <button
                      onClick={() => setUploadError(null)}
                      className="mt-3 px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                      Try Another File
                    </button>
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

          {/* Processing Error Display */}
          {processingResult && !processingResult.success && (
            <div className="max-w-4xl mx-auto mb-8">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-red-800 mb-1">
                      {processingResult.message === "guest_limit_exceeded"
                        ? "Guest Limit Reached"
                        : "Merge Error"}
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
          )}

          {files.length === 0 ? (
            // Initial Upload State
            <div className="text-center max-w-4xl mx-auto">
              <div className="mb-12">
                <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full mb-6">
                  <Plus className="w-4 h-4 text-slate-700" />
                  <span className="text-sm font-semibold text-slate-700">
                    PDF Merge Tool
                  </span>
                </div>

                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                  Merge PDF Files
                  <br />
                  <span className="text-slate-600">In Seconds</span>
                </h1>

                <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-3xl mx-auto">
                  Combine multiple PDF documents into a single file. Select the
                  files you want to merge, arrange them in the desired order,
                  and create your merged PDF instantly.
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
                    onClick={() => fileInputRef.current?.click()}
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
                        ? "Drop to start merging"
                        : "Upload PDFs to Merge"}
                    </p>
                    <p className="text-sm text-slate-600 mb-4">
                      {isDragOver
                        ? "We'll combine them in the order you specify"
                        : "Drag & drop or click to browse • Multiple files supported"}
                    </p>
                    <div className="flex items-center justify-center space-x-4 text-xs text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Plus className="w-3 h-3" />
                        <span>Multiple Files</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                      <div className="flex items-center space-x-1">
                        <FileText className="w-3 h-3" />
                        <span>PDF Only</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                      <div className="flex items-center space-x-1">
                        <Download className="w-3 h-3" />
                        <span>Instant Download</span>
                      </div>
                    </div>
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={handleFileInputChange}
                    ref={fileInputRef}
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
          ) : (
            // Files Uploaded State
            <div className="grid lg:grid-cols-4 gap-8">
              {/* Files Area */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">
                      PDF Files to Merge
                    </h2>
                    <span className="text-sm text-slate-600">
                      {files.length} files selected
                    </span>
                  </div>

                  {/* File List */}
                  <div className="space-y-3">
                    {files.map((file, index) => (
                      <div
                        key={file.id}
                        draggable
                        onDragStart={(e) => handleFileDragStart(e, file)}
                        onDragOver={(e) => handleFileDragOver(e, index)}
                        onDrop={(e) => handleFileDrop(e, index)}
                        className={`flex items-center p-4 bg-slate-50 rounded-xl border-2 transition-all cursor-move hover:bg-slate-100 ${
                          dragOverIndex === index
                            ? "border-blue-400 bg-blue-50"
                            : "border-transparent"
                        }`}
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <GripVertical className="w-5 h-5 text-slate-400" />
                          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-red-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-800 truncate max-w-xs">
                              {file.name}
                            </h3>
                            <p className="text-sm text-slate-600">
                              {file.size} • {file.pages} pages
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-slate-600 bg-white px-3 py-1 rounded-full">
                            {index + 1}
                          </span>
                          <button
                            onClick={() => removeFile(file.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add More Files Button */}
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <button
                      onClick={() => fileInputAdditionalRef.current?.click()}
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="font-medium">Add more files</span>
                    </button>
                    <input
                      id="file-input-additional"
                      type="file"
                      multiple
                      accept=".pdf"
                      onChange={handleFileInputChange}
                      ref={fileInputAdditionalRef}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Right Sidebar */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8">
                  {/* Merge Button */}
                  <button
                    onClick={mergePDFs}
                    disabled={isMerging}
                    className={`w-full py-4 rounded-xl transition-all duration-200 font-semibold text-lg mb-6 flex items-center justify-center space-x-2 ${
                      isMerging
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
                    }`}
                  >
                    {isMerging ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    <span>{isMerging ? "Merging PDFs" : "Merge PDFs"}</span>
                  </button>

                  {/* Options */}
                  <div className="space-y-4 mb-6">
                    <h3 className="font-semibold text-slate-800">
                      Merge Options
                    </h3>

                    <div className="space-y-3">
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          defaultChecked
                        />
                        <span className="text-sm text-slate-700">
                          Preserve bookmarks
                        </span>
                      </label>
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">
                          Add page numbers
                        </span>
                      </label>
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">
                          Optimize file size
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Upload Sources */}
                  <div className="space-y-3 mb-6">
                    <h3 className="font-semibold text-slate-800">Add from</h3>
                    <button className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-center space-x-2">
                        <Cloud className="w-4 h-4 text-slate-600" />
                        <span className="text-sm text-slate-700">
                          Google Drive
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                    <button className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-center space-x-2">
                        <FolderOpen className="w-4 h-4 text-slate-600" />
                        <span className="text-sm text-slate-700">Dropbox</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                      onClick={() => fileInputAdditionalRef.current?.click()}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Plus className="w-4 h-4 text-slate-600" />
                        <span className="text-sm text-slate-700">
                          From Device
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
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
                          Drag and drop to reorder your files. The merged PDF
                          will combine all pages in the order shown.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default MergePDFPage;
