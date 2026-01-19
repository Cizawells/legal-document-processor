"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  badge?: string;
}

interface FeatureGridProps {
  features: Feature[];
  columns?: number;
}

const FeatureGrid: React.FC<FeatureGridProps> = ({ 
  features, 
  columns = 3 
}) => {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4'
  };

  const getBadgeStyles = (badge: string) => {
    switch (badge?.toLowerCase()) {
      case 'pro feature':
        return 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 border border-purple-200';
      case 'free':
        return 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200';
      case 'secure':
        return 'bg-gradient-to-r from-red-100 to-pink-100 text-red-700 border border-red-200';
      default:
        return 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200';
    }
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Professional Features
          </h2>
          <p className="text-xl text-slate-600">
            Everything you need for secure document processing
          </p>
        </div>
        
        <div className={`grid grid-cols-1 ${gridCols[columns as keyof typeof gridCols]} gap-8`}>
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 hover:shadow-lg hover:border-slate-300 transition-all duration-200"
            >
              {/* Icon with homepage styling */}
              <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              
              {/* Title and badge */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl font-bold text-slate-900">
                  {feature.title}
                </h3>
                {feature.badge && (
                  <span className={`inline-block text-xs font-medium px-2 py-1 rounded whitespace-nowrap ml-2 ${getBadgeStyles(feature.badge)}`}>
                    {feature.badge}
                  </span>
                )}
              </div>
              
              {/* Description */}
              <p className="text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureGrid;
