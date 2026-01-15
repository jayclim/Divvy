"use client";

import { Zap, Crown } from 'lucide-react';
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { PricingModal } from "@/components/PricingModal";

interface HeaderProps {
  isPro?: boolean;
}

export function Header({ isPro = false }: HeaderProps) {
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
          {isPro ? (
            <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-sm font-medium text-white">
              <Crown className="h-4 w-4" />
              Pro
            </div>
          ) : (
            <PricingModal>
              <button className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800">
                Upgrade to Pro
              </button>
            </PricingModal>
          )}
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