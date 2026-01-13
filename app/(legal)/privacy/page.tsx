export default function PrivacyPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
        Privacy Policy
      </h1>
      <p className="text-sm text-slate-500 mb-8">Last Updated: December 12, 2025</p>

      <p className="text-slate-600 leading-relaxed">
        This Privacy Policy describes Our policies and procedures on the
        collection, use and disclosure of Your information when You use the
        Service and tells You about Your privacy rights and how the law protects
        You.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        1. Information We Collect
      </h2>
      <ul className="text-slate-600 leading-relaxed space-y-2">
        <li>
          <strong className="text-slate-900">Personal Data:</strong> While using Our
          Service, We may ask You to provide Us with certain personally
          identifiable information that can be used to contact or identify You,
          such as your email address and name.
        </li>
        <li>
          <strong className="text-slate-900">Usage Data:</strong> Usage Data is collected
          automatically when using the Service (e.g., IP address, browser type,
          pages visited).
        </li>
        <li>
          <strong className="text-slate-900">Payment Information:</strong> We do NOT store
          your sensitive payment card information. All payments are processed by
          our Merchant of Record, Lemon Squeezy.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        2. How We Use Your Information
      </h2>
      <p className="text-slate-600 leading-relaxed mb-4">
        We use your Personal Data to:
      </p>
      <ul className="text-slate-600 leading-relaxed space-y-2">
        <li>Provide and maintain our Service.</li>
        <li>Manage your Account.</li>
        <li>
          Contact you with newsletters or promotional materials (which you can
          opt-out of).
        </li>
        <li>Process payments and prevent fraud.</li>
      </ul>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        3. Sharing Your Information
      </h2>
      <p className="text-slate-600 leading-relaxed mb-4">
        We may share Your personal information in the following situations:
      </p>
      <ul className="text-slate-600 leading-relaxed space-y-2">
        <li>
          <strong className="text-slate-900">With Service Providers:</strong> To monitor
          and analyze the use of our Service (e.g., Vercel, Lemon Squeezy).
        </li>
        <li>
          <strong className="text-slate-900">For Business Transfers:</strong> In connection
          with, or during negotiations of, any merger, sale of Company assets,
          financing, or acquisition.
        </li>
      </ul>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        4. Data Retention
      </h2>
      <p className="text-slate-600 leading-relaxed">
        We will retain Your Personal Data only for as long as is necessary for the
        purposes set out in this Privacy Policy.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        5. Security of Your Data
      </h2>
      <p className="text-slate-600 leading-relaxed">
        The security of Your Personal Data is important to Us, but remember that
        no method of transmission over the Internet, or method of electronic
        storage is 100% secure.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        6. Children&apos;s Privacy
      </h2>
      <p className="text-slate-600 leading-relaxed">
        Our Service does not address anyone under the age of 13. We do not
        knowingly collect personally identifiable information from anyone under
        the age of 13.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        7. Links to Other Websites
      </h2>
      <p className="text-slate-600 leading-relaxed">
        Our Service may contain links to other websites that are not operated by
        Us. If You click on a third party link, You will be directed to that third
        party&apos;s site.
      </p>

      <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">
        8. Contact Us
      </h2>
      <p className="text-slate-600 leading-relaxed">
        If you have any questions about this Privacy Policy, you can contact us by
        email:{" "}
        <a
          href="mailto:support@spliq.app"
          className="text-slate-900 underline hover:no-underline"
        >
          support@spliq.app
        </a>
      </p>
    </article>
  );
}