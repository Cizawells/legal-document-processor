"use client";

import React, { useState } from 'react';
import { Upload, Shield, Zap, Lock, Cloud, FolderOpen } from 'lucide-react';

interface UnifiedUploadAreaProps {
  onFileUpload: (files: File[]) => void;
  acceptedTypes?: string;
  maxFiles?: number;
  title?: string;
  subtitle?: string;
  features?: string[];
  primaryColor?: string;
  showCloudOptions?: boolean;
}

const UnifiedUploadArea: React.FC<UnifiedUploadAreaProps> = ({
  onFileUpload,
  acceptedTypes = ".pdf",
  maxFiles = 1,
  title = "Upload PDF Document",
  subtitle = "Drag & drop or click to browse • Max 50MB",
  features = ["Secure", "Fast Processing", "High Quality"],
  primaryColor = "from-blue-500 to-blue-600",
  showCloudOptions = true
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(Array.from(e.target.files));
    }
  };

  const featureIcons = {
    "Secure": Shield,
    "Fast Processing": Zap,
    "High Quality": Lock,
    "Auto-PII Detection": Zap,
    "HIPAA Compliant": Lock,
    "Professional": Shield
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg border-2 border-slate-200 p-8">
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition cursor-pointer ${
            isDragOver 
              ? "border-slate-900 bg-slate-50 shadow-lg" 
              : "border-slate-300 hover:border-slate-400"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('unified-file-input')?.click()}
        >
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition ${
            isDragOver ? "bg-slate-900" : "bg-gradient-to-br from-slate-700 to-slate-900"
          }`}>
            <Upload className="w-8 h-8 text-white" />
          </div>
          
          <p className="text-xl font-bold text-slate-900 mb-2">
            {isDragOver ? "Drop to start processing" : title}
          </p>
          
          <p className="text-sm text-slate-600 mb-4">
            {isDragOver 
              ? "We'll process your document instantly" 
              : subtitle
            }
          </p>
          
          <div className="flex items-center justify-center space-x-4 text-xs text-slate-500">
            {features.map((feature, index) => {
              const IconComponent = featureIcons[feature as keyof typeof featureIcons] || Shield;
              return (
                <React.Fragment key={feature}>
                  <div className="flex items-center space-x-1">
                    <IconComponent className="w-3 h-3" />
                    <span>{feature}</span>
                  </div>
                  {index < features.length - 1 && (
                    <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        
        <input
          id="unified-file-input"
          type="file"
          accept={acceptedTypes}
          multiple={maxFiles > 1}
          onChange={handleFileInput}
          className="hidden"
        />
      </div>
      
      {/* Cloud Options */}
      {showCloudOptions && (
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600 mb-3">Or import from:</p>
          <div className="flex justify-center space-x-3">
            <button className="inline-flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium">
              <Cloud className="w-4 h-4" />
              <span>Google Drive</span>
            </button>
            <button className="inline-flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium">
              <FolderOpen className="w-4 h-4" />
              <span>Dropbox</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedUploadArea;
