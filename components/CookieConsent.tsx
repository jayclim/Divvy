"use client";

import { useEffect } from "react";
import "vanilla-cookieconsent/dist/cookieconsent.css";
import * as CookieConsent from "vanilla-cookieconsent";

/**
 * Cookie Consent Banner using vanilla-cookieconsent
 *
 * Features:
 * - Free & open source (MIT license)
 * - GDPR/CCPA compliant with accept/reject options
 * - Granular category-based consent
 * - Blocks non-essential scripts until consent given
 *
 * Documentation: https://cookieconsent.orestbida.com/
 */

export function CookieConsentBanner() {
  useEffect(() => {
    CookieConsent.run({
      guiOptions: {
        consentModal: {
          layout: "box inline",
          position: "bottom right",
        },
        preferencesModal: {
          layout: "box",
        },
      },

      categories: {
        necessary: {
          enabled: true,
          readOnly: true, // Cannot be disabled
        },
        analytics: {
          enabled: false,
          readOnly: false,
          // If you add analytics later, enable auto-clear:
          // autoClear: {
          //   cookies: [{ name: /^_ga/ }, { name: "_gid" }],
          // },
        },
      },

      language: {
        default: "en",
        translations: {
          en: {
            consentModal: {
              title: "We use cookies",
              description:
                "We use essential cookies to make our site work. With your consent, we may also use non-essential cookies to improve your experience. You can manage your preferences at any time.",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject non-essential",
              showPreferencesBtn: "Manage preferences",
              footer: '<a href="/privacy">Privacy Policy</a> · <a href="/cookies">Cookie Policy</a>',
            },
            preferencesModal: {
              title: "Cookie Preferences",
              acceptAllBtn: "Accept all",
              acceptNecessaryBtn: "Reject non-essential",
              savePreferencesBtn: "Save preferences",
              closeIconLabel: "Close",
              sections: [
                {
                  title: "Cookie Usage",
                  description:
                    "We use cookies to ensure the basic functionalities of the website and to enhance your online experience. You can choose to opt in or out of each category whenever you want.",
                },
                {
                  title: "Strictly Necessary Cookies",
                  description:
                    "These cookies are essential for the website to function properly. They enable core functionality such as security, authentication, and session management. These cookies do not store any personally identifiable information and cannot be disabled.",
                  linkedCategory: "necessary",
                  cookieTable: {
                    headers: {
                      name: "Name",
                      domain: "Provider",
                      description: "Purpose",
                      expiration: "Duration",
                    },
                    body: [
                      {
                        name: "__session",
                        domain: "Clerk",
                        description: "Manages your active login session and authentication state",
                        expiration: "Session",
                      },
                      {
                        name: "__client_uat",
                        domain: "Clerk",
                        description: "Tracks the last security change (e.g., password reset)",
                        expiration: "Persistent",
                      },
                      {
                        name: "__clerk_db_jwt",
                        domain: "Clerk",
                        description: "Secure token for identity verification",
                        expiration: "Session",
                      },
                      {
                        name: "cc_cookie",
                        domain: "Spliq",
                        description: "Stores your cookie consent preferences",
                        expiration: "1 year",
                      },
                    ],
                  },
                },
                {
                  title: "Analytics Cookies",
                  description:
                    "These cookies help us understand how visitors interact with our website. All data is anonymized and cannot be used to identify you. We currently do not use analytics cookies, but may in the future with your consent.",
                  linkedCategory: "analytics",
                },
                {
                  title: "More Information",
                  description:
                    'For more details about how we use cookies and your data, please read our <a href="/cookies">Cookie Policy</a> and <a href="/privacy">Privacy Policy</a>. If you have questions, contact us at support@spliq.app.',
                },
              ],
            },
          },
        },
      },
    });
  }, []);

  return null;
}

// Re-export CookieConsent utilities for use elsewhere in the app
export const showPreferences = () => CookieConsent.showPreferences();
export const acceptCategory = (category: string) => CookieConsent.acceptCategory(category);
export const eraseCookies = (categories: string[]) => CookieConsent.eraseCookies(categories);