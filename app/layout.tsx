import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import QueryProvider from "@/components/providers/QueryProvider";
import { CookieConsentBanner } from "@/components/CookieConsent";

export const metadata: Metadata = {
  title: "Spliq",
  description: "Effortless expense splitting for groups",
};

import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            forcedTheme="light"
            disableTransitionOnChange
          >
            <QueryProvider>
              {children}
              <Toaster />
              <CookieConsentBanner />
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}