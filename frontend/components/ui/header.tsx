"use client";

import { ArrowLeft, Scale } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthButtons } from "../auth/AuthButtons";

const Header = ({ title }: { title: string }): React.JSX.Element => {
  const router = useRouter();

  return (
    <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side - Logo and Title */}
          <div className="flex items-center gap-4">
            <button
              className="text-slate-600 hover:text-slate-900 transition-colors"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">
                LegalRedactor
              </span>
            </div>
            <div className="hidden md:block">
              <span className="text-slate-400">•</span>
              <span className="text-lg font-semibold text-slate-700 ml-2">
                {title}
              </span>
            </div>
          </div>

          {/* Right side - Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="/#features"
              className="text-slate-600 hover:text-slate-900 font-medium"
            >
              Features
            </a>
            <a
              href="/#pricing"
              className="text-slate-600 hover:text-slate-900 font-medium"
            >
              Pricing
            </a>
            <a
              href="/#tools"
              className="text-slate-600 hover:text-slate-900 font-medium"
            >
              Tools
            </a>
            <AuthButtons />
          </div>

          {/* Mobile title */}
          <div className="md:hidden">
            <span className="text-lg font-semibold text-slate-700">
              {title}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Header;
