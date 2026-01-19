'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function AuthButtons() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center space-x-4">
        <div className="animate-pulse bg-slate-200 rounded-lg h-8 w-16"></div>
        <div className="animate-pulse bg-slate-200 rounded-lg h-8 w-20"></div>
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex items-center space-x-4">
        <Link 
          href="/dashboard" 
          className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          Dashboard
        </Link>
        
        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-2 px-3 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-medium">
              {session.user?.name || session.user?.email?.split('@')[0] || 'User'}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-900">
                  {session.user?.name || 'User'}
                </p>
                <p className="text-xs text-slate-500">
                  {session.user?.email}
                </p>
              </div>
              
              <Link
                href="/dashboard"
                className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                onClick={() => setShowDropdown(false)}
              >
                <User className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
              
              <Link
                href="/settings"
                className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                onClick={() => setShowDropdown(false)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Link>
              
              <hr className="my-1" />
              
              <button
                onClick={() => {
                  setShowDropdown(false);
                  signOut({ callbackUrl: '/' });
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-4">
      <Link
        href="/auth/signin"
        className={`text-slate-600 hover:text-slate-900 font-medium transition-colors ${
          pathname === '/auth/signin' ? 'text-slate-900' : ''
        }`}
      >
        Sign In
      </Link>
      <Link
        href="/auth/signup"
        className="px-4 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-colors"
      >
        Get Started
      </Link>
    </div>
  );
}
