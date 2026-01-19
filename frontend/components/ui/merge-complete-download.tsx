import {
  Check,
  Clock,
  Cloud,
  Download,
  FileText,
  FolderOpen,
  RotateCcw,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

const MergeCompleteComponent = ({
  mergedFileName = "merged-document.pdf",
  originalFilesCount = 3,
  onStartOver,
  onClose,
}: {
  mergedFileName: string;
  originalFilesCount: number;
  onStartOver: () => void;
  onClose: () => void;

}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Auto-show success animation after component mounts
    const timer = setTimeout(() => setShowSuccess(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleDownload = async () => {
    setIsDownloading(true);
    // Simulate download process
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsDownloading(false);
    console.log("Downloading merged PDF...");
  };

  const handleSaveToCloud = (service: string) => {
    console.log(`Saving to ${service}...`);
    // In real app: integrate with cloud service APIs
  };

  const handleDelete = () => {
    console.log("Deleting merged file...");
    onClose?.();
  };

  const handleShare = () => {
    console.log("Sharing file...");
    // In real app: generate share link
  };

  return (
    <div className="min-h-[600px] flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-8">
      <div className="text-center max-w-2xl mx-auto">
        {/* Success Animation */}
        <div
          className={`transform transition-all duration-1000 ${
            showSuccess ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
        >
          <div className="w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Check className="w-12 h-12 text-white animate-pulse" />
          </div>
        </div>

        {/* Success Message */}
        <div
          className={`transform transition-all duration-1000 delay-300 ${
            showSuccess
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
        >
          <h1 className="text-4xl font-bold text-slate-800 mb-3">
            PDFs Merged Successfully!
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            {originalFilesCount} PDF files have been combined into one document
          </p>
        </div>

        {/* File Info */}
        <div
          className={`transform transition-all duration-1000 delay-500 ${
            showSuccess
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
        >
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
            <div className="flex items-center justify-center space-x-4">
              <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center">
                <FileText className="w-8 h-8 text-red-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-slate-800 text-lg">
                  {mergedFileName}
                </h3>
                <p className="text-slate-600">Ready for download</p>
              </div>
            </div>
          </div>
        </div>

        {/* Download Button */}
        <div
          className={`transform transition-all duration-1000 delay-700 ${
            showSuccess
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
        >
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-12 py-6 rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-semibold text-xl mb-8 flex items-center space-x-3 mx-auto shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isDownloading ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download className="w-6 h-6" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div
          className={`transform transition-all duration-1000 delay-900 ${
            showSuccess
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* Save to Google Drive */}
            <button
              onClick={() => handleSaveToCloud("Google Drive")}
              className="flex flex-col items-center p-4 bg-white rounded-xl hover:bg-slate-50 transition-colors border border-slate-200 group"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-2 group-hover:bg-blue-200 transition-colors">
                <Cloud className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">
                Save to Drive
              </span>
            </button>

            {/* Save to Dropbox */}
            <button
              onClick={() => handleSaveToCloud("Dropbox")}
              className="flex flex-col items-center p-4 bg-white rounded-xl hover:bg-slate-50 transition-colors border border-slate-200 group"
            >
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-2 group-hover:bg-indigo-200 transition-colors">
                <FolderOpen className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">
                Save to Dropbox
              </span>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex flex-col items-center p-4 bg-white rounded-xl hover:bg-slate-50 transition-colors border border-slate-200 group"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-2 group-hover:bg-purple-200 transition-colors">
                <Share2 className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Share</span>
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              className="flex flex-col items-center p-4 bg-white rounded-xl hover:bg-red-50 transition-colors border border-slate-200 group"
            >
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mb-2 group-hover:bg-red-200 transition-colors">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm font-medium text-slate-700">Delete</span>
            </button>
          </div>
        </div>

        {/* Additional Options */}
        <div
          className={`transform transition-all duration-1000 delay-1100 ${
            showSuccess
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
        >
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={onStartOver}
              className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-slate-600" />
              <span className="text-slate-700 font-medium">
                Merge More PDFs
              </span>
            </button>

            <button className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">
              <Star className="w-4 h-4 text-slate-600" />
              <span className="text-slate-700 font-medium">Rate this Tool</span>
            </button>
          </div>
        </div>

        {/* Auto-delete Notice */}
        <div
          className={`transform transition-all duration-1000 delay-1300 ${
            showSuccess
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
        >
          <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-center justify-center space-x-2 text-amber-800">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                Your merged PDF will be automatically deleted in 1 hour for
                security
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MergeCompleteComponent;
