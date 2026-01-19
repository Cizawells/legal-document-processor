"use client";

import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  CloudArrowUpIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFilesAdded: (files: File[]) => void;
  isUploading?: boolean;
  className?: string;
  maxFiles?: number;
  maxSize?: number; // in bytes
}

export default function FileUpload({
  onFilesAdded,
  isUploading = false,
  className,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (acceptedFiles.length > 0) {
        onFilesAdded(acceptedFiles);
      }

      // Handle rejected files
      rejectedFiles.forEach((file) => {
        console.error("File rejected:", file.file.name, file.errors);
      });
    },
    [onFilesAdded]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    fileRejections,
  } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    maxFiles,
    maxSize,
    disabled: isUploading,
    multiple: true,
  });

  return (
    <div className={cn("w-full", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          "hover:border-blue-400 hover:bg-blue-50",
          isDragActive && "border-blue-400 bg-blue-50",
          isDragReject && "border-red-400 bg-red-50",
          isUploading && "cursor-not-allowed opacity-60",
          !isDragActive && !isDragReject && "border-gray-300"
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center space-y-4">
          {isDragReject ? (
            <ExclamationTriangleIcon className="h-12 w-12 text-red-400" />
          ) : (
            <CloudArrowUpIcon
              className={cn(
                "h-12 w-12 transition-colors",
                isDragActive ? "text-blue-500" : "text-gray-400"
              )}
            />
          )}

          <div className="space-y-2">
            {isDragReject ? (
              <p className="text-sm font-medium text-red-600">
                Only PDF files are allowed
              </p>
            ) : isDragActive ? (
              <p className="text-sm font-medium text-blue-600">
                Drop your PDF files here...
              </p>
            ) : (
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Drop PDF files here, or{" "}
                  <span className="text-blue-600 hover:text-blue-500">
                    click to browse
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Up to {maxFiles} files, max{" "}
                  {Math.round(maxSize / (1024 * 1024))}MB each
                </p>
              </div>
            )}
          </div>

          {isUploading && (
            <div className="flex items-center space-x-2 text-sm text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span>Uploading files...</span>
            </div>
          )}
        </div>
      </div>

      {/* Display file rejection errors */}
      {fileRejections.length > 0 && (
        <div className="mt-4 space-y-2">
          {fileRejections.map(({ file, errors }) => (
            <div
              key={file.name}
              className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 p-3 rounded"
            >
              <DocumentIcon className="h-4 w-4" />
              <span className="font-medium">{file.name}:</span>
              <span>{errors[0]?.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
