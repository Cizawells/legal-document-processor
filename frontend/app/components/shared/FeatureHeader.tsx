"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface FeatureHeaderProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  showBackButton?: boolean;
}

export default function FeatureHeader({ 
  title, 
  icon, 
  description, 
  showBackButton = true 
}: FeatureHeaderProps) {
  const router = useRouter();

  return (
    <header className="bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            {showBackButton && (
              <button
                className="text-slate-600 hover:text-slate-900 transition-colors"
                onClick={() => router.back()}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                {icon}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">{title}</h1>
                <p className="text-sm text-slate-600 hidden sm:block">{description}</p>
              </div>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center space-x-6">
            <a
              href="/"
              className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium"
            >
              All Tools
            </a>
            <a
              href="#"
              className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium"
            >
              Help
            </a>
            <button className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 text-sm font-semibold">
              Premium
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
