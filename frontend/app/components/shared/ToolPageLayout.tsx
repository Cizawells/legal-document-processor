"use client";

import React from "react";
import Header from "@/components/ui/header";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface ToolPageLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  showBackButton?: boolean;
  headerColor?: string;
  icon?: React.ReactNode;
}

const ToolPageLayout: React.FC<ToolPageLayoutProps> = ({
  title,
  description,
  children,
  showBackButton = true,
  headerColor = "from-slate-50 to-white",
  icon,
}) => {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      <Header title={title} />

      {/* Hero Section - Matching Homepage Style */}
      <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto mb-12">
            {icon && (
              <div className="inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full mb-6">
                {icon}
                <span className="text-sm font-semibold text-slate-700">
                  Professional Tool
                </span>
              </div>
            )}
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              {title}
            </h1>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              {description}
            </p>
          </div>

          {/* Main Content */}
          <div className="space-y-20">{children}</div>
        </div>
      </section>
    </div>
  );
};

export default ToolPageLayout;
