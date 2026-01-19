"use client";

import { Upload, Shield, FileText, Cloud, FolderOpen } from "lucide-react";
import { useState } from "react";

interface UploadAreaProps {
  title: string;
  subtitle: string;
  acceptedTypes: string;
  maxSize?: string;
  multiple?: boolean;
  onFileUpload: (files: File[]) => void;
  icon?: React.ReactNode;
  features?: Array<{
    icon: React.ReactNode;
    title: string;
    description: string;
    badge?: string;
    badgeColor?: string;
  }>;
}

export default function UploadArea({
  title,
  subtitle,
  acceptedTypes,
  maxSize = "50MB",
  multiple = false,
  onFileUpload,
  icon,
  features = []
}: UploadAreaProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    onFileUpload(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFileUpload(Array.from(e.target.files));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          {icon || <FileText className="w-8 h-8 text-white" />}
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">{title}</h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">{subtitle}</p>
      </div>

      {/* Features Grid */}
      {features.length > 0 && (
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <div key={index} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="w-8 h-8 text-blue-600 mb-3">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-600 mb-3">{feature.description}</p>
              {feature.badge && (
                <span className={`inline-block text-xs px-2 py-1 rounded ${
                  feature.badgeColor || 'bg-blue-100 text-blue-800'
                }`}>
                  {feature.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-16 transition-all cursor-pointer overflow-hidden ${
          isDragOver
            ? "border-blue-400 bg-blue-50 shadow-lg"
            : "border-slate-300 bg-white hover:border-blue-400 hover:shadow-md"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23000000" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Upload className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            {isDragOver ? "Drop your files here" : "Upload Files"}
          </h3>
          <p className="text-slate-600 mb-6">
            {isDragOver ? "Release to upload" : "Drag and drop or click to browse"}
          </p>
          
          <button className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-8 py-4 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-semibold text-lg shadow-lg">
            Select Files
          </button>
          
          <div className="flex items-center justify-center space-x-4 text-sm text-slate-500 mt-6">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Secure</span>
            </div>
            <div className="w-1 h-1 bg-slate-300 rounded-full" />
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>{acceptedTypes}</span>
            </div>
            <div className="w-1 h-1 bg-slate-300 rounded-full" />
            <span>Max {maxSize}</span>
          </div>
        </div>

        <input
          id="file-input"
          type="file"
          accept={acceptedTypes}
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Upload Options */}
      <div className="flex justify-center space-x-4 mt-8">
        <button className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
          <Cloud className="w-5 h-5 text-slate-600" />
          <span className="text-slate-700 font-medium">From Google Drive</span>
        </button>
        <button className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
          <FolderOpen className="w-5 h-5 text-slate-600" />
          <span className="text-slate-700 font-medium">From Dropbox</span>
        </button>
      </div>
    </div>
  );
}
