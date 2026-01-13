"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Zap } from "lucide-react";

interface PricingModalProps {
  children?: React.ReactNode;
}

export function PricingModal({ children }: PricingModalProps) {
  const handleUpgrade = () => {
     // TODO: Replace with real Lemon Squeezy checkout link generation
     window.open("https://store.lemonsqueezy.com/checkout/buy/...", "_blank");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black">
              <Zap className="h-5 w-5 text-white" />
            </div>
            Upgrade to Pro
          </DialogTitle>
          <DialogDescription>
            Unlock the full power of Spliq with our Pro plan.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-4 rounded-lg bg-secondary/20 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10">
                <Check className="h-4 w-4 text-green-500" />
              </div>
              <span className="font-medium">AI Receipt Scanning</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10">
                <Check className="h-4 w-4 text-green-500" />
              </div>
              <span className="font-medium">Smart Settlement Links</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10">
                <Check className="h-4 w-4 text-green-500" />
              </div>
              <span className="font-medium">Advanced Charts & Analytics</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10">
                <Check className="h-4 w-4 text-green-500" />
              </div>
              <span className="font-medium">Priority Support</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-center">
            <div className="text-3xl font-bold">$4.99<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
            <p className="text-xs text-muted-foreground">Cancel anytime.</p>
          </div>
        </div>
        <Button onClick={handleUpgrade} className="w-full bg-black font-bold text-white hover:bg-slate-800">
          Upgrade Now
        </Button>
      </DialogContent>
    </Dialog>
  );
}
