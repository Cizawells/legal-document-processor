// components/ui/FileList.tsx
"use client";

import React from "react";
import {
  DocumentIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { PDFFile } from "@/types/pdf";
import { formatFileSize, cn } from "@/lib/utils";

interface FileListProps {
  files: PDFFile[];
  onRemoveFile: (fileId: string) => void;
  onReorderFiles?: (startIndex: number, endIndex: number) => void;
  className?: string;
}

export default function FileList({
  files,
  onRemoveFile,
  onReorderFiles,
  className,
}: FileListProps) {
  if (files.length === 0) {
    return null;
  }

  const getStatusIcon = (file: PDFFile) => {
    switch (file.status) {
      case "uploaded":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "error":
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
      case "uploading":
        return (
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
        );
      default:
        return <DocumentIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-sm font-medium text-gray-900">
        Files to merge ({files.length})
      </h3>

      <div className="space-y-2">
        {files.map((file, index) => (
          <div
            key={file.id}
            className={cn(
              "flex items-center justify-between p-3 bg-white border rounded-lg",
              "hover:shadow-sm transition-shadow",
              file.status === "error" && "border-red-200 bg-red-50"
            )}
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {getStatusIcon(file)}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.originalName}
                </p>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>{formatFileSize(file.size)}</span>
                  {file.status === "uploading" && file.progress && (
                    <span>{file.progress}%</span>
                  )}
                  {file.status === "error" && file.error && (
                    <span className="text-red-600">{file.error}</span>
                  )}
                </div>

                {/* Progress bar for uploading files */}
                {file.status === "uploading" && (
                  <div className="mt-2 bg-gray-200 rounded-full h-1">
                    <div
                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${file.progress || 0}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Remove button */}
            <button
              onClick={() => onRemoveFile(file.id)}
              className="ml-3 p-1 text-gray-400 hover:text-red-500 transition-colors"
              disabled={file.status === "uploading"}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>

      {files.length >= 2 && (
        <p className="text-xs text-gray-500 mt-2">
          💡 Files will be merged in the order shown above
        </p>
      )}
    </div>
  );
}
