"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Square,
  MousePointer,
  Highlighter,
  Trash2,
  Eye,
  EyeOff,
  FileText,
  Upload,
} from "lucide-react";

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

interface RealPDFViewerProps {
  file: File | null;
  selectedTool: "select" | "redact" | "highlight";
  redactionAreas: RedactionArea[];
  onRedactionAreasChange: (areas: RedactionArea[]) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  showPreview: boolean;
}

interface TextSelection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  text: string;
  page: number;
}

const RealPDFViewer: React.FC<RealPDFViewerProps> = ({
  file,
  selectedTool,
  redactionAreas,
  onRedactionAreasChange,
  currentPage,
  onPageChange,
  showPreview,
}) => {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create object URL for PDF file
  useEffect(() => {
    if (file) {
      setIsLoading(true);
      setError(null);
      
      // Create object URL for the PDF file
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      
      // Simulate loading and get page count (in real implementation, use PDF.js)
      setTimeout(() => {
        setTotalPages(Math.floor(Math.random() * 10) + 1); // Mock page count
        setIsLoading(false);
      }, 1000);

      // Cleanup URL when component unmounts or file changes
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPdfUrl(null);
      setTotalPages(1);
    }
  }, [file]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      // This would be handled by the parent component
      console.log('File selected:', selectedFile);
    }
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (selectedTool === "select" || !file) return;

      const rect = viewerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setIsSelecting(true);
      setSelectionStart({ x, y });
      setCurrentSelection({ x, y, width: 0, height: 0 });
    },
    [selectedTool, file]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isSelecting || !selectionStart) return;

      const rect = viewerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const width = currentX - selectionStart.x;
      const height = currentY - selectionStart.y;

      setCurrentSelection({
        x: width < 0 ? currentX : selectionStart.x,
        y: height < 0 ? currentY : selectionStart.y,
        width: Math.abs(width),
        height: Math.abs(height),
      });
    },
    [isSelecting, selectionStart]
  );

  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !currentSelection || !selectionStart) return;

    if (currentSelection.width > 10 && currentSelection.height > 10) {
      // Create new redaction area
      const newArea: RedactionArea = {
        id: Date.now().toString(),
        x: currentSelection.x,
        y: currentSelection.y,
        width: currentSelection.width,
        height: currentSelection.height,
        page: currentPage,
        type: selectedTool === "redact" ? "text" : "custom",
        isVerified: false,
        text: `Selected area ${currentSelection.width}x${currentSelection.height}`,
      };

      onRedactionAreasChange([...redactionAreas, newArea]);
    }

    setIsSelecting(false);
    setSelectionStart(null);
    setCurrentSelection(null);
  }, [
    isSelecting,
    currentSelection,
    selectionStart,
    currentPage,
    selectedTool,
    redactionAreas,
    onRedactionAreasChange,
  ]);

  const removeRedactionArea = (id: string) => {
    onRedactionAreasChange(redactionAreas.filter((area) => area.id !== id));
  };

  const toggleAreaVerification = (id: string) => {
    onRedactionAreasChange(
      redactionAreas.map((area) =>
        area.id === id ? { ...area, isVerified: !area.isVerified } : area
      )
    );
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const currentPageAreas = redactionAreas.filter(
    (area) => area.page === currentPage
  );

  // Render PDF using iframe (simple approach) or canvas (advanced approach)
  const renderPDFContent = () => {
    if (!file) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <FileText className="w-16 h-16 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">
            No PDF Selected
          </h3>
          <p className="text-slate-500 mb-4">
            Upload a PDF file to start redaction
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Select PDF File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-700 mb-4"></div>
          <p className="text-slate-600">Loading PDF...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <div className="text-red-500 mb-4">
            <FileText className="w-16 h-16 mx-auto mb-2" />
            <h3 className="text-lg font-semibold">Error Loading PDF</h3>
          </div>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Try Another File
          </button>
        </div>
      );
    }

    // Simple PDF display using iframe (works for basic viewing)
    // For production, you'd want to use PDF.js for better control
    return (
      <div className="relative w-full h-full">
        {pdfUrl && (
          <iframe
            src={`${pdfUrl}#page=${currentPage}&zoom=${zoom}`}
            className="w-full h-full border-0"
            title="PDF Viewer"
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center",
            }}
          />
        )}
        
        {/* PDF.js Canvas Alternative (commented out - requires PDF.js setup) */}
        {/* 
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: "center",
          }}
        />
        */}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1 || !file}
                className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-slate-700 px-3">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  onPageChange(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage >= totalPages || !file}
                className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-300" />

            <div className="flex items-center space-x-2">
              <button
                onClick={handleZoomOut}
                disabled={!file}
                className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-slate-700 px-3">
                {zoom}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={!file}
                className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleRotate}
              disabled={!file}
              className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {file && (
              <span className="text-sm text-slate-600">
                {currentPageAreas.length} redaction{currentPageAreas.length !== 1 ? "s" : ""} on this page
              </span>
            )}
            <button 
              disabled={!file}
              className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="relative overflow-auto" style={{ height: "600px" }}>
        <div
          ref={viewerRef}
          className={`relative bg-gray-100 min-h-full flex items-center justify-center ${
            file && selectedTool !== "select" ? "cursor-crosshair" : "cursor-default"
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* PDF Content */}
          <div className="w-full h-full relative">
            {renderPDFContent()}

            {/* Redaction Areas Overlay (only show if PDF is loaded) */}
            {file && currentPageAreas.map((area) => (
              <div
                key={area.id}
                className={`absolute border-2 cursor-pointer group ${
                  showPreview
                    ? "bg-black"
                    : area.type === "text"
                    ? "bg-red-500 bg-opacity-30 border-red-500"
                    : "bg-yellow-500 bg-opacity-30 border-yellow-500"
                } ${
                  hoveredArea === area.id ? "ring-2 ring-blue-400" : ""
                } ${area.isVerified ? "border-green-500" : ""}`}
                style={{
                  left: area.x,
                  top: area.y,
                  width: area.width,
                  height: area.height,
                }}
                onMouseEnter={() => setHoveredArea(area.id)}
                onMouseLeave={() => setHoveredArea(null)}
              >
                {/* Redaction Controls */}
                <div className="absolute -top-8 left-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-lg shadow-lg border border-slate-200 p-2 flex items-center space-x-1 z-10">
                  <button
                    onClick={() => toggleAreaVerification(area.id)}
                    className={`p-1 rounded ${
                      area.isVerified
                        ? "bg-green-100 text-green-600"
                        : "bg-slate-100 text-slate-600"
                    }`}
                    title={area.isVerified ? "Verified" : "Click to verify"}
                  >
                    {area.isVerified ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    onClick={() => removeRedactionArea(area.id)}
                    className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200"
                    title="Remove redaction"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Redaction Info */}
                {hoveredArea === area.id && (
                  <div className="absolute -bottom-16 left-0 bg-slate-900 text-white text-xs rounded-lg p-2 max-w-xs z-10">
                    <div className="font-medium">
                      {area.type === "text" ? "Text Redaction" : "Custom Redaction"}
                    </div>
                    {area.text && (
                      <div className="text-slate-300 mt-1 truncate">
                        "{area.text}"
                      </div>
                    )}
                    <div className="text-slate-400 mt-1">
                      {area.width}×{area.height}px
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Current Selection */}
            {currentSelection && isSelecting && file && (
              <div
                className={`absolute border-2 border-dashed ${
                  selectedTool === "redact"
                    ? "border-red-500 bg-red-500 bg-opacity-20"
                    : "border-yellow-500 bg-yellow-500 bg-opacity-20"
                }`}
                style={{
                  left: currentSelection.x,
                  top: currentSelection.y,
                  width: currentSelection.width,
                  height: currentSelection.height,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-50 border-t border-slate-200 p-3">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <div className="flex items-center space-x-4">
            <span>
              Tool: <span className="font-medium capitalize">{selectedTool}</span>
            </span>
            <span>
              Zoom: <span className="font-medium">{zoom}%</span>
            </span>
            {rotation > 0 && (
              <span>
                Rotation: <span className="font-medium">{rotation}°</span>
              </span>
            )}
            {file && (
              <span>
                File: <span className="font-medium">{file.name}</span>
              </span>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <span>
              Total Redactions: <span className="font-medium">{redactionAreas.length}</span>
            </span>
            <span>
              Verified: <span className="font-medium text-green-600">
                {redactionAreas.filter(area => area.isVerified).length}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealPDFViewer;
