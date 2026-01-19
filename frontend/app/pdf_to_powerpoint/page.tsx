"use client";

import {
  FileText,
  Download,
  Loader2,
  Monitor,
  Upload,
  Shield,
  Zap,
  CheckCircle,
  X,
  Plus,
  GripVertical,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UploadFile, useFilesContext } from "../context/context";
import { getBatchPdfPageCounts } from "@/lib/pdfUtils";
import Header from "@/components/ui/header";


const PdfToPowerpoint = () => {
  const router = useRouter();
  const { files, setFiles, setProcessingResult } = useFilesContext();
  const [isConverting, setIsConverting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileUpload(droppedFiles);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileUpload = async (uploadedFiles: File[]) => {
    // Validate files
    const validFiles = uploadedFiles.filter(file => {
      if (file.type !== 'application/pdf') {
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

  const convertPDFs = async () => {
    if (files.length < 1) {
      alert("Please select at least 1 PDF file to convert");
      return;
    }

    setIsConverting(true);
    setProcessingResult(null);

    try {
      console.log(`Uploading ${files.length} files...`);

      // Upload all files at once using the new multiple upload endpoint
      const formData = new FormData();
      files.forEach((pdfFile) => {
        formData.append("files", pdfFile.file);
      });

      const uploadResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/upload/pdfs`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log("Upload successful:", uploadResult);

      // Now merge the uploaded files
      const mergeRequest = {
        fileId: uploadResult.files.map((f: any) => f.fileId)[0],
        outputName: "converted-document.pptx",
      };

      const mergeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/pdf-to-powerpoint`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mergeRequest),
        }
      );

      if (!mergeResponse.ok) {
        throw new Error(`Merge failed: ${mergeResponse.statusText}`);
      }

      const mergeResult = await mergeResponse.json();
      setProcessingResult({
        success: true,
        downloadUrl: mergeResult.downloadUrl,
        fileName: mergeResult.fileName,
        message: "PDF converted successfully",
      });
      router.push(`/download/${mergeResult.fileName!}`);

      // Track analytics
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "pdf_to_powerpoint_success", {
          files_count: files.length,
          total_size: files.reduce(
            (sum, file) => sum + parseFloat(file.size.replace(" MB", "")),
            0
          ),
        });
      }
    } catch (error: any) {
      setProcessingResult({
        success: false,
        error: "Failed to convert PDF. Please try again.",
      });

      // Track error analytics
      if (typeof window !== "undefined" && window.gtag) {
        window.gtag("event", "pdf_to_powerpoint_error", {
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
      <Header title="PDF to PowerPoint" />

      {files.length === 0 ? (
        // Initial Upload State
        <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-4xl mx-auto">
              <div className="mb-12">
                <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full mb-6">
                  <Monitor className="w-4 h-4 text-slate-700" />
                  <span className="text-sm font-semibold text-slate-700">
                    PDF to PowerPoint Converter
                  </span>
                </div>

                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                  Convert PDF to PowerPoint
                  <br />
                  <span className="text-slate-600">Editable Presentations</span>
                </h1>

                <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-3xl mx-auto">
                  Transform your PDF documents into fully editable PowerPoint
                  presentations while preserving layout, images, and formatting.
                  Perfect for creating professional slide decks.
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
                        ? "We'll convert it to an editable PowerPoint presentation"
                        : "Drag & drop or click to browse • Max 50MB • Multiple files"}
                    </p>
                    <div className="flex items-center justify-center space-x-4 text-xs text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Shield className="w-3 h-3" />
                        <span>Layout Preserved</span>
                      </div>
                      <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                      <div className="flex items-center space-x-1">
                        <Monitor className="w-3 h-3" />
                        <span>Editable Slides</span>
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
                      multiple
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
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Monitor className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    Professional Slides
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Convert PDF pages to editable PowerPoint slides with
                    preserved formatting and professional layout structure.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    Fast Processing
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Convert your PDFs to presentations in seconds with our
                    optimized conversion engine and real-time progress tracking.
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    Editable Output
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Get fully editable PowerPoint files (.pptx format) that you
                    can customize, present, and share with your team.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        // File Management State
        <section className="pt-8 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  PDF Files to Convert
                </h2>
                <button
                  onClick={handleAddMoreFiles}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add More Files</span>
                </button>
              </div>

              {/* File List */}
              <div className="space-y-3 mb-8">
                {files.map((file, index) => (
                  <div
                    key={file.id}
                    className="flex items-center p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <FileText className="w-8 h-8 text-red-500 mr-4" />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{file.name}</p>
                      <p className="text-sm text-slate-500">
                        {file.size} • {file.pages} pages
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-slate-400 hover:text-slate-600 ml-4"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Conversion Options */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  Conversion Options
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      defaultChecked
                    />
                    <span className="text-sm text-slate-700">Preserve layout</span>
                  </label>
                  <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      defaultChecked
                    />
                    <span className="text-sm text-slate-700">Keep images</span>
                  </label>
                  <label className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">One slide per page</span>
                  </label>
                </div>
              </div>

              {/* Convert Button */}
              <button
                onClick={convertPDFs}
                disabled={isConverting || files.length === 0}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:bg-slate-400 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Converting...</span>
                  </>
                ) : (
                  <>
                    <Monitor className="w-5 h-5" />
                    <span>Convert to PowerPoint</span>
                  </>
                )}
              </button>
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
        onChange={(e) => e.target.files && handleFileUpload(Array.from(e.target.files))}
        className="hidden"
      />
    </div>
  );
};

export default PdfToPowerpoint;
