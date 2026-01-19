"use client";

import React from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface MergeButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  fileCount: number;
  className?: string;
}

export default function MergeButton({
  onClick,
  disabled = false,
  isLoading = false,
  fileCount,
  className,
}: MergeButtonProps) {
  const canMerge = fileCount >= 2 && !disabled && !isLoading;

  return (
    <button
      onClick={onClick}
      disabled={!canMerge}
      className={cn(
        "w-full flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-all",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        canMerge
          ? "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500"
          : "bg-gray-300 text-gray-500 cursor-not-allowed",
        className
      )}
    >
      {isLoading && (
        <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
      )}

      {isLoading
        ? "Merging PDFs..."
        : fileCount < 2
        ? `Add ${2 - fileCount} more PDF${
            2 - fileCount === 1 ? "" : "s"
          } to merge`
        : `Merge ${fileCount} PDFs`}
    </button>
  );
}
