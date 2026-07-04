import LegalPageLayout from './LegalPageLayout'

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" updated="3 July 2026">
      <p>
        SearchMyJob AI ("we", "us", "our") is owned and operated by Dinesh Wadhwani. This Privacy
        Policy explains what information we collect when you use SearchMyJob AI, how we use it, and
        the choices you have.
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li><strong>Account information:</strong> your email address and authentication credentials.</li>
        <li><strong>Resume data:</strong> the PDF resume you upload, and text extracted from it for AI matching and customization.</li>
        <li><strong>Job search preferences:</strong> job titles, locations, skills, and search settings you configure.</li>
        <li><strong>Third-party API keys:</strong> your own Apify and Groq API keys, which you provide (bring-your-own-key) to enable job scraping and AI features. These are stored encrypted and are never shared or logged.</li>
        <li><strong>Payment information:</strong> credit purchases are processed by Razorpay. We do not store your card, UPI, or bank details — Razorpay handles and secures all payment data directly.</li>
        <li><strong>Usage data:</strong> job search runs, match results, customized resumes, and credit ledger entries associated with your account.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To run job searches on your behalf via LinkedIn and Naukri (through Apify actors, using your own Apify key).</li>
        <li>To match your resume against job descriptions and generate tailored resume content (using Groq AI, with your own Groq key).</li>
        <li>To process credit purchases and maintain an accurate credit balance and transaction history.</li>
        <li>To operate, maintain, and improve the service, and to communicate with you about your account.</li>
      </ul>

      <h2>3. Third-Party Services</h2>
      <p>We rely on the following third-party services to operate SearchMyJob AI:</p>
      <ul>
        <li><strong>Supabase</strong> — authentication, database, file storage, and backend functions.</li>
        <li><strong>Apify</strong> — job listing data scraping, using your own Apify account and API key.</li>
        <li><strong>Groq</strong> — AI-based resume matching and customization, using your own Groq account and API key.</li>
        <li><strong>Razorpay</strong> — payment processing for credit purchases (India, INR).</li>
      </ul>
      <p>Each of these providers has its own privacy policy governing how they handle data passed to them.</p>

      <h2>4. Data Retention</h2>
      <p>
        Your active resume, search configuration, and job results are retained as long as your account
        is active. AI-customized resumes are automatically retained for 30 days from creation and then
        expire. Credit ledger entries are kept as a permanent, immutable audit trail of your transactions.
      </p>

      <h2>5. Data Security</h2>
      <p>
        Your Apify and Groq API keys are stored encrypted and are never logged or exposed. Access to
        your data is protected by row-level security so that only you (and, where necessary for account
        administration, the service owner) can access it.
      </p>

      <h2>6. Your Rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal data at any time by
        contacting us at{' '}
        <a href="mailto:dinesh.k.wadhwani@gmail.com">dinesh.k.wadhwani@gmail.com</a>. You can delete
        your uploaded resume or disconnect your Apify/Groq keys at any time from within the app.
      </p>

      <h2>7. Children's Privacy</h2>
      <p>SearchMyJob AI is intended for use by job seekers of employable age and is not directed at children.</p>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be reflected by
        updating the "Last updated" date above.
      </p>

      <h2>9. Contact</h2>
      <p>
        For any questions about this Privacy Policy or your data, contact:<br />
        Dinesh Wadhwani<br />
        Email: <a href="mailto:dinesh.k.wadhwani@gmail.com">dinesh.k.wadhwani@gmail.com</a><br />
        Address: A1002 Sai Ambience, Near Indian Bank, Pimple Saudagar, Pune 411027, India
      </p>
    </LegalPageLayout>
  )
}
