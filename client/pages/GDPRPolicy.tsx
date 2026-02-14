import Layout from "@/components/Layout";

export default function GDPRPolicy() {
  return (
    <Layout>
      <div className="bg-white py-20 md:py-32 px-4">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">GDPR & Data Protection</h1>
          <p className="text-kaizen-text-dark/60 mb-12">Last updated: January 2024</p>

          <div className="prose prose-lg max-w-none space-y-8 text-kaizen-text-dark/80">
            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">Our Commitment to Data Protection</h2>
              <p>
                Kaizen Web is committed to protecting your personal data and your right to privacy. We comply with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">1. Legal Basis for Processing</h2>
              <p>We process your personal data on the following legal bases:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Consent:</strong> You have given clear consent for us to process your personal data for a specific purpose.</li>
                <li><strong>Contract:</strong> Processing is necessary to perform a contract with you or at your request before entering a contract.</li>
                <li><strong>Legal obligation:</strong> We are required by law to process your personal data.</li>
                <li><strong>Legitimate interests:</strong> Processing is necessary for our legitimate business interests, and your interests do not override these.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">2. Your Data Rights</h2>
              <p>Under the UK GDPR, you have the following rights:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Right to access:</strong> You can request a copy of the personal data we hold about you.</li>
                <li><strong>Right to rectification:</strong> You can ask us to correct or complete incomplete data.</li>
                <li><strong>Right to erasure:</strong> You can request deletion of your personal data (subject to certain conditions).</li>
                <li><strong>Right to restrict processing:</strong> You can ask us to limit how we use your data.</li>
                <li><strong>Right to data portability:</strong> You can request your data in a machine-readable format.</li>
                <li><strong>Right to object:</strong> You can object to specific types of processing.</li>
                <li><strong>Rights related to automated decision-making:</strong> You have rights regarding decisions made solely by automated means.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">3. Data Retention</h2>
              <p>
                We retain your personal data for as long as necessary to fulfill the purposes for which it was collected. The retention period varies depending on the context of the processing and our legal obligations:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Contact information: Retained for the duration of our business relationship, plus 3 years for legal compliance.</li>
                <li>Website analytics: Retained for up to 26 months.</li>
                <li>Email communications: Retained until you unsubscribe or request deletion.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">4. Data Sharing & Third Parties</h2>
              <p>
                We do not sell, trade, or rent your personal data to third parties. We may share your information with:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Service providers who assist us in operating our website and providing our services (under data processing agreements).</li>
                <li>Legal authorities when required by law or to protect our rights.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">5. International Transfers</h2>
              <p>
                We process personal data within the UK and EU. If we transfer data internationally, we ensure appropriate safeguards are in place, such as Standard Contractual Clauses.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">6. Data Security</h2>
              <p>
                We implement industry-standard security measures to protect your personal data from unauthorized access, alteration, disclosure, or destruction. Our security measures include encryption, secure server infrastructure, and access controls.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">7. Cookies & Tracking Technologies</h2>
              <p>
                We use cookies and similar technologies on our website to enhance user experience and analyze usage patterns. You have the right to accept or reject non-essential cookies. Please see our <a href="/privacy-policy" className="text-kaizen-cyan hover:underline">Privacy Policy</a> for more details.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">8. Data Breach Notification</h2>
              <p>
                If we discover a data breach affecting your personal data, we will notify you and relevant authorities within 72 hours as required by the UK GDPR, unless the breach is unlikely to pose a risk to your rights and freedoms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">9. Exercising Your Rights</h2>
              <p>
                To exercise any of your data protection rights, please contact us with your full name and email address. We will respond to your request within 30 days.
              </p>
              <div className="bg-kaizen-light p-6 rounded-lg mt-4">
                <p className="font-bold mb-2">Data Protection Contact</p>
                <p>Email: privacy@kaizenweb.co.uk</p>
                <p>Address: Liverpool, UK</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">10. Data Protection Officer</h2>
              <p>
                If you have concerns about our data protection practices or wish to lodge a complaint, you can contact the Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" className="text-kaizen-cyan hover:underline">ico.org.uk</a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">11. Changes to This Policy</h2>
              <p>
                We may update this GDPR & Data Protection policy to reflect changes in our practices or applicable law. We will notify you of significant changes by updating the date above.
              </p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
