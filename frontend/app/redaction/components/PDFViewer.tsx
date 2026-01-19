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

interface PDFViewerProps {
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

const PDFViewer: React.FC<PDFViewerProps> = ({
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

  const viewerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mock PDF content - in a real implementation, you'd use react-pdf or pdf.js
  const mockPdfContent = [
    {
      page: 1,
      content: `CONFIDENTIAL LEGAL DOCUMENT

Attorney-Client Privileged Communication

Case: Smith vs. Johnson Medical Center
Client: John Smith (SSN: 123-45-6789)
Date: October 1, 2025

MEDICAL RECORDS SUMMARY

Patient Information:
Name: John Smith
DOB: January 15, 1980
Address: 123 Main Street, Anytown, ST 12345
Phone: (555) 123-4567
Insurance: Blue Cross Blue Shield Policy #ABC123456

Medical History:
The patient presented with symptoms of chest pain and shortness of breath.
Dr. Sarah Johnson conducted a thorough examination on September 15, 2025.

Diagnosis: Acute myocardial infarction
Treatment: Emergency cardiac catheterization performed
Prognosis: Good with proper medication and lifestyle changes

ATTORNEY NOTES:
This case involves potential medical malpractice. The delay in diagnosis
may have contributed to the severity of the patient's condition.

Settlement discussions: $250,000 proposed by defendant's counsel.
Client's medical expenses total $45,000 to date.

CONFIDENTIAL - ATTORNEY WORK PRODUCT`,
    },
    {
      page: 2,
      content: `WITNESS STATEMENTS

Witness 1: Mary Johnson (No relation to defendant)
Address: 456 Oak Avenue, Anytown, ST 12345
Phone: (555) 987-6543

Statement: "I saw Mr. Smith waiting in the emergency room for over 2 hours
before anyone examined him. He was clearly in distress and kept asking
for help."

Witness 2: Dr. Michael Brown, Cardiologist
Medical License: MD123456
Phone: (555) 555-0123

Expert Opinion: "The standard of care requires immediate evaluation of
chest pain patients. A 2-hour delay is unreasonable and likely contributed
to the extent of cardiac damage."

FINANCIAL ANALYSIS:
Lost wages: $75,000 (estimated)
Future medical costs: $125,000 (estimated)
Pain and suffering: $500,000 (requested)

Bank Account Information:
Account Number: 9876543210
Routing Number: 123456789
Current Balance: $15,750.00

STRATEGY NOTES:
Focus on the delay in treatment and its impact on patient outcome.
Emphasize the financial hardship caused by the medical bills.`,
    },
  ];

  useEffect(() => {
    setTotalPages(mockPdfContent.length);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (selectedTool === "select") return;

      const rect = viewerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setIsSelecting(true);
      setSelectionStart({ x, y });
      setCurrentSelection({ x, y, width: 0, height: 0 });
    },
    [selectedTool]
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
        text: getSelectedText(currentSelection),
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

  const getSelectedText = (selection: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): string => {
    // Mock text extraction based on selection area
    const pageContent = mockPdfContent[currentPage - 1]?.content || "";
    const lines = pageContent.split("\n");

    // Simple approximation - in real implementation, you'd use PDF.js text layer
    const startLine = Math.floor((selection.y - 50) / 25);
    const endLine = Math.floor((selection.y + selection.height - 50) / 25);

    const selectedLines = lines.slice(
      Math.max(0, startLine),
      Math.min(lines.length, endLine + 1)
    );

    return selectedLines.join(" ").substring(0, 100) + "...";
  };

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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
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
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-300" />

            <div className="flex items-center space-x-2">
              <button
                onClick={handleZoomOut}
                className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-slate-700 px-3">
                {zoom}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleRotate}
              className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-slate-600">
              {currentPageAreas.length} redaction{currentPageAreas.length !== 1 ? "s" : ""} on this page
            </span>
            <button className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50">
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="relative overflow-auto" style={{ height: "600px" }}>
        <div
          ref={viewerRef}
          className="relative bg-gray-100 min-h-full flex items-center justify-center p-8 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: "center",
          }}
        >
          {/* PDF Page */}
          <div className="bg-white shadow-lg relative" style={{ width: "600px", minHeight: "800px" }}>
            {/* Mock PDF Content */}
            <div className="p-8 font-mono text-sm leading-6 whitespace-pre-wrap">
              {mockPdfContent[currentPage - 1]?.content}
            </div>

            {/* Redaction Areas */}
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

export default PDFViewer;
