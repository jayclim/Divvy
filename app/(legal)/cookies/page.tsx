export default function CookiePolicyPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
        Cookie Policy
      </h1>
      <p className="text-sm text-slate-500 mb-8">Last Updated: January 12, 2026</p>

      <p className="text-slate-600 leading-relaxed">
        This Cookie Policy explains how Spliq (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) uses
        cookies and similar technologies when you visit our website at spliq.app.
        It explains what these technologies are and why we use them, as well as
        your rights to control our use of them.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        1. What Are Cookies?
      </h2>
      <p className="text-slate-600 leading-relaxed">
        Cookies are small data files that are placed on your computer or mobile
        device when you visit a website. Cookies are widely used by website owners
        to make their websites work, or to work more efficiently, as well as to
        provide reporting information.
      </p>
      <p className="text-slate-600 leading-relaxed mt-4">
        Cookies set by the website owner (in this case, Spliq) are called
        &quot;first-party cookies&quot;. Cookies set by parties other than the website
        owner are called &quot;third-party cookies&quot;. Third-party cookies enable
        third-party features or functionality to be provided on or through the
        website (e.g., advertising, interactive content, and analytics).
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        2. Why Do We Use Cookies?
      </h2>
      <p className="text-slate-600 leading-relaxed mb-4">
        We use first-party and third-party cookies for several reasons:
      </p>
      <ul className="text-slate-600 leading-relaxed space-y-2">
        <li>
          <strong className="text-slate-900">Essential Cookies:</strong> These
          cookies are strictly necessary to provide you with services available
          through our website and to use some of its features, such as access to
          secure areas. Without these cookies, services you have asked for cannot
          be provided.
        </li>
        <li>
          <strong className="text-slate-900">Authentication Cookies:</strong> We
          use cookies to identify you when you visit our website and as you
          navigate our website, and to help us determine if you are logged into
          our website.
        </li>
        <li>
          <strong className="text-slate-900">Analytics Cookies:</strong> These
          cookies help us understand how visitors interact with our website by
          collecting and reporting information anonymously.
        </li>
        <li>
          <strong className="text-slate-900">Preference Cookies:</strong> These
          cookies enable the website to remember choices you make (such as your
          preferred language or the region you are in) and provide enhanced, more
          personal features.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        3. Cookies We Use
      </h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-slate-600 mt-4">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 pr-4 font-semibold text-slate-900">Cookie</th>
              <th className="text-left py-3 pr-4 font-semibold text-slate-900">Provider</th>
              <th className="text-left py-3 pr-4 font-semibold text-slate-900">Purpose</th>
              <th className="text-left py-3 font-semibold text-slate-900">Type</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-3 pr-4">__clerk_*</td>
              <td className="py-3 pr-4">Clerk</td>
              <td className="py-3 pr-4">Authentication and session management</td>
              <td className="py-3">Essential</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-3 pr-4">cookieyes-*</td>
              <td className="py-3 pr-4">CookieYes</td>
              <td className="py-3 pr-4">Stores user cookie consent preferences</td>
              <td className="py-3">Essential</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        4. How Can You Control Cookies?
      </h2>
      <p className="text-slate-600 leading-relaxed">
        You have the right to decide whether to accept or reject cookies. You can
        exercise your cookie preferences by clicking on the &quot;Cookie Settings&quot;
        link in our website footer.
      </p>
      <p className="text-slate-600 leading-relaxed mt-4">
        You can also set or amend your web browser controls to accept or refuse
        cookies. If you choose to reject cookies, you may still use our website
        though your access to some functionality and areas of our website may be
        restricted.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        5. How Often Will We Update This Cookie Policy?
      </h2>
      <p className="text-slate-600 leading-relaxed">
        We may update this Cookie Policy from time to time in order to reflect
        changes to the cookies we use or for other operational, legal, or
        regulatory reasons. Please therefore revisit this Cookie Policy regularly
        to stay informed about our use of cookies and related technologies.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        6. Contact Us
      </h2>
      <p className="text-slate-600 leading-relaxed">
        If you have any questions about our use of cookies or other technologies,
        please email us at{" "}
        <a
          href="mailto:support@spliq.app"
          className="text-slate-900 underline hover:no-underline"
        >
          support@spliq.app
        </a>
        .
      </p>
    </article>
  );
}
