import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { FilesProvider } from "./context/context";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";

// app/layout.tsx

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LegalRedactor - Automated Legal Redaction Software",
  description:
    "Redact legal documents 10x faster with automatic PII detection, bulk processing, and HIPAA-compliant redaction.",
  keywords: [
    "legal redaction",
    "document redaction",
    "PII detection",
    "HIPAA compliance",
    "legal software",
  ],
  authors: [{ name: "Ciza Wells" }],
  metadataBase: new URL("https://legalredactor.com"),
  openGraph: {
    title: "LegalRedactor - Automated Legal Redaction",
    description: "Professional redaction software for law firms",
    url: "https://legalredactor.com",
    siteName: "LegalRedactor",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LegalRedactor",
    description: "Automated legal redaction software",
    creator: "@legalredactor", // Reserve this handle!
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <FilesProvider>{children}</FilesProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
