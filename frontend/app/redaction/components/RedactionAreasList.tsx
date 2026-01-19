"use client";

import React from "react";
import {
  Eye,
  EyeOff,
  Trash2,
  FileText,
  Image,
  Square,
  CheckCircle,
  AlertCircle,
  MapPin,
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

interface RedactionAreasListProps {
  redactionAreas: RedactionArea[];
  onRedactionAreasChange: (areas: RedactionArea[]) => void;
  onGoToArea: (area: RedactionArea) => void;
  redactionReason: string;
}

const RedactionAreasList: React.FC<RedactionAreasListProps> = ({
  redactionAreas,
  onRedactionAreasChange,
  onGoToArea,
  redactionReason,
}) => {
  const toggleAreaVerification = (id: string) => {
    onRedactionAreasChange(
      redactionAreas.map((area) =>
        area.id === id ? { ...area, isVerified: !area.isVerified } : area
      )
    );
  };

  const removeRedactionArea = (id: string) => {
    onRedactionAreasChange(redactionAreas.filter((area) => area.id !== id));
  };

  const updateAreaReason = (id: string, reason: string) => {
    onRedactionAreasChange(
      redactionAreas.map((area) =>
        area.id === id ? { ...area, reason } : area
      )
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "text":
        return <FileText className="w-4 h-4" />;
      case "image":
        return <Image className="w-4 h-4" />;
      default:
        return <Square className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "text":
        return "text-red-600 bg-red-50";
      case "image":
        return "text-blue-600 bg-blue-50";
      default:
        return "text-yellow-600 bg-yellow-50";
    }
  };

  if (redactionAreas.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-bold text-slate-800 mb-4">Redaction Areas</h3>
        <div className="text-center py-8">
          <Square className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-2">No redaction areas marked</p>
          <p className="text-sm text-slate-400">
            Use the redaction tool to mark sensitive content
          </p>
        </div>
      </div>
    );
  }

  const verifiedCount = redactionAreas.filter((area) => area.isVerified).length;
  const unverifiedCount = redactionAreas.length - verifiedCount;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800">Redaction Areas</h3>
        <div className="flex items-center space-x-2 text-sm">
          <span className="flex items-center space-x-1 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span>{verifiedCount}</span>
          </span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center space-x-1 text-amber-600">
            <AlertCircle className="w-4 h-4" />
            <span>{unverifiedCount}</span>
          </span>
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {redactionAreas.map((area, index) => (
          <div
            key={area.id}
            className={`border rounded-lg p-4 transition-all hover:shadow-md ${
              area.isVerified
                ? "border-green-200 bg-green-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg ${getTypeColor(area.type)}`}
                >
                  {getTypeIcon(area.type)}
                </div>
                <div>
                  <h4 className="font-medium text-slate-800">
                    Redaction #{index + 1}
                  </h4>
                  <div className="flex items-center space-x-2 text-sm text-slate-600">
                    <span>Page {area.page}</span>
                    <span>•</span>
                    <span>
                      {area.width}×{area.height}px
                    </span>
                    <span>•</span>
                    <span className="capitalize">{area.type}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onGoToArea(area)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Go to redaction area"
                >
                  <MapPin className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleAreaVerification(area.id)}
                  className={`p-2 transition-colors ${
                    area.isVerified
                      ? "text-green-600 hover:text-green-700"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                  title={area.isVerified ? "Verified" : "Click to verify"}
                >
                  {area.isVerified ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => removeRedactionArea(area.id)}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  title="Remove redaction"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Selected Text Preview */}
            {area.text && (
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-1">Selected text:</p>
                <p className="text-sm text-slate-700 bg-slate-100 rounded p-2 font-mono">
                  "{area.text}"
                </p>
              </div>
            )}

            {/* Redaction Reason */}
            <div className="mb-3">
              <label className="block text-xs text-slate-500 mb-1">
                Redaction reason:
              </label>
              <select
                value={area.reason || ""}
                onChange={(e) => updateAreaReason(area.id, e.target.value)}
                className="w-full text-sm border border-slate-300 rounded p-2 focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              >
                <option value="">Select reason...</option>
                <option value="Personal Identifying Information (PII)">
                  Personal Identifying Information (PII)
                </option>
                <option value="Social Security Numbers">
                  Social Security Numbers
                </option>
                <option value="Medical Information">Medical Information</option>
                <option value="Financial Data">Financial Data</option>
                <option value="Attorney-Client Privileged Information">
                  Attorney-Client Privileged Information
                </option>
                <option value="Trade Secrets">Trade Secrets</option>
                <option value="Confidential Business Information">
                  Confidential Business Information
                </option>
                <option value="Witness Information">Witness Information</option>
                <option value="Settlement Terms">Settlement Terms</option>
                <option value="Other Sensitive Information">
                  Other Sensitive Information
                </option>
              </select>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center justify-between">
              <div
                className={`flex items-center space-x-2 text-xs ${
                  area.isVerified ? "text-green-600" : "text-amber-600"
                }`}
              >
                {area.isVerified ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                <span>
                  {area.isVerified ? "Verified" : "Needs verification"}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Position: {Math.round(area.x)}, {Math.round(area.y)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-center">
            <div className="font-medium text-slate-800">
              {redactionAreas.length}
            </div>
            <div className="text-slate-600">Total Areas</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-green-600">{verifiedCount}</div>
            <div className="text-slate-600">Verified</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedactionAreasList;
