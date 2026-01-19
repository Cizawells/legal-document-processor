/**
 * PDF utility functions for handling PDF files in the browser
 */

/**
 * Get the number of pages in a PDF file
 * @param file - The PDF file to analyze
 * @returns Promise<number> - The number of pages in the PDF
 */
export async function getPdfPageCount(file: File): Promise<number> {
  try {
    // Read the file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to string to search for page count patterns
    const pdfText = Array.from(uint8Array)
      .map(byte => String.fromCharCode(byte))
      .join('');
    
    // Method 1: Look for /Count entry in Pages object
    const countMatch = pdfText.match(/\/Count\s+(\d+)/);
    if (countMatch) {
      return parseInt(countMatch[1], 10);
    }
    
    // Method 2: Count /Page objects (less reliable but fallback)
    const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g);
    if (pageMatches) {
      return pageMatches.length;
    }
    
    // Method 3: Look for page references
    const pageRefMatches = pdfText.match(/\d+\s+0\s+obj[^]*?\/Type\s*\/Page/g);
    if (pageRefMatches) {
      return pageRefMatches.length;
    }
    
    // Fallback: return 1 if we can't determine page count
    console.warn(`Could not determine page count for ${file.name}, defaulting to 1`);
    return 1;
    
  } catch (error) {
    console.error(`Error reading PDF file ${file.name}:`, error);
    // Return 1 as fallback
    return 1;
  }
}

/**
 * Get PDF page count with better error handling and validation
 * @param file - The PDF file to analyze
 * @returns Promise<number> - The number of pages in the PDF
 */
export async function getPdfPageCountSafe(file: File): Promise<number> {
  // Validate file type
  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    console.warn(`File ${file.name} may not be a PDF file`);
    return 1;
  }
  
  // Check file size (avoid processing very large files)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    console.warn(`File ${file.name} is too large (${file.size} bytes), using default page count`);
    return Math.max(1, Math.floor(file.size / (1024 * 1024))); // Rough estimate: 1 page per MB
  }
  
  return getPdfPageCount(file);
}

/**
 * Batch process multiple PDF files to get their page counts
 * @param files - Array of PDF files
 * @returns Promise<number[]> - Array of page counts corresponding to each file
 */
export async function getBatchPdfPageCounts(files: File[]): Promise<number[]> {
  const promises = files.map(file => getPdfPageCountSafe(file));
  return Promise.all(promises);
}
