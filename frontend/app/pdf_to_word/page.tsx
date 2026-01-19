"use client";

import {
  FileText,
  Download,
  Loader2,
  Upload,
  Cloud,
  FolderOpen,
  X,
  Plus,
  GripVertical,
  Shield,
  Zap,
  CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { UploadFile, useFilesContext } from "../context/context";
import { getBatchPdfPageCounts } from "@/lib/pdfUtils";
import { authenticatedFetch } from "@/lib/session";
import Header from "@/components/ui/header";
import PricingModal from "../components/PricingModal";

const PdfToWordPage = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { files, setFiles, setProcessingResult } = useFilesContext();
  const [isConverting, setIsConverting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

  const handleFileUpload = async (uploadedFiles: File[]) => {
    // Validate files
    const validFiles = uploadedFiles.filter((file) => {
      if (file.type !== "application/pdf") {
        alert(`"${file.name}" is not a PDF file.`);
        return false;
      }
      if (file.size > 50 * 1024 * 1024) {
        alert(`"${file.name}" is too large. Maximum size is 50MB.`);
        return false;
      }
      return true;
    });

    // Get actual page counts for all valid files
    const pageCounts = await getBatchPdfPageCounts(validFiles);

    const pdfFiles = validFiles.map((file, index) => ({
      id: Date.now().toString() + index,
      file,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
      pages: pageCounts[index],
    }));

    setFiles((prev: UploadFile[]) => [...prev, ...pdfFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((files: UploadFile[]) => files.filter((file) => file.id !== id));
  };

  const handleAddMoreFiles = () => {
    document.getElementById("additional-file-input")?.click();
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

  const convertPDFs = async () => {
    if (files.length < 1) {
      alert("Please select at least 1 PDF file to convert");
      return;
    }

    setIsConverting(true);
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

      // Now convert the uploaded file
      const convertRequest = {
        fileId: uploadResult.files.map((f: any) => f.fileId)[0],
        outputName: "converted-document.docx",
      };

      // Use authenticatedFetch for authenticated users, regular fetch for guests
      const convertResponse = userAuthenticated
        ? await authenticatedFetch(
            `${process.env.NEXT_PUBLIC_API_URL}/pdf-to-word`,
            {
              method: "POST",
              body: JSON.stringify(convertRequest),
            }
          )
        : await fetch(`${process.env.NEXT_PUBLIC_API_URL}/pdf-to-word`, {
            credentials: "include", // VERY IMPORTANT for guest sessions
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(convertRequest),
          });

      if (!convertResponse.ok) {
        // Parse error response to get the actual message
        const errorData = await convertResponse.json().catch(() => ({}));
        const error = new Error(
          errorData.message ||
            `Conversion failed: ${convertResponse.statusText}`
        );
        (error as any).status = convertResponse.status;
        (error as any).data = errorData;
        throw error;
      }

      const convertResult = await convertResponse.json();
      setProcessingResult({
        success: true,
        downloadUrl: convertResult.downloadUrl,
        fileName: convertResult.fileName,
        message: "PDF converted successfully",
      });
      router.push(`/download/${convertResult.fileName!}`);

      // Track analytics
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "pdf_to_word_success", {
          files_count: files.length,
          total_size: files.reduce(
            (sum, file) => sum + parseFloat(file.size.replace(" MB", "")),
            0
          ),
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
        error: "Failed to convert PDF. Please try again.",
      });

      // Track error analytics
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "pdf_to_word_error", {
          error: error.message,
        });
      }
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <Header title="PDF to Word" />

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        feature="PDF to Word conversion"
      />

      {files.length === 0 ? (
        // Initial Upload State
        <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-4xl mx-auto">
              <div className="mb-12">
                <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full mb-6">
                  <FileText className="w-4 h-4 text-slate-700" />
                  <span className="text-sm font-semibold text-slate-700">
                    PDF to Word Converter
                  </span>
                </div>

                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                  Convert PDF to Word
                  <br />
                  <span className="text-slate-600">Instantly Editable</span>
                </h1>

                <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-3xl mx-auto">
                  Transform your PDF documents into fully editable Word files
                  while preserving formatting, fonts, and layout. Perfect for
                  legal documents that need editing.
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
                        ? "Drop to start converting"
                        : "Upload PDF to Convert"}
                    </p>
                    <p className="text-sm text-slate-600 mb-4">
                      {isDragOver
                        ? "We'll convert it to an editable Word document"
                        : "Drag & drop or click to browse • Max 50MB"}
                    </p>
                    <div className="flex items-center justify-center space-x-4 text-xs text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Shield className="w-3 h-3" />
                        <span>High Quality</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                      <div className="flex items-center space-x-1">
                        <FileText className="w-3 h-3" />
                        <span>Editable Output</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                      <div className="flex items-center space-x-1">
                        <Zap className="w-3 h-3" />
                        <span>Fast Processing</span>
                      </div>
                    </div>
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={(e) =>
                      e.target.files &&
                      handleFileUpload(Array.from(e.target.files))
                    }
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
            <div className="grid lg:grid-cols-4 gap-8">
              {/* Files Area */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">
                      PDF Files to Convert
                    </h2>
                    <span className="text-sm text-slate-600">
                      {files.length} file(s) selected
                    </span>
                  </div>

                  {/* File List */}
                  <div className="space-y-3">
                    {files.map((file, index) => (
                      <div
                        key={file.id}
                        className="flex items-center p-4 bg-slate-50 rounded-xl border-2 border-transparent"
                      >
                        <div className="flex items-center space-x-4 flex-1">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-blue-600" />
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
                        <button
                          onClick={() => removeFile(file.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add More Files Button */}
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <button
                      onClick={handleAddMoreFiles}
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="font-medium">Add more files</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Sidebar */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8">
                  {/* Convert Button */}
                  <button
                    onClick={convertPDFs}
                    disabled={isConverting || files.length === 0}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-semibold text-lg mb-6 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConverting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    <span>
                      {isConverting ? "Converting..." : "Convert to Word"}
                    </span>
                  </button>

                  {/* Conversion Options */}
                  <div className="space-y-4 mb-6">
                    <h3 className="font-semibold text-slate-800">
                      Conversion Options
                    </h3>
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          defaultChecked
                        />
                        <span className="text-sm text-slate-700">
                          Preserve formatting
                        </span>
                      </label>
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          defaultChecked
                        />
                        <span className="text-sm text-slate-700">
                          Keep images
                        </span>
                      </label>
                      <label className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">
                          OCR for scanned PDFs
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
                    </button>
                    <button className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-center space-x-2">
                        <FolderOpen className="w-4 h-4 text-slate-600" />
                        <span className="text-sm text-slate-700">Dropbox</span>
                      </div>
                    </button>
                    <button
                      onClick={handleAddMoreFiles}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Plus className="w-4 h-4 text-slate-600" />
                        <span className="text-sm text-slate-700">
                          From Device
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Info */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex space-x-3">
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-900 mb-1">
                          Professional Quality
                        </h4>
                        <p className="text-sm text-blue-800">
                          Our conversion engine preserves formatting, fonts, and
                          layout for professional results.
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

      {/* Hidden file input for additional files */}
      <input
        id="additional-file-input"
        type="file"
        multiple
        accept=".pdf"
        onChange={(e) =>
          e.target.files && handleFileUpload(Array.from(e.target.files))
        }
        className="hidden"
      />
    </div>
  );
};

export default PdfToWordPage;
