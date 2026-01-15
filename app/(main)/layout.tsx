import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { checkSubscription } from "@/lib/auth/subscription";

export const metadata: Metadata = {
  title: "Spliq",
  description: "Manage your group expenses seamlessly.",
};

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isPro = await checkSubscription();

  return (
    <div className="min-h-screen bg-slate-50">
      <Header isPro={isPro} />
      <div className="flex min-h-[calc(100vh-4rem)] pt-16">
        <main className="flex-1 p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
