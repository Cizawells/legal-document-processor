"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamically import both viewers
const ImprovedPDFViewer = dynamic(() => import("./ImprovedPDFViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
    </div>
  ),
});

const FallbackPDFViewer = dynamic(() => import("./FallbackPDFViewer"), {
  ssr: false,
});

interface RedactionArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  type: "text" | "image" | "custom";
  reason?: string;
  isVerified: boolean;
  text?: string;
}

interface HybridPDFViewerProps {
  file: File | null;
  selectedTool: "select" | "redact" | "highlight";
  redactionAreas: RedactionArea[];
  onRedactionAreasChange: (areas: RedactionArea[]) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  showPreview: boolean;
  redactionColor?: string;
}

const HybridPDFViewer: React.FC<HybridPDFViewerProps> = (props) => {
  const [useImproved, setUseImproved] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Error boundary for the improved viewer
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (
        event.message?.includes("DOMMatrix") ||
        event.message?.includes("pdfjs")
      ) {
        console.warn(
          "PDF.js error detected, falling back to simple viewer:",
          event.message
        );
        setUseImproved(false);
        setHasError(true);
      }
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  // If there's an error or we're explicitly using fallback, use the fallback viewer
  if (hasError || !useImproved) {
    return <FallbackPDFViewer {...props} />;
  }

  // Try to use the improved viewer with error boundary
  return (
    <ErrorBoundary onError={() => setUseImproved(false)}>
      <ImprovedPDFViewer {...props} />
    </ErrorBoundary>
  );
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn("PDF viewer error, falling back:", error, errorInfo);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 bg-slate-50 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-amber-600 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-600 mb-2">
              Loading Alternative Viewer
            </h3>
            <p className="text-slate-500">
              Switching to fallback PDF viewer...
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default HybridPDFViewer;
