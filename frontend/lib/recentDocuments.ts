// Recent documents management

export interface RecentDocument {
  id: string;
  name: string;
  size: string;
  uploadedFileId: string | null;
  redactionCount: number;
  lastModified: number;
  timestamp: number;
  thumbnail?: string; // base64 thumbnail
}

const RECENT_DOCS_KEY = 'recent_documents';
const MAX_RECENT_DOCS = 10;

export const addRecentDocument = (document: Omit<RecentDocument, 'timestamp'>) => {
  try {
    const recentDocs = getRecentDocuments();
    
    // Remove existing document with same name to avoid duplicates
    const filteredDocs = recentDocs.filter(doc => doc.name !== document.name);
    
    // Add new document at the beginning
    const newDoc: RecentDocument = {
      ...document,
      timestamp: Date.now(),
    };
    
    const updatedDocs = [newDoc, ...filteredDocs].slice(0, MAX_RECENT_DOCS);
    
    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(updatedDocs));
    console.log('Added recent document:', newDoc.name);
  } catch (error) {
    console.error('Failed to add recent document:', error);
  }
};

export const getRecentDocuments = (): RecentDocument[] => {
  try {
    const stored = localStorage.getItem(RECENT_DOCS_KEY);
    if (!stored) return [];
    
    const docs: RecentDocument[] = JSON.parse(stored);
    
    // Filter out documents older than 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const validDocs = docs.filter(doc => doc.timestamp > thirtyDaysAgo);
    
    // If we filtered any, update storage
    if (validDocs.length !== docs.length) {
      localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(validDocs));
    }
    
    return validDocs;
  } catch (error) {
    console.error('Failed to get recent documents:', error);
    return [];
  }
};

export const updateRecentDocument = (id: string, updates: Partial<RecentDocument>) => {
  try {
    const recentDocs = getRecentDocuments();
    const updatedDocs = recentDocs.map(doc => 
      doc.id === id ? { ...doc, ...updates, timestamp: Date.now() } : doc
    );
    
    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(updatedDocs));
  } catch (error) {
    console.error('Failed to update recent document:', error);
  }
};

export const removeRecentDocument = (id: string) => {
  try {
    const recentDocs = getRecentDocuments();
    const filteredDocs = recentDocs.filter(doc => doc.id !== id);
    
    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(filteredDocs));
  } catch (error) {
    console.error('Failed to remove recent document:', error);
  }
};

export const clearRecentDocuments = () => {
  try {
    localStorage.removeItem(RECENT_DOCS_KEY);
  } catch (error) {
    console.error('Failed to clear recent documents:', error);
  }
};
