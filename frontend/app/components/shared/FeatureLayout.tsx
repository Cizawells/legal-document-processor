"use client";

interface FeatureLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function FeatureLayout({ children, className = "" }: FeatureLayoutProps) {
  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 ${className}`}>
      {children}
    </div>
  );
}
