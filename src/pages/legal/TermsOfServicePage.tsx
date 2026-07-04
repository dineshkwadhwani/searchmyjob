import LegalPageLayout from './LegalPageLayout'

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" updated="3 July 2026">
      <p>
        These Terms of Service ("Terms") govern your use of SearchMyJob AI, a service owned and
        operated by Dinesh Wadhwani ("we", "us", "our"). By creating an account or using the service,
        you agree to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        SearchMyJob AI helps job seekers search LinkedIn and Naukri job listings, match their resume
        against job descriptions using AI, and generate tailored resume content. Job scraping and AI
        matching/customization require you to connect your own Apify and Groq API keys and accounts.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You must provide accurate information when creating an account and are responsible for
        maintaining the confidentiality of your login credentials and API keys. You are responsible for
        all activity that occurs under your account.
      </p>

      <h2>3. Credits and Payments</h2>
      <ul>
        <li>Certain features (job search, resume matching, resume customization) consume credits, at rates set within the app.</li>
        <li>Credits are purchased in India via Razorpay, in INR, and are added to your wallet upon successful payment.</li>
        <li>Credits do not expire, but hold no cash value and are non-transferable and non-refundable, except where required by applicable law.</li>
        <li>We may change credit costs for features at any time; changes will not retroactively affect credits already purchased.</li>
      </ul>

      <h2>4. Your API Keys and Third-Party Costs</h2>
      <p>
        You are solely responsible for any costs, usage limits, or terms associated with your own
        Apify and Groq accounts and API keys. We are not responsible for the availability, accuracy, or
        pricing of third-party services (Apify, Groq, Razorpay, LinkedIn, Naukri), nor for any actions
        taken by those providers against your accounts.
      </p>

      <h2>5. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service for any unlawful purpose or in violation of any third-party platform's terms of service.</li>
        <li>Attempt to disrupt, reverse-engineer, or gain unauthorized access to the service or other users' data.</li>
        <li>Upload content you do not have the right to upload, or misrepresent your identity or qualifications.</li>
      </ul>

      <h2>6. No Guarantee of Employment Outcomes</h2>
      <p>
        SearchMyJob AI is a tool to assist your job search. We do not guarantee job placement,
        interview opportunities, the accuracy or completeness of scraped job listings, or the quality
        or accuracy of AI-generated match scores or resume content. You should independently verify
        all job listings and review all AI-generated content before relying on or submitting it.
      </p>

      <h2>7. Account Suspension</h2>
      <p>
        We may suspend or disable accounts that violate these Terms, misuse the service, or engage in
        activity that harms the service or other users.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        The service is provided "as is" without warranties of any kind. To the maximum extent
        permitted by law, we are not liable for any indirect, incidental, or consequential damages
        arising from your use of the service, including reliance on job listings, match results, or
        AI-generated resume content.
      </p>

      <h2>9. Changes to the Service or Terms</h2>
      <p>
        We may update these Terms or modify, suspend, or discontinue any part of the service at any
        time. Continued use of the service after changes take effect constitutes acceptance of the
        updated Terms.
      </p>

      <h2>10. Governing Law</h2>
      <p>
        These Terms are governed by the laws of India, and any disputes shall be subject to the
        exclusive jurisdiction of the courts in Pune, Maharashtra, India.
      </p>

      <h2>11. Contact</h2>
      <p>
        For questions about these Terms, contact:<br />
        Dinesh Wadhwani<br />
        Email: <a href="mailto:dinesh.k.wadhwani@gmail.com">dinesh.k.wadhwani@gmail.com</a><br />
        Address: A1002 Sai Ambience, Near Indian Bank, Pimple Saudagar, Pune 411027, India
      </p>
    </LegalPageLayout>
  )
}
