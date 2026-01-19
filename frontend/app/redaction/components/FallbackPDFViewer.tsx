"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Square,
  MousePointer,
  Highlighter,
  Trash2,
  Eye,
  EyeOff,
  FileText,
  Upload,
  Search,
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

interface FallbackPDFViewerProps {
  file: File | null;
  selectedTool: "select" | "redact" | "highlight";
  redactionAreas: RedactionArea[];
  onRedactionAreasChange: (areas: RedactionArea[]) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  showPreview: boolean;
}

const FallbackPDFViewer: React.FC<FallbackPDFViewerProps> = ({
  file,
  selectedTool,
  redactionAreas,
  onRedactionAreasChange,
  currentPage,
  onPageChange,
  showPreview,
}) => {
  const [zoom, setZoom] = useState(120);
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
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  const viewerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create object URL for PDF file
  useEffect(() => {
    if (file) {
      setIsLoading(true);
      
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      
      // Simulate loading and get page count (in real implementation, use PDF.js)
      setTimeout(() => {
        setTotalPages(Math.floor(Math.random() * 10) + 1);
        setIsLoading(false);
      }, 1000);

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
      console.log('File selected:', selectedFile);
    }
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (selectedTool === "select" || !file) return;

      const rect = pageRef.current?.getBoundingClientRect();
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

      const rect = pageRef.current?.getBoundingClientRect();
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
      const newArea: RedactionArea = {
        id: Date.now().toString(),
        x: currentSelection.x,
        y: currentSelection.y,
        width: currentSelection.width,
        height: currentSelection.height,
        page: currentPage,
        type: selectedTool === "redact" ? "text" : "custom",
        isVerified: false,
        text: `Selected area ${Math.round(currentSelection.width)}x${Math.round(currentSelection.height)}`,
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

  const renderThumbnails = () => {
    if (!file || totalPages === 0) return null;

    return (
      <div className="w-48 bg-white border-r border-slate-200 p-4 overflow-y-auto">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Pages</h3>
        <div className="space-y-3">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                currentPage === pageNum
                  ? "border-blue-500 shadow-md"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              onClick={() => onPageChange(pageNum)}
            >
              <div className="aspect-[3/4] bg-slate-50 flex items-center justify-center text-slate-400">
                <FileText className="w-8 h-8" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs text-center py-1">
                {pageNum}
              </div>
              {redactionAreas.filter(area => area.page === pageNum).length > 0 && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!file) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">
            No PDF Selected
          </h3>
          <p className="text-slate-500 mb-4">
            Upload a PDF file to start redaction
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors mx-auto"
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
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Thumbnails Sidebar */}
      {renderThumbnails()}

      {/* Main PDF Viewer */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            {/* Left Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-slate-700 px-3 min-w-[80px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    onPageChange(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage >= totalPages}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="h-6 w-px bg-slate-300" />

              {/* Zoom Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleZoomOut}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-slate-700 px-3 min-w-[60px] text-center">
                  {zoom}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleRotate}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Right Controls */}
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search text to redact..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Tool Indicator */}
              <div className="flex items-center space-x-2 bg-slate-100 px-3 py-2 rounded-lg">
                {selectedTool === "select" && <MousePointer className="w-4 h-4 text-slate-600" />}
                {selectedTool === "redact" && <Square className="w-4 h-4 text-red-600" />}
                {selectedTool === "highlight" && <Highlighter className="w-4 h-4 text-yellow-600" />}
                <span className="text-sm font-medium text-slate-700 capitalize">
                  {selectedTool}
                </span>
              </div>

              <span className="text-sm text-slate-600">
                {currentPageAreas.length} redaction{currentPageAreas.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-auto bg-slate-100 p-8">
          <div className="flex justify-center">
            <div
              ref={viewerRef}
              className={`relative bg-white shadow-lg ${
                selectedTool !== "select" ? "cursor-crosshair" : "cursor-default"
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: "center",
              }}
            >
              <div ref={pageRef} className="relative">
                {isLoading ? (
                  <div className="flex items-center justify-center h-96 w-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                  </div>
                ) : pdfUrl ? (
                  <iframe
                    src={`${pdfUrl}#page=${currentPage}&zoom=${zoom}`}
                    className="w-full h-full border-0"
                    title="PDF Viewer"
                    style={{
                      width: "800px",
                      height: "1000px",
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: "top left",
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-96 w-96 text-slate-500">
                    <div className="text-center">
                      <FileText className="w-16 h-16 mx-auto mb-4" />
                      <p>Unable to load PDF</p>
                    </div>
                  </div>
                )}

                {/* Redaction Areas Overlay */}
                {currentPageAreas.map((area) => (
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
                    <div className="absolute -top-10 left-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-lg shadow-lg border border-slate-200 p-2 flex items-center space-x-1 z-10">
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
                  </div>
                ))}

                {/* Current Selection */}
                {currentSelection && isSelecting && (
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
        </div>
      </div>
    </div>
  );
};

export default FallbackPDFViewer;
