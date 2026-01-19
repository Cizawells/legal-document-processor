"use client";

import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

interface ProcessingButtonProps {
  onClick: () => void;
  isProcessing: boolean;
  processingText: string;
  defaultText: string;
  icon: LucideIcon;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ProcessingButton: React.FC<ProcessingButtonProps> = ({
  onClick,
  isProcessing,
  processingText,
  defaultText,
  icon: Icon,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = ''
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white',
    secondary: 'bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white',
    success: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isProcessing}
      className={`
        inline-flex items-center justify-center space-x-2 
        ${variants[variant]} 
        ${sizes[size]}
        rounded-xl font-semibold transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isProcessing ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <Icon className={iconSizes[size]} />
      )}
      <span>{isProcessing ? processingText : defaultText}</span>
    </button>
  );
};

export default ProcessingButton;
