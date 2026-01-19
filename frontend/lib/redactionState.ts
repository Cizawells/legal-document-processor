// Redaction state persistence utilities

interface RedactionArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  type: "text" | "image" | "custom";
  piiType?: string;
  reason?: string;
  isVerified: boolean;
  text?: string;
}

interface PDFFile {
  id: string;
  name: string;
  size: string;
  base64Data?: string; // Store PDF as base64 for complete restoration
  lastModified?: number;
  type?: string;
}

interface RedactionState {
  pdfFile: PDFFile | null;
  uploadedFileId: string | null;
  redactionAreas: RedactionArea[];
  currentPage: number;
  totalPages: number;
  detectionResults: any;
  timestamp: number;
}

const STORAGE_KEY = 'redaction_state';
const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

export const saveRedactionState = (state: Partial<RedactionState>) => {
  try {
    const currentState = getRedactionState();
    const newState: RedactionState = {
      ...currentState,
      ...state,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    console.log('Redaction state saved:', newState);
  } catch (error) {
    console.error('Failed to save redaction state:', error);
  }
};

export const getRedactionState = (): RedactionState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultState();
    }

    const state: RedactionState = JSON.parse(stored);
    
    // Check if state has expired
    if (Date.now() - state.timestamp > EXPIRY_TIME) {
      clearRedactionState();
      return getDefaultState();
    }

    return state;
  } catch (error) {
    console.error('Failed to get redaction state:', error);
    return getDefaultState();
  }
};

export const clearRedactionState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Redaction state cleared');
  } catch (error) {
    console.error('Failed to clear redaction state:', error);
  }
};

export const hasStoredState = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const state: RedactionState = JSON.parse(stored);
    return Date.now() - state.timestamp < EXPIRY_TIME;
  } catch {
    return false;
  }
};

const getDefaultState = (): RedactionState => ({
  pdfFile: null,
  uploadedFileId: null,
  redactionAreas: [],
  currentPage: 1,
  totalPages: 1,
  detectionResults: null,
  timestamp: Date.now(),
});

// Convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Convert base64 back to File
export const base64ToFile = (base64Data: string, fileName: string, fileType: string): File => {
  const byteCharacters = atob(base64Data.split(',')[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new File([byteArray], fileName, { type: fileType });
};

// Save state before checkout with complete PDF data
export const saveStateBeforeCheckout = async (
  file: File | null,
  pdfFileInfo: { id: string; name: string; size: string } | null,
  uploadedFileId: string | null,
  redactionAreas: RedactionArea[],
  currentPage: number,
  totalPages: number,
  detectionResults: any
) => {
  let pdfFile: PDFFile | null = null;
  
  if (file && pdfFileInfo) {
    try {
      const base64Data = await fileToBase64(file);
      pdfFile = {
        ...pdfFileInfo,
        base64Data,
        lastModified: file.lastModified,
        type: file.type,
      };
    } catch (error) {
      console.error('Failed to convert file to base64:', error);
      pdfFile = pdfFileInfo; // Fallback to metadata only
    }
  }

  saveRedactionState({
    pdfFile,
    uploadedFileId,
    redactionAreas,
    currentPage,
    totalPages,
    detectionResults,
  });
  
  // Also save a flag indicating we're going to checkout
  localStorage.setItem('checkout_in_progress', 'true');
};

// Check if returning from checkout
export const isReturningFromCheckout = (): boolean => {
  return localStorage.getItem('checkout_in_progress') === 'true';
};

// Clear checkout flag
export const clearCheckoutFlag = () => {
  localStorage.removeItem('checkout_in_progress');
};
