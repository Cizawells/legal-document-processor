"use client";
import { FileText } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import SubscriptionBadge from "../../app/components/SubscriptionBadge";

const AppBar = () => {
  const router = useRouter();
  const session = useSession();
  return (
    <header className="bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div
            className="flex items-center space-x-2 cursor-pointer"
            onClick={() => {
              router.push(`/`); // navigate to /dashboard
            }}
          >
            <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center ">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-800">PDFTools</span>
          </div>
          <nav className="hidden md:flex space-x-6">
            <a
              href="#"
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              Tools
            </a>
            <a
              href="#"
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              Pricing
            </a>
            <a
              href="#"
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              About
            </a>
            <a
              href="#"
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              Contact
            </a>
          </nav>
          <div className="flex items-center space-x-4">
            {session.data && <SubscriptionBadge />}
            {session.data ? (
              <button
                className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-lg hover:from-red-600 hover:to-pink-600 transition-all duration-200"
                onClick={() => {
                  signOut();
                }}
              >
                Sign out
              </button>
            ) : (
              <button
                className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-lg hover:from-red-600 hover:to-pink-600 transition-all duration-200"
                onClick={() => {
                  router.push(`/auth/signup`);
                }}
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppBar;
