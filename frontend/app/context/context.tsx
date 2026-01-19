// app/context/UserContext.tsx
"use client";

import { DownloadResponse } from "@/types/pdf";
import { createContext, ReactNode, useContext, useState } from "react";

export type UploadFile = {
  id: string;
  name: string;
  size: string;
  pages: number;
  file: File;
  actualSize?: number; // Optional property for accurate file size calculations
};

type FilesContextType = {
  files: UploadFile[];
  setFiles: React.Dispatch<React.SetStateAction<UploadFile[]>>;
  processingResult: DownloadResponse | null;
  setProcessingResult: React.Dispatch<
    React.SetStateAction<DownloadResponse | null>
  >;
};

const FilesContext = createContext<FilesContextType | undefined>(undefined);

export function FilesProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [processingResult, setProcessingResult] =
    useState<DownloadResponse | null>(null);
  const [splitResult, setSplitResult] = useState<DownloadResponse | null>(null);

  return (
    <FilesContext.Provider
      value={{ files, setFiles, processingResult, setProcessingResult }}
    >
      {children}
    </FilesContext.Provider>
  );
}

export function useFilesContext() {
  const context = useContext(FilesContext);
  if (!context) throw new Error("useUser must be used within UserProvider");
  return context;
}
