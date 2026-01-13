"use client";

import { useEffect } from "react";

/**
 * Osano Cookie Consent Banner (Free & Open Source)
 *
 * This uses the free, open-source cookie consent solution by Osano
 * (formerly known as Cookie Consent by Silktide).
 *
 * Features:
 * - Completely free
 * - GDPR/CCPA compliant
 * - Customizable appearance
 * - No account required
 *
 * Documentation: https://www.osano.com/cookieconsent
 */

declare global {
  interface Window {
    cookieconsent: {
      initialise: (config: Record<string, unknown>) => void;
    };
  }
}

export function CookieConsent() {
  useEffect(() => {
    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://cdn.jsdelivr.net/npm/cookieconsent@3/build/cookieconsent.min.css";
    document.head.appendChild(link);

    // Load JS and initialize
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/cookieconsent@3/build/cookieconsent.min.js";
    script.async = true;
    script.onload = () => {
      window.cookieconsent.initialise({
        palette: {
          popup: {
            background: "#000000",
            text: "#ffffff",
          },
          button: {
            background: "#ffffff",
            text: "#000000",
          },
        },
        theme: "classic",
        position: "bottom-right",
        content: {
          message:
            "We use cookies to ensure you get the best experience on our website.",
          dismiss: "Got it!",
          link: "Learn more",
          href: "/cookies",
        },
      });
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup on unmount
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return null;
}