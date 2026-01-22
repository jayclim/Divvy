import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookies Policy - Spliq',
  description: 'Cookies Policy for Spliq.',
};

export default function CookiesPage() {
  return (
    <div className="space-y-8 text-slate-700">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Cookies Policy</h1>
      <p className="text-muted-foreground">Last Updated: January 12, 2026</p>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">1. WHAT ARE COOKIES?</h2>
        <p>
          Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work more efficiently and to provide information to the owners of the site.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">2. HOW WE USE COOKIES</h2>
        <p>
          Spliq uses cookies to authenticate your identity, secure your session, and manage your consent preferences. We do not use cookies for third-party advertising.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">3. CATEGORIES OF COOKIES WE USE</h2>

        <h3 className="text-xl font-semibold text-slate-900">3.1 Strictly Necessary Cookies (Essential).</h3>
        <p>
          These cookies are necessary for the website to function and cannot be switched off in our systems. They are usually only set in response to actions made by you which amount to a request for services, such as logging in or setting your privacy preferences. Under GDPR and CCPA, these do not require your consent, though we inform you of their presence.
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b">
                <th className="p-2 font-semibold text-slate-900">Cookie Name</th>
                <th className="p-2 font-semibold text-slate-900">Provider</th>
                <th className="p-2 font-semibold text-slate-900">Purpose</th>
                <th className="p-2 font-semibold text-slate-900">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="p-2 font-mono text-xs">__session</td>
                <td className="p-2">Clerk</td>
                <td className="p-2">Manages your active login session and authentication state.</td>
                <td className="p-2">Session</td>
              </tr>
              <tr>
                <td className="p-2 font-mono text-xs">__client_uat</td>
                <td className="p-2">Clerk</td>
                <td className="p-2">"User Agent Time" - Updates the client on the last security change (e.g., password reset).</td>
                <td className="p-2">Persistent</td>
              </tr>
              <tr>
                <td className="p-2 font-mono text-xs">__clerk_db_jwt</td>
                <td className="p-2">Clerk</td>
                <td className="p-2">Secure token for database synchronization and identity verification.</td>
                <td className="p-2">Session</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-xl font-semibold text-slate-900">3.2 Functional & Compliance Cookies.</h3>
        <p>
          These cookies enable the website to provide enhanced functionality and personalization. They may be set by us or by third-party providers.
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b">
                <th className="p-2 font-semibold text-slate-900">Cookie Name</th>
                <th className="p-2 font-semibold text-slate-900">Provider</th>
                <th className="p-2 font-semibold text-slate-900">Purpose</th>
                <th className="p-2 font-semibold text-slate-900">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="p-2 font-mono text-xs">cc_cookie</td>
                <td className="p-2">Spliq</td>
                <td className="p-2">Stores your cookie consent preferences (e.g., whether you accepted or declined non-essential cookies) so the banner does not reappear unnecessarily.</td>
                <td className="p-2">1 Year</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">4. MANAGING COOKIES</h2>
        
        <h3 className="text-xl font-semibold text-slate-900">4.1 Consent Banner.</h3>
        <p>
          When you first visit Spliq, you will be presented with a Cookie Consent Banner. You can use this banner to accept all cookies, reject non-essential cookies, or manage your preferences in detail. You can change your preferences at any time by clicking "Manage preferences" in the banner or by clearing your browser cookies.
        </p>

        <h3 className="text-xl font-semibold text-slate-900">4.2 Browser Settings.</h3>
        <p>
          Most web browsers allow some control of most cookies through the browser settings. To find out more about how to manage cookies on popular browsers:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-blue-600">
          <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="hover:underline">Google Chrome</a></li>
          <li><a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" className="hover:underline">Mozilla Firefox</a></li>
          <li><a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="hover:underline">Apple Safari</a></li>
          <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c2b9-2592-b6632096f9d7" target="_blank" rel="noopener noreferrer" className="hover:underline">Microsoft Edge</a></li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">5. CHANGES TO THIS COOKIE POLICY</h2>
        <p>
          We may update this Cookie Policy from time to time to reflect changes to the cookies we use or for other operational, legal, or regulatory reasons. Please re-visit this Cookie Policy regularly to stay informed about our use of cookies and related technologies.
        </p>
      </section>
    </div>
  );
}
