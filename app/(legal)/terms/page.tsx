export default function TermsPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
        Terms of Service
      </h1>
      <p className="text-sm text-slate-500 mb-8">Last Updated: December 12, 2025</p>

      <p className="text-slate-600 leading-relaxed">
        Welcome to Spliq! These Terms of Service (&quot;Terms&quot;) govern your use of the
        website spliq.app (the &quot;Site&quot;) and the Spliq expense splitting service (the
        &quot;Service&quot;). By accessing or using the Service, you agree to be bound by
        these Terms.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        1. Acceptance of Terms
      </h2>
      <p className="text-slate-600 leading-relaxed">
        By creating an account or using the Service, you agree to these Terms. If
        you do not agree, you may not use the Service.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        2. Description of Service
      </h2>
      <p className="text-slate-600 leading-relaxed">
        Spliq is a web application that helps groups track and split shared
        expenses. We offer a free tier and a paid &quot;Pro&quot; subscription that includes
        advanced features like AI receipt scanning.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        3. Merchant of Record
      </h2>
      <p className="text-slate-600 leading-relaxed">
        Our order process is conducted by our online reseller Paddle.com Market
        Ltd. (doing business as Lemon Squeezy). Lemon Squeezy is the Merchant of
        Record for all our orders. Lemon Squeezy provides all customer service
        inquiries and handles returns.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        4. Subscriptions and Payments
      </h2>
      <ul className="text-slate-600 leading-relaxed space-y-2">
        <li>
          <strong className="text-slate-900">Pro Subscription:</strong> Features such as AI
          scanning and smart settlements are available via a paid subscription.
        </li>
        <li>
          <strong className="text-slate-900">Billing:</strong> You will be billed in advance
          on a recurring and periodic basis (monthly or annually).
        </li>
        <li>
          <strong className="text-slate-900">Cancellation:</strong> You may cancel your
          subscription at any time through the Lemon Squeezy customer portal. Your
          access will continue until the end of your current billing period.
        </li>
        <li>
          <strong className="text-slate-900">Refunds:</strong> Refunds are handled at the
          discretion of Lemon Squeezy in accordance with their refund policy.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        5. User Conduct
      </h2>
      <p className="text-slate-600 leading-relaxed">
        You agree not to use the Service for any unlawful purpose or to solicit
        others to perform or participate in any unlawful acts. You are responsible
        for all activity that occurs under your account.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        6. Intellectual Property
      </h2>
      <p className="text-slate-600 leading-relaxed">
        The Service and its original content (excluding content provided by
        users), features, and functionality are and will remain the exclusive
        property of Spliq.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        7. Limitation of Liability
      </h2>
      <p className="text-slate-600 leading-relaxed">
        In no event shall Spliq, nor its directors, employees, partners, agents,
        suppliers, or affiliates, be liable for any indirect, incidental, special,
        consequential or punitive damages, including without limitation, loss of
        profits, data, use, goodwill, or other intangible losses, resulting from
        your access to or use of or inability to access or use the Service.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        8. Changes
      </h2>
      <p className="text-slate-600 leading-relaxed">
        We reserve the right, at our sole discretion, to modify or replace these
        Terms at any time.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        9. Contact Us
      </h2>
      <p className="text-slate-600 leading-relaxed">
        If you have any questions about these Terms, please contact us at{" "}
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