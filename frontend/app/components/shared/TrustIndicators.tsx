"use client";

import React from 'react';
import { Shield, Lock, Eye, CheckCircle, Award, Users } from 'lucide-react';

interface TrustIndicator {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const TrustIndicators: React.FC = () => {
  const indicators: TrustIndicator[] = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "HIPAA Compliant",
      description: "Meets healthcare privacy standards",
      color: "text-blue-600"
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: "Bank-Level Security",
      description: "256-bit SSL encryption",
      color: "text-green-600"
    },
    {
      icon: <Eye className="w-6 h-6" />,
      title: "Zero Data Retention",
      description: "Files deleted after processing",
      color: "text-purple-600"
    },
    {
      icon: <CheckCircle className="w-6 h-6" />,
      title: "SOC 2 Certified",
      description: "Audited security controls",
      color: "text-red-600"
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Trusted by Legal Professionals
          </h2>
          <p className="text-xl text-slate-600">
            Enterprise-grade security and compliance for sensitive documents
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {indicators.map((indicator, index) => (
            <div 
              key={index}
              className="text-center"
            >
              <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mx-auto mb-4 text-white">
                {indicator.icon}
              </div>
              <h4 className="font-semibold text-slate-900 text-lg mb-2">
                {indicator.title}
              </h4>
              <p className="text-slate-600">
                {indicator.description}
              </p>
            </div>
          ))}
        </div>

        {/* Usage stats */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-2xl font-bold text-slate-900">
            <span className="text-green-600">10,000+</span>
            <span className="text-slate-400">documents processed</span>
            <span className="text-slate-400">•</span>
            <span className="text-green-600">99.9%</span>
            <span className="text-slate-400">uptime</span>
            <span className="text-slate-400">•</span>
            <span className="text-green-600">HIPAA</span>
            <span className="text-slate-400">compliant</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustIndicators;
