"use client";

import { Zap } from 'lucide-react';
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { PricingModal } from "@/components/PricingModal";

export function Header() {
  const router = useRouter();

  return (
    <header className="fixed top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6">
        <div
          className="flex items-center space-x-2 cursor-pointer"
          onClick={() => router.push("/dashboard")}
        >
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Zap className="h-5 w-5 text-white fill-current" />
          </div>
          <span className="text-xl font-bold text-slate-900">
            Spliq
          </span>
        </div>
        <div className="flex items-center gap-4">
          <PricingModal>
            <button className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800">
              Upgrade to Pro
            </button>
          </PricingModal>
          <div
             className="text-sm text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
             onClick={() => router.push('/settings')}
          >
            Settings
          </div>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </header>
  );
}