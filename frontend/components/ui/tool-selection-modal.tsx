import { useFilesContext } from "@/app/context/context";
import {
  Archive,
  Edit3,
  Eye,
  FileImage,
  FileText,
  Image,
  Lock,
  Plus,
  RotateCw,
  Scissors,
  Unlock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { ReactElement } from "react";

interface Tool {
  id: number;
  name: string;
  description: string;
  icon: ReactElement;
  color: string;
  hoverColor: string;
  url?: string;
}

const pdfTools: Tool[] = [
  {
    id: 1,
    name: "Merge PDF",
    description: "Combine multiple PDFs into one document",
    icon: <Plus className="w-8 h-8" />,
    color: "bg-gradient-to-br from-blue-500 to-blue-600",
    hoverColor: "hover:from-blue-600 hover:to-blue-700",
    url: "merge_pdf",
  },
  {
    id: 2,
    name: "Split PDF",
    description: "Extract pages or split PDF into multiple files",
    icon: <Scissors className="w-8 h-8" />,
    color: "bg-gradient-to-br from-green-500 to-green-600",
    hoverColor: "hover:from-green-600 hover:to-green-700",
    url: "pdf_to_split",
  },
  {
    id: 3,
    name: "Compress PDF",
    description: "Reduce PDF file size while maintaining quality",
    icon: <Archive className="w-8 h-8" />,
    color: "bg-gradient-to-br from-purple-500 to-purple-600",
    hoverColor: "hover:from-purple-600 hover:to-purple-700",
  },
  {
    id: 4,
    name: "PDF to Word",
    description: "Convert PDF to editable Word documents",
    icon: <FileText className="w-8 h-8" />,
    color: "bg-gradient-to-br from-orange-500 to-orange-600",
    hoverColor: "hover:from-orange-600 hover:to-orange-700",
    url: "pdf_to_word",
  },
  {
    id: 5,
    name: "PDF to Image",
    description: "Convert PDF pages to JPG or PNG images",
    icon: <FileImage className="w-8 h-8" />,
    color: "bg-gradient-to-br from-red-500 to-red-600",
    hoverColor: "hover:from-red-600 hover:to-red-700",
  },
  {
    id: 6,
    name: "Image to PDF",
    description: "Convert images to PDF format",
    icon: <Image className="w-8 h-8" />,
    color: "bg-gradient-to-br from-teal-500 to-teal-600",
    hoverColor: "hover:from-teal-600 hover:to-teal-700",
  },
  {
    id: 7,
    name: "Edit PDF",
    description: "Add text, images, and shapes to PDF",
    icon: <Edit3 className="w-8 h-8" />,
    color: "bg-gradient-to-br from-indigo-500 to-indigo-600",
    hoverColor: "hover:from-indigo-600 hover:to-indigo-700",
  },
  {
    id: 8,
    name: "Sign PDF",
    description: "Add electronic signatures to documents",
    icon: <Edit3 className="w-8 h-8" />,
    color: "bg-gradient-to-br from-pink-500 to-pink-600",
    hoverColor: "hover:from-pink-600 hover:to-pink-700",
  },
  {
    id: 9,
    name: "Protect PDF",
    description: "Add password protection to PDF files",
    icon: <Lock className="w-8 h-8" />,
    color: "bg-gradient-to-br from-yellow-500 to-yellow-600",
    hoverColor: "hover:from-yellow-600 hover:to-yellow-700",
  },
  {
    id: 10,
    name: "Unlock PDF",
    description: "Remove password protection from PDFs",
    icon: <Unlock className="w-8 h-8" />,
    color: "bg-gradient-to-br from-cyan-500 to-cyan-600",
    hoverColor: "hover:from-cyan-600 hover:to-cyan-700",
  },
  {
    id: 11,
    name: "Rotate PDF",
    description: "Rotate PDF pages to correct orientation",
    icon: <RotateCw className="w-8 h-8" />,
    color: "bg-gradient-to-br from-emerald-500 to-emerald-600",
    hoverColor: "hover:from-emerald-600 hover:to-emerald-700",
  },
  {
    id: 12,
    name: "View PDF",
    description: "Read and view PDF files online",
    icon: <Eye className="w-8 h-8" />,
    color: "bg-gradient-to-br from-slate-500 to-slate-600",
    hoverColor: "hover:from-slate-600 hover:to-slate-700",
  },
];

const ToolSelectionModal = ({
  setShowToolSelector,
}: {
  setShowToolSelector: (value: boolean) => void;
}) => {
  const { files, setFiles } = useFilesContext();
  console.log("modallllllllllllllllllllll files", files);
  const router = useRouter();
  const handleToolSelect = (tool: Tool) => {
    router.push(tool.url!); // navigate to /dashboard
    // Here you would navigate to the specific tool page with the uploaded files
    setShowToolSelector(false);
    // In a real app: router.push(`/tools/${tool.id}?files=${setFiles}`)
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">
                Choose Your Tool
              </h3>
              <p className="text-slate-600">
                {setFiles.length} PDF file
                {setFiles.length > 1 ? "s" : ""} uploaded. What would you like
                to do?
              </p>
            </div>
            <button
              onClick={() => setShowToolSelector(false)}
              className="text-slate-400 hover:text-slate-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {pdfTools.slice(0, 9).map((tool) => (
              //   <Link key={tool.id} href={`/${tool.url}`} passHref>
              <div
                className={`${tool.color} ${tool.hoverColor} text-white p-4 rounded-xl cursor-pointer transform transition-all duration-200 hover:scale-105`}
                onClick={() => handleToolSelect(tool)}
                key={tool.id}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3 opacity-90">
                    {React.cloneElement(tool.icon as React.ReactElement<any>, {
                      className: "w-6 h-6",
                    })}
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{tool.name}</h4>
                  <p className="text-xs opacity-90">{tool.description}</p>
                </div>
              </div>
              //   </Link>
            ))}
          </div>

          <div className="mt-6 p-4 bg-slate-50 rounded-xl">
            <h4 className="font-semibold text-slate-800 mb-2">
              Popular Choices:
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleToolSelect(pdfTools[0])}
                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm hover:bg-blue-200 transition-colors"
              >
                Merge PDFs
              </button>
              <button
                onClick={() => handleToolSelect(pdfTools[2])}
                className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm hover:bg-purple-200 transition-colors"
              >
                Compress
              </button>
              <button
                onClick={() => handleToolSelect(pdfTools[11])}
                className="bg-slate-100 text-slate-800 px-3 py-1 rounded-full text-sm hover:bg-slate-200 transition-colors"
              >
                View PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolSelectionModal;
