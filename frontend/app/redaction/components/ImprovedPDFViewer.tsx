"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
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
  Search,
  Download,
  Shield,
} from "lucide-react";

// Dynamically import react-pdf components to avoid SSR issues
const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false }
);
const Page = dynamic(() => import("react-pdf").then((mod) => mod.Page), {
  ssr: false,
});

// Worker initialization state
let workerInitialized: Promise<void> | null = null;
let isWorkerReady = false;

// Set worker only on client side with better error handling
if (typeof window !== "undefined") {
  workerInitialized = (async () => {
    try {
      const [reactPdf, pdfjsDist] = await Promise.all([
        import("react-pdf"),
        import("pdfjs-dist"),
      ]);

      // Use the local worker that's copied by the build script
      const workerSrc = "/pdf-worker/pdf.worker.min.js";

      reactPdf.pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      pdfjsDist.GlobalWorkerOptions.workerSrc = workerSrc;

      isWorkerReady = true;
      console.log(
        `PDF.js workers initialized successfully with local worker: ${workerSrc}`
      );
    } catch (error) {
      console.error("Failed to initialize PDF.js workers:", error);
      throw error;
    }
  })();
}

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

interface ImprovedPDFViewerProps {
  file: File | null;
  selectedTool: "select" | "redact" | "highlight";
  redactionAreas: RedactionArea[];
  onRedactionAreasChange: (areas: RedactionArea[]) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  showPreview: boolean;
  redactionColor?: string;
}

const ImprovedPDFViewer: React.FC<ImprovedPDFViewerProps> = React.memo(
  ({
    file,
    selectedTool,
    redactionAreas,
    onRedactionAreasChange,
    currentPage,
    onPageChange,
    showPreview,
    redactionColor: propRedactionColor,
  }) => {
    const [zoom, setZoom] = useState(0.9);
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
    const [selectedArea, setSelectedArea] = useState<string | null>(null);
    const [resizingArea, setResizingArea] = useState<{
      id: string;
      handle: string;
    } | null>(null);
    const [resizeStart, setResizeStart] = useState<{
      x: number;
      y: number;
      area: RedactionArea;
    } | null>(null);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchText, setSearchText] = useState("");
    const [searchResults, setSearchResults] = useState<
      Array<{ page: number; bbox: number[]; text: string }>
    >([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [redactionColor, setRedactionColor] = useState(
      propRedactionColor || "#000000"
    );
    const [thumbnails, setThumbnails] = useState<{ [key: number]: string }>({});
    const [loadingThumbnails, setLoadingThumbnails] = useState<{
      [key: number]: boolean;
    }>({});
    const [showThumbnails, setShowThumbnails] = useState(false); // Hidden by default for better space usage
    const [containerWidth, setContainerWidth] = useState(800); // Default width
    const [isDocumentReady, setIsDocumentReady] = useState(false);
    const [isPdfWorkerReady, setIsPdfWorkerReady] = useState(false);
    const [pageDimensions, setPageDimensions] = useState<
      Record<number, { width: number; height: number }>
    >({});
    const [renderedPageSizes, setRenderedPageSizes] = useState<
      Record<number, { width: number; height: number }>
    >({});

    const viewerRef = useRef<HTMLDivElement>(null);
    const pageRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // Ensure component only renders on client side
    useEffect(() => {
      setIsClient(true);
    }, []);

    // Wait for PDF.js worker to be ready before rendering PDF
    useEffect(() => {
      const checkWorkerReady = async () => {
        if (workerInitialized) {
          try {
            await workerInitialized;
            setIsPdfWorkerReady(true);
          } catch (error) {
            console.error("Worker initialization failed:", error);
            setError(
              "Failed to initialize PDF worker. Please refresh the page and try again."
            );
            setIsPdfWorkerReady(false);
          }
        } else {
          // If no worker initialization promise, assume ready (fallback)
          setIsPdfWorkerReady(true);
        }
      };

      if (isClient) {
        checkWorkerReady();
      }
    }, [isClient]);

    // Reset state when file changes to prevent stale data
    useEffect(() => {
      if (file) {
        setThumbnails({});
        setLoadingThumbnails({});
        setIsDocumentReady(false);
        setIsLoading(true);
        setError(null);
        setPageDimensions({});
        setRenderedPageSizes({});
      }
    }, [file]);

    // Measure container width for responsive PDF sizing with debouncing
    useEffect(() => {
      if (!containerRef.current) return;

      let timeoutId: NodeJS.Timeout;
      const resizeObserver = new ResizeObserver((entries) => {
        // Debounce resize updates to prevent excessive rerenders
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          for (const entry of entries) {
            const width = entry.contentRect.width;
            const newWidth = Math.max(300, width - 32); // Subtract padding (16px * 2)

            // Only update if width changed significantly (>10px difference)
            setContainerWidth((prev) => {
              if (Math.abs(prev - newWidth) > 10) {
                return newWidth;
              }
              return prev;
            });
          }
        }, 100); // 100ms debounce
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        clearTimeout(timeoutId);
        resizeObserver.disconnect();
      };
    }, []);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile && selectedFile.type === "application/pdf") {
        console.log("File selected:", selectedFile);
      }
    };

    // Load PDF page dimensions (in PDF coordinate space) using pdfjs
    useEffect(() => {
      const loadPageDimensions = async () => {
        if (!file || !isClient || !isPdfWorkerReady) return;

        try {
          const pdfjsLib = await import("pdfjs-dist");
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;

          const dims: Record<number, { width: number; height: number }> = {};
          for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.0 });
            dims[pageNum] = { width: viewport.width, height: viewport.height };
          }
          setPageDimensions(dims);
        } catch (err) {
          console.error("Failed to load page dimensions", err);
        }
      };

      loadPageDimensions();
    }, [file, isClient, isPdfWorkerReady]);

    // Track rendered page size in pixels for each page (used to map PDF coords -> viewer coords)
    useEffect(() => {
      if (!isDocumentReady) return;

      // Use the actual width that React-PDF Page component uses
      const renderedWidth = containerWidth * zoom;

      // Calculate height based on PDF aspect ratio
      const dims = pageDimensions[currentPage];
      if (!dims) return;

      const aspectRatio = dims.height / dims.width;
      const renderedHeight = renderedWidth * aspectRatio;

      console.log(
        `Page ${currentPage} rendered size: ${renderedWidth} x ${renderedHeight} (calculated from containerWidth=${containerWidth}, zoom=${zoom})`
      );
      console.log(`PDF dimensions: ${dims.width} x ${dims.height}`);

      setRenderedPageSizes((prev) => ({
        ...prev,
        [currentPage]: { width: renderedWidth, height: renderedHeight },
      }));
    }, [isDocumentReady, currentPage, containerWidth, zoom, pageDimensions]);

    const getPageScale = useCallback(
      (page: number) => {
        const dims = pageDimensions[page];
        const size = renderedPageSizes[page];
        if (!dims || !size || !dims.width || !dims.height) {
          return { scaleX: zoom, scaleY: zoom };
        }
        const scaleX = size.width / dims.width;
        const scaleY = size.height / dims.height;
        return { scaleX, scaleY };
      },
      [pageDimensions, renderedPageSizes, zoom]
    );

    const viewerToPdfCoords = useCallback(
      (page: number, xView: number, yView: number) => {
        const dims = pageDimensions[page];
        const size = renderedPageSizes[page];

        // Debug logging
        console.log(
          `viewerToPdfCoords: page=${page}, xView=${xView}, yView=${yView}`
        );
        console.log(`PDF dims:`, dims);
        console.log(`Rendered size:`, size);

        if (
          !dims ||
          !size ||
          !dims.width ||
          !dims.height ||
          !size.width ||
          !size.height
        ) {
          const fallback = { x: xView / zoom, y: yView / zoom };
          console.log(`Using fallback coords:`, fallback);
          return fallback;
        }

        // Calculate scale factors
        // React-PDF renders at: containerWidth * zoom
        // PDF natural size: dims.width x dims.height
        const scaleX = size.width / dims.width;
        const scaleY = size.height / dims.height;

        console.log(`Scale calculation:`);
        console.log(
          `  Rendered width: ${size.width} = containerWidth(${containerWidth}) * zoom(${zoom})`
        );
        console.log(`  PDF width: ${dims.width}`);
        console.log(`  Scale: scaleX=${scaleX}, scaleY=${scaleY}`);

        // Convert viewer coordinates to PDF coordinates
        const result = {
          x: xView / scaleX,
          y: yView / scaleY,
        };
        console.log(
          `Converted coords: (${xView}, ${yView}) -> (${result.x}, ${result.y})`
        );
        return result;
      },
      [zoom, pageDimensions, renderedPageSizes, containerWidth]
    );

    const pdfToViewerCoords = useCallback(
      (page: number, xPdf: number, yPdf: number) => {
        const { scaleX, scaleY } = getPageScale(page);
        return {
          x: xPdf * scaleX,
          y: yPdf * scaleY,
        };
      },
      [getPageScale]
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        // Don't start new selection if resizing
        if (resizingArea) return;

        if (selectedTool === "select" || !file) return;

        const rect = viewerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const xView = e.clientX - rect.left;
        const yView = e.clientY - rect.top;
        const { x, y } = viewerToPdfCoords(currentPage, xView, yView);

        setIsSelecting(true);
        setSelectionStart({ x, y });
        setCurrentSelection({ x, y, width: 0, height: 0 });
      },
      [selectedTool, file, resizingArea, viewerToPdfCoords, currentPage]
    );

    const handleMouseMove = useCallback(
      (e: React.MouseEvent) => {
        const rect = viewerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const currentXView = e.clientX - rect.left;
        const currentYView = e.clientY - rect.top;
        const { x: currentX, y: currentY } = viewerToPdfCoords(
          currentPage,
          currentXView,
          currentYView
        );

        // Handle resizing
        if (resizingArea && resizeStart) {
          const deltaX = currentX - resizeStart.x;
          const deltaY = currentY - resizeStart.y;
          const area = resizeStart.area;
          const handle = resizingArea.handle;

          let newArea = { ...area };

          // Update based on which handle is being dragged
          if (handle.includes("n")) {
            newArea.y = area.y + deltaY;
            newArea.height = area.height - deltaY;
          }
          if (handle.includes("s")) {
            newArea.height = area.height + deltaY;
          }
          if (handle.includes("w")) {
            newArea.x = area.x + deltaX;
            newArea.width = area.width - deltaX;
          }
          if (handle.includes("e")) {
            newArea.width = area.width + deltaX;
          }

          // Ensure minimum size
          if (newArea.width < 10) newArea.width = 10;
          if (newArea.height < 10) newArea.height = 10;

          onRedactionAreasChange(
            redactionAreas.map((a) => (a.id === resizingArea.id ? newArea : a))
          );
          return;
        }

        // Handle drawing new selection
        if (!isSelecting || !selectionStart) return;

        const width = currentX - selectionStart.x;
        const height = currentY - selectionStart.y;

        setCurrentSelection({
          x: width < 0 ? currentX : selectionStart.x,
          y: height < 0 ? currentY : selectionStart.y,
          width: Math.abs(width),
          height: Math.abs(height),
        });
      },
      [
        isSelecting,
        selectionStart,
        viewerToPdfCoords,
        currentPage,
        resizingArea,
        resizeStart,
        redactionAreas,
        onRedactionAreasChange,
      ]
    );

    const handleMouseUp = useCallback(() => {
      // End resizing
      if (resizingArea) {
        setResizingArea(null);
        setResizeStart(null);
        return;
      }

      // End drawing new selection
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
          text: `Selected area ${Math.round(
            currentSelection.width
          )}x${Math.round(currentSelection.height)}`,
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
      resizingArea,
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

    const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 0.9));
    const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.5));
    const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

    // Optimized page change handler
    const handlePageChange = useCallback(
      (newPage: number) => {
        if (newPage !== currentPage && newPage >= 1 && newPage <= totalPages) {
          onPageChange(newPage);
        }
      },
      [currentPage, totalPages, onPageChange]
    );

    const currentPageAreas = redactionAreas.filter(
      (area) => area.page === currentPage
    );

    const onDocumentLoadSuccess = useCallback(
      ({ numPages }: { numPages: number }) => {
        console.log(`PDF loaded successfully with ${numPages} pages`);
        setTotalPages(numPages);
        setIsLoading(false);
        setError(null);
        setIsDocumentReady(true);
      },
      []
    );

    // Generate thumbnail for a specific page
    // Generate thumbnail for a specific page
    const generateThumbnail = useCallback(
      async (pageNumber: number) => {
        if (!file || thumbnails[pageNumber] || loadingThumbnails[pageNumber])
          return;

        setLoadingThumbnails((prev) => ({ ...prev, [pageNumber]: true }));

        try {
          console.log(`Generating thumbnail for page ${pageNumber}...`);

          // Wait for main worker to be ready first
          if (workerInitialized) {
            console.log("Waiting for main worker to be ready...");
            await workerInitialized;
          }

          // Import PDF.js dynamically
          const pdfjsLib = await import("pdfjs-dist");

          // Check current worker configuration
          console.log(
            "Current worker src:",
            pdfjsLib.GlobalWorkerOptions.workerSrc
          );

          // Don't override worker if it's already set - use the existing one
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            const thumbnailWorkerSrc = "/pdf-worker/pdf.worker.min.js";
            pdfjsLib.GlobalWorkerOptions.workerSrc = thumbnailWorkerSrc;
            console.log(
              "Set local worker for thumbnail generation:",
              thumbnailWorkerSrc
            );
          } else {
            console.log("Using existing worker for thumbnail generation");
          }

          // Convert File to ArrayBuffer
          console.log("Converting file to ArrayBuffer...");
          const arrayBuffer = await file.arrayBuffer();
          console.log("ArrayBuffer size:", arrayBuffer.byteLength);

          // Load the PDF document with simplified configuration for thumbnails
          console.log("Creating PDF loading task...");
          const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            // Simplified configuration to avoid CDN issues
            disableAutoFetch: true,
            disableStream: false,
          });

          console.log("Waiting for PDF document to load...");
          const pdf = await loadingTask.promise;
          console.log("PDF loaded successfully, total pages:", pdf.numPages);

          // Get the specific page
          console.log(`Getting page ${pageNumber}...`);
          const page = await pdf.getPage(pageNumber);
          console.log("Page retrieved successfully");

          // Set up the canvas with better scaling
          const scale = 0.5; // Increased from 0.4 for better quality
          const viewport = page.getViewport({ scale });
          console.log(
            "Viewport created:",
            viewport.width,
            "x",
            viewport.height
          );

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d", {
            alpha: false, // No transparency needed
            willReadFrequently: false,
          });

          if (!context) {
            throw new Error("Could not get canvas context");
          }

          // Set canvas dimensions BEFORE rendering
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // Fill with white background FIRST
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);

          // Render the page with proper settings
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
            intent: "display" as const,
            renderInteractiveForms: false,
            annotationMode: 0, // Disable annotations for thumbnails
            enableWebGL: false, // Disable WebGL for better compatibility
          };

          // CRITICAL: Wait for render to complete
          console.log("Starting page render...");
          const renderTask = page.render(renderContext);
          await renderTask.promise;
          console.log("Page render completed");

          // Small delay to ensure render is complete
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Convert to data URL with high quality
          console.log("Converting canvas to data URL...");
          const dataUrl = canvas.toDataURL("image/png", 0.95);
          console.log("Data URL created, length:", dataUrl.length);

          // Verify we got actual image data (not just white/black)
          if (dataUrl.length < 1000) {
            throw new Error("Generated thumbnail appears to be empty");
          }

          console.log(
            `Successfully generated thumbnail for page ${pageNumber} (${dataUrl.length} bytes)`
          );

          // Cleanup
          page.cleanup();

          // Batch state updates to prevent multiple rerenders
          setThumbnails((prev) => ({ ...prev, [pageNumber]: dataUrl }));
          setLoadingThumbnails((prev) => ({ ...prev, [pageNumber]: false }));
        } catch (error) {
          console.error(
            `Failed to generate thumbnail for page ${pageNumber}:`,
            error
          );
          // Batch error state updates
          setThumbnails((prev) => ({ ...prev, [pageNumber]: "error" }));
          setLoadingThumbnails((prev) => ({ ...prev, [pageNumber]: false }));
        }
      },
      [file, thumbnails, loadingThumbnails]
    );

    // Generate thumbnails for visible pages
    useEffect(() => {
      if (!file || totalPages === 0 || !isClient || !isPdfWorkerReady) return;

      // Generate thumbnail for current page immediately
      if (!thumbnails[currentPage] && !loadingThumbnails[currentPage]) {
        generateThumbnail(currentPage);
      }

      // Generate thumbnails for nearby pages (preload)
      const pagesToGenerate = [];
      for (
        let i = Math.max(1, currentPage - 2);
        i <= Math.min(totalPages, currentPage + 2);
        i++
      ) {
        if (!thumbnails[i] && !loadingThumbnails[i]) {
          pagesToGenerate.push(i);
        }
      }

      // Generate thumbnails with slight delays to avoid overwhelming the browser
      pagesToGenerate.forEach((pageNum, index) => {
        setTimeout(() => {
          generateThumbnail(pageNum);
        }, index * 100);
      });
    }, [
      file,
      totalPages,
      isClient,
      isPdfWorkerReady,
      currentPage,
      thumbnails,
      loadingThumbnails,
      generateThumbnail,
    ]);

    const onDocumentLoadError = (error: Error) => {
      setError(error?.message);
      setIsLoading(false);
    };

    // Search for text in PDF
    const handleSearch = useCallback(async () => {
      if (!file || !searchText.trim() || totalPages === 0) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      const results: Array<{ page: number; bbox: number[]; text: string }> = [];

      try {
        const pdfjsLib = await import("pdfjs-dist");
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        // Search through all pages
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const viewport = page.getViewport({ scale: 1.0 });

          // Search through text items
          textContent.items.forEach((item: any) => {
            if (
              item.str &&
              item.str.toLowerCase().includes(searchText.toLowerCase())
            ) {
              // Calculate bounding box
              const transform = item.transform;
              const x = transform[4];
              const y = viewport.height - transform[5];
              const width = item.width;
              const height = item.height;

              results.push({
                page: pageNum,
                bbox: [x, y - height, x + width, y],
                text: item.str,
              });
            }
          });
        }

        setSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, [file, searchText, totalPages]);

    // Auto-search when text changes (debounced)
    useEffect(() => {
      const timer = setTimeout(() => {
        if (searchText.trim()) {
          handleSearch();
        } else {
          setSearchResults([]);
        }
      }, 500);

      return () => clearTimeout(timer);
    }, [searchText, handleSearch]);

    // Add all search results as redaction areas
    const redactAllSearchResults = useCallback(() => {
      if (searchResults.length === 0) return;

      const newAreas: RedactionArea[] = searchResults.map((result, index) => ({
        id: `search-${Date.now()}-${index}`,
        x: result.bbox[0],
        y: result.bbox[1],
        width: result.bbox[2] - result.bbox[0],
        height: result.bbox[3] - result.bbox[1],
        page: result.page,
        type: "text" as const,
        isVerified: false,
        text: result.text,
      }));

      onRedactionAreasChange([...redactionAreas, ...newAreas]);
      setSearchText("");
      setSearchResults([]);
    }, [searchResults, redactionAreas, onRedactionAreasChange]);

    // Start resizing an area
    const startResize = useCallback(
      (e: React.MouseEvent, areaId: string, handle: string) => {
        e.stopPropagation();
        const rect = viewerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const area = redactionAreas.find((a) => a.id === areaId);
        if (!area) return;

        const xView = e.clientX - rect.left;
        const yView = e.clientY - rect.top;
        const { x, y } = viewerToPdfCoords(currentPage, xView, yView);

        setResizingArea({ id: areaId, handle });
        setResizeStart({ x, y, area });
        setSelectedArea(areaId);
      },
      [redactionAreas, viewerToPdfCoords, currentPage]
    );

    const renderThumbnails = () => {
      if (!file || totalPages === 0 || !isClient || !isPdfWorkerReady)
        return null;

      return (
        <div
          className={`w-48 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ${
            showThumbnails ? "block" : "hidden xl:block"
          }`}
        >
          <div className="p-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">
              Pages ({totalPages})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNum) => {
                  const pageRedactions = redactionAreas.filter(
                    (area) => area.page === pageNum
                  ).length;
                  return (
                    <div
                      key={pageNum}
                      className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all hover:shadow-md ${
                        currentPage === pageNum
                          ? "border-red-500 shadow-lg ring-2 ring-red-200"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      <div className="aspect-[3/4] bg-slate-50 flex items-center justify-center relative">
                        {thumbnails[pageNum] &&
                        thumbnails[pageNum] !== "error" ? (
                          // Show actual PDF thumbnail
                          <img
                            src={thumbnails[pageNum]}
                            alt={`Page ${pageNum}`}
                            className="w-full h-full object-contain rounded"
                            onLoad={() => {
                              // Trigger generation of nearby thumbnails when one loads
                              if (pageNum > 1 && !thumbnails[pageNum - 1]) {
                                setTimeout(
                                  () => generateThumbnail(pageNum - 1),
                                  100
                                );
                              }
                              if (
                                pageNum < totalPages &&
                                !thumbnails[pageNum + 1]
                              ) {
                                setTimeout(
                                  () => generateThumbnail(pageNum + 1),
                                  200
                                );
                              }
                            }}
                          />
                        ) : thumbnails[pageNum] === "error" ? (
                          // Show error state
                          <div
                            className="w-full h-full flex flex-col items-center justify-center bg-red-50 border border-red-200 rounded cursor-pointer hover:bg-red-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Retry thumbnail generation
                              setThumbnails((prev) => {
                                const newThumbnails = { ...prev };
                                delete newThumbnails[pageNum];
                                return newThumbnails;
                              });
                              generateThumbnail(pageNum);
                            }}
                          >
                            <FileText className="w-8 h-8 text-red-400 mb-2" />
                            <div className="text-sm font-medium text-red-600">
                              Error
                            </div>
                            <div className="text-xs text-red-500 mt-1">
                              Click to retry
                            </div>
                          </div>
                        ) : loadingThumbnails[pageNum] ? (
                          // Show loading state
                          <div className="w-full h-full flex flex-col items-center justify-center bg-white border border-slate-200 rounded">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mb-2"></div>
                            <div className="text-xs text-slate-500">
                              Loading...
                            </div>
                          </div>
                        ) : (
                          // Show placeholder and trigger thumbnail generation
                          <div
                            className="w-full h-full flex flex-col items-center justify-center bg-white border border-slate-200 rounded cursor-pointer hover:bg-slate-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateThumbnail(pageNum);
                            }}
                          >
                            <FileText className="w-8 h-8 text-slate-400 mb-2" />
                            <div className="text-sm font-medium text-slate-600">
                              Page {pageNum}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Click to load
                            </div>
                            {pageRedactions > 0 && (
                              <div className="text-xs text-red-600 mt-1">
                                {pageRedactions} redaction
                                {pageRedactions > 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Page overlay info */}
                        {/* <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all flex items-center justify-center">
                          {currentPage === pageNum && (
                            <div className="bg-red-500 text-white rounded-full p-2">
                              <Eye className="w-4 h-4" />
                            </div>
                          )}
                        </div> */}
                      </div>

                      {/* Page number and info */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent text-white text-xs p-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Page {pageNum}</span>
                          {pageRedactions > 0 && (
                            <div className="flex items-center space-x-1">
                              <Shield className="w-3 h-3" />
                              <span>{pageRedactions}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Redaction indicator */}
                      {pageRedactions > 0 && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                          {pageRedactions}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
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
          <div className="bg-white border-b border-slate-200 p-2 md:p-3 lg:p-4">
            <div className="flex items-center justify-between gap-3">
              {/* Left Controls */}
              <div className="flex items-center gap-2 md:gap-3">
                {/* Thumbnail Toggle - Mobile & Tablet Only */}
                <button
                  onClick={() => setShowThumbnails(!showThumbnails)}
                  className="p-1.5 md:p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors lg:hidden"
                  title={showThumbnails ? "Hide pages" : "Show pages"}
                >
                  <FileText className="w-4 h-4" />
                </button>

                {/* Divider */}
                <div className="h-6 w-px bg-slate-300 lg:hidden" />

                {/* Page Navigation Group */}
                <div className="flex items-center gap-1 md:gap-1.5 bg-slate-50 rounded-lg p-1">
                  <button
                    onClick={() =>
                      handlePageChange(Math.max(1, currentPage - 1))
                    }
                    disabled={currentPage <= 1}
                    className="p-1.5 md:p-2 rounded-md bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs md:text-sm font-medium text-slate-700 px-2 md:px-4 min-w-[70px] md:min-w-[90px] text-center">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      handlePageChange(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage >= totalPages}
                    className="p-1.5 md:p-2 rounded-md bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Divider */}
                <div className="h-6 w-px bg-slate-300" />

                {/* Zoom Controls Group */}
                <div className="flex items-center gap-1 md:gap-1.5 bg-slate-50 rounded-lg p-1">
                  <button
                    onClick={handleZoomOut}
                    className="p-1.5 md:p-2 rounded-md bg-white hover:bg-slate-100 transition-colors shadow-sm"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs md:text-sm font-medium text-slate-700 px-2 md:px-3 min-w-[50px] md:min-w-[65px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    disabled={zoom >= 0.9}
                    className="p-1.5 md:p-2 rounded-md bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                {/* Divider */}
                <div className="h-6 w-px bg-slate-300" />

                {/* Rotate Button */}
                <button
                  onClick={handleRotate}
                  className="p-1.5 md:p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                  title="Rotate 90° clockwise"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              {/* Right Controls */}
              <div className="hidden lg:flex items-center gap-4">
                {/* Divider */}
                <div className="h-8 w-px bg-slate-300" />

                {/* Search Section */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search text to redact..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent w-56 xl:w-64"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      </div>
                    )}
                  </div>
                  {searchResults.length > 0 && (
                    <button
                      onClick={redactAllSearchResults}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium whitespace-nowrap"
                      title={`Add ${searchResults.length} matches as redaction areas`}
                    >
                      Redact All ({searchResults.length})
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-slate-300" />

                {/* Color Picker */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">
                    Color:
                  </label>
                  <input
                    type="color"
                    value={redactionColor}
                    onChange={(e) => setRedactionColor(e.target.value)}
                    className="w-8 h-8 border border-slate-300 rounded cursor-pointer"
                    title="Choose redaction color"
                  />
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-slate-300" />

                {/* Tool Indicator */}
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg">
                  {selectedTool === "select" && (
                    <MousePointer className="w-4 h-4 text-slate-600" />
                  )}
                  {selectedTool === "redact" && (
                    <Square className="w-4 h-4 text-red-600" />
                  )}
                  {selectedTool === "highlight" && (
                    <Highlighter className="w-4 h-4 text-yellow-600" />
                  )}
                  <span className="text-sm font-medium text-slate-700 capitalize">
                    {selectedTool}
                  </span>
                </div>

                <span className="text-sm text-slate-600">
                  {currentPageAreas.length} redaction
                  {currentPageAreas.length !== 1 ? "s" : ""}
                </span>

                {/* Debug info */}
                <button
                  onClick={() => {
                    const dims = pageDimensions[currentPage];
                    const size = renderedPageSizes[currentPage];
                    console.log("=== DEBUG INFO ===");
                    console.log(`Current page: ${currentPage}`);
                    console.log(`PDF dimensions:`, dims);
                    console.log(`Rendered size:`, size);
                    if (dims && size) {
                      console.log(
                        `Scale: ${size.width / dims.width} x ${
                          size.height / dims.height
                        }`
                      );
                    }
                    alert(
                      `Page ${currentPage}\nPDF: ${dims?.width}x${dims?.height}\nRendered: ${size?.width}x${size?.height}`
                    );
                  }}
                  className="px-2 py-1 bg-gray-200 text-xs rounded"
                >
                  Debug
                </button>
              </div>
            </div>
          </div>

          {/* PDF Content */}
          <div
            ref={containerRef}
            className="flex-1 overflow-auto bg-slate-100 p-2 md:p-4"
          >
            <div className="flex justify-center items-start">
              <div
                ref={viewerRef}
                className={`relative bg-white shadow-lg max-w-full ${
                  selectedTool !== "select"
                    ? "cursor-crosshair"
                    : "cursor-default"
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
                  {!isClient || !isPdfWorkerReady ? (
                    <div className="flex items-center justify-center h-96 w-96">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                      <div className="ml-3 text-slate-600">
                        {!isClient
                          ? "Initializing..."
                          : "Loading PDF worker..."}
                      </div>
                    </div>
                  ) : error ? (
                    <div className="flex items-center justify-center h-96 w-96">
                      <div className="text-center p-8">
                        <FileText className="w-16 h-16 text-red-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-red-600 mb-2">
                          Failed to Load PDF
                        </h3>
                        <p className="text-red-500 mb-4">{error}</p>
                        <button
                          onClick={() => {
                            setError(null);
                            setIsLoading(true);
                            setIsDocumentReady(false);
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`transition-opacity duration-300 ${
                        isDocumentReady ? "opacity-100" : "opacity-50"
                      }`}
                    >
                      <Document
                        file={file}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={
                          <div className="flex items-center justify-center h-96 w-96">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                            <div className="ml-3 text-slate-600">
                              Loading PDF...
                            </div>
                          </div>
                        }
                      >
                        <Page
                          key={`page-${currentPage}`}
                          pageNumber={currentPage}
                          width={containerWidth * zoom}
                          rotate={rotation}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          loading={
                            <div className="flex items-center justify-center h-96 w-96 bg-slate-50 rounded">
                              <div className="animate-pulse text-slate-400">
                                Loading page {currentPage}...
                              </div>
                            </div>
                          }
                        />
                      </Document>
                    </div>
                  )}
                  {/* Redaction Areas Overlay */}
                  {currentPageAreas.map((area) => {
                    const { x, y } = pdfToViewerCoords(
                      area.page,
                      area.x,
                      area.y
                    );
                    const { x: wX, y: hY } = pdfToViewerCoords(
                      area.page,
                      area.x + area.width,
                      area.y + area.height
                    );
                    const widthPx = wX - x;
                    const heightPx = hY - y;

                    return (
                      <div
                        key={area.id}
                        className={`absolute cursor-move group transition-all ${
                          showPreview ? "border-0" : "border-2 border-dashed"
                        } ${
                          hoveredArea === area.id || selectedArea === area.id
                            ? "ring-2 ring-blue-400"
                            : ""
                        } ${
                          area.isVerified ? "border-green-500 border-solid" : ""
                        }`}
                        style={{
                          left: x,
                          top: y,
                          width: widthPx,
                          height: heightPx,
                          backgroundColor: showPreview
                            ? redactionColor
                            : area.type === "text"
                            ? "rgba(239, 68, 68, 0.1)" // Light red background
                            : "rgba(251, 191, 36, 0.1)", // Light yellow background
                          borderColor: showPreview
                            ? "transparent"
                            : area.type === "text"
                            ? "#ef4444" // Red border
                            : "#f59e0b", // Yellow border
                        }}
                        onMouseEnter={() => setHoveredArea(area.id)}
                        onMouseLeave={() => setHoveredArea(null)}
                        onClick={() => setSelectedArea(area.id)}
                      >
                        {/* Redaction Controls */}
                        <div className="absolute -top-10 left-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-lg shadow-lg border border-slate-200 p-2 flex items-center space-x-1 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAreaVerification(area.id);
                            }}
                            className={`p-1 rounded ${
                              area.isVerified
                                ? "bg-green-100 text-green-600"
                                : "bg-slate-100 text-slate-600"
                            }`}
                            title={
                              area.isVerified ? "Verified" : "Click to verify"
                            }
                          >
                            {area.isVerified ? (
                              <Eye className="w-3 h-3" />
                            ) : (
                              <EyeOff className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRedactionArea(area.id);
                            }}
                            className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200"
                            title="Remove redaction"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Resize Handles - Only show when not in preview mode and area is selected/hovered */}
                        {!showPreview &&
                          (hoveredArea === area.id ||
                            selectedArea === area.id) && (
                            <>
                              {/* Corner handles */}
                              <div
                                className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-nw-resize -top-1.5 -left-1.5 z-20"
                                onMouseDown={(e) =>
                                  startResize(e, area.id, "nw")
                                }
                              />
                              <div
                                className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-ne-resize -top-1.5 -right-1.5 z-20"
                                onMouseDown={(e) =>
                                  startResize(e, area.id, "ne")
                                }
                              />
                              <div
                                className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-sw-resize -bottom-1.5 -left-1.5 z-20"
                                onMouseDown={(e) =>
                                  startResize(e, area.id, "sw")
                                }
                              />
                              <div
                                className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-se-resize -bottom-1.5 -right-1.5 z-20"
                                onMouseDown={(e) =>
                                  startResize(e, area.id, "se")
                                }
                              />
                              {/* Edge handles */}
                              <div
                                className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-n-resize -top-1.5 left-1/2 -translate-x-1/2 z-20"
                                onMouseDown={(e) =>
                                  startResize(e, area.id, "n")
                                }
                              />
                              <div
                                className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-s-resize -bottom-1.5 left-1/2 -translate-x-1/2 z-20"
                                onMouseDown={(e) =>
                                  startResize(e, area.id, "s")
                                }
                              />
                              <div
                                className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-w-resize -left-1.5 top-1/2 -translate-y-1/2 z-20"
                                onMouseDown={(e) =>
                                  startResize(e, area.id, "w")
                                }
                              />
                              <div
                                className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-e-resize -right-1.5 top-1/2 -translate-y-1/2 z-20"
                                onMouseDown={(e) =>
                                  startResize(e, area.id, "e")
                                }
                              />
                            </>
                          )}
                      </div>
                    );
                  })}

                  {/* Current Selection */}
                  {currentSelection &&
                    isSelecting &&
                    (() => {
                      const { x, y } = pdfToViewerCoords(
                        currentPage,
                        currentSelection.x,
                        currentSelection.y
                      );
                      const { x: wX, y: hY } = pdfToViewerCoords(
                        currentPage,
                        currentSelection.x + currentSelection.width,
                        currentSelection.y + currentSelection.height
                      );
                      const widthPx = wX - x;
                      const heightPx = hY - y;

                      return (
                        <div
                          className={`absolute border-2 border-dashed ${
                            selectedTool === "redact"
                              ? "border-red-500 bg-red-500 bg-opacity-20"
                              : "border-yellow-500 bg-yellow-500 bg-opacity-20"
                          }`}
                          style={{
                            left: x,
                            top: y,
                            width: widthPx,
                            height: heightPx,
                          }}
                        />
                      );
                    })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default ImprovedPDFViewer;
