"use client";

import { FileText, GripVertical, X, Plus } from "lucide-react";
import { useState } from "react";
import { UploadFile } from "../../context/context";

interface FileListProps {
  files: UploadFile[];
  onRemoveFile: (id: string) => void;
  onReorderFiles: (files: UploadFile[]) => void;
  onAddMoreFiles: () => void;
  title: string;
  actionButton: React.ReactNode;
  options?: React.ReactNode;
  showReorder?: boolean;
}

export default function FileList({
  files,
  onRemoveFile,
  onReorderFiles,
  onAddMoreFiles,
  title,
  actionButton,
  options,
  showReorder = true
}: FileListProps) {
  const [draggedFile, setDraggedFile] = useState<UploadFile | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleFileDragStart = (e: React.DragEvent, file: UploadFile) => {
    if (!showReorder) return;
    setDraggedFile(file);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFileDragOver = (e: React.DragEvent, index: number) => {
    if (!showReorder) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleFileDrop = (e: React.DragEvent, dropIndex: number) => {
    if (!showReorder) return;
    e.preventDefault();
    if (!draggedFile) return;

    const dragIndex = files.findIndex((f) => f.id === draggedFile.id);
    if (dragIndex === dropIndex) return;

    const newFiles = [...files];
    const [removed] = newFiles.splice(dragIndex, 1);
    newFiles.splice(dropIndex, 0, removed);

    onReorderFiles(newFiles);
    setDraggedFile(null);
    setDragOverIndex(null);
  };

  return (
    <div className="grid lg:grid-cols-4 gap-8">
      {/* Files Area */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
            <span className="text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
            </span>
          </div>

          {/* File List */}
          <div className="space-y-3">
            {files.map((file, index) => (
              <div
                key={file.id}
                draggable={showReorder}
                onDragStart={(e) => handleFileDragStart(e, file)}
                onDragOver={(e) => handleFileDragOver(e, index)}
                onDrop={(e) => handleFileDrop(e, index)}
                className={`flex items-center p-4 bg-slate-50 rounded-xl border-2 transition-all hover:bg-slate-100 ${
                  showReorder ? 'cursor-move' : ''
                } ${
                  dragOverIndex === index
                    ? "border-blue-400 bg-blue-50"
                    : "border-transparent"
                }`}
              >
                <div className="flex items-center space-x-4 flex-1">
                  {showReorder && <GripVertical className="w-5 h-5 text-slate-400" />}
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 truncate">
                      {file.name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {file.size} • {file.pages} pages
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {showReorder && (
                    <span className="text-sm font-medium text-slate-600 bg-white px-3 py-1 rounded-full">
                      {index + 1}
                    </span>
                  )}
                  <button
                    onClick={() => onRemoveFile(file.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add More Files Button */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <button
              onClick={onAddMoreFiles}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>Add more files</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8">
          {/* Action Button */}
          {actionButton}

          {/* Options */}
          {options}

          {/* Info */}
          <div className="bg-blue-50 rounded-lg p-4 mt-6">
            <div className="flex space-x-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">
                  Professional Quality
                </h4>
                <p className="text-sm text-blue-800">
                  All processing is done securely with enterprise-grade tools. 
                  Your files are automatically deleted after processing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
