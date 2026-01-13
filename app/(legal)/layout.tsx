import type { Metadata } from "next";
import Link from "next/link";
import { Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Spliq",
  description: "Legal information for Spliq.",
};

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-white">
      {/* Simple header */}
      <header className="border-b border-slate-200">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Zap className="h-5 w-5 text-white fill-current" />
            </div>
            <span className="text-xl font-bold text-slate-900">Spliq</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-6 py-12 max-w-3xl">
        {children}
      </main>

      {/* Simple footer */}
      <footer className="border-t border-slate-200 mt-auto">
        <div className="container mx-auto px-6 py-8 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Spliq. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/terms" className="hover:text-slate-900 transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/cookies" className="hover:text-slate-900 transition-colors">
              Cookie Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}