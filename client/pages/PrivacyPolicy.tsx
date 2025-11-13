import Layout from "@/components/Layout";

export default function PrivacyPolicy() {
  return (
    <Layout>
      <div className="bg-white py-20 md:py-32 px-4">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">Privacy Policy</h1>
          <p className="text-kaizen-text-dark/60 mb-12">Last updated: January 2024</p>

          <div className="prose prose-lg max-w-none space-y-8 text-kaizen-text-dark/80">
            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">1. Introduction</h2>
              <p>
                Kaizen Web ("we", "us", "our", or "Company") respects the privacy of our users ("user" or "you"). This Privacy Policy explains how we collect, use, disclose, and otherwise handle your information when you visit our website, kaizenweb.co.uk (the "Site"), and use our services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">2. Information We Collect</h2>
              <p>We may collect information about you in various ways, including:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Information you provide directly:</strong> When you contact us, request a quote, or submit a form, we collect information such as your name, email address, phone number, company name, and the details of your inquiry.</li>
                <li><strong>Usage data:</strong> We automatically collect information about how you interact with our Site, including pages visited, time spent on pages, links clicked, and other analytics data.</li>
                <li><strong>Cookies:</strong> We use cookies and similar tracking technologies to improve your experience and understand how the Site is used.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Respond to your inquiries and provide the services you request</li>
                <li>Send promotional communications (with your consent)</li>
                <li>Improve and optimize our Site and services</li>
                <li>Comply with legal obligations</li>
                <li>Prevent fraudulent transactions and other illegal activities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">4. Data Protection</h2>
              <p>
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or method of electronic storage is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">5. Your Rights</h2>
              <p>
                Under the UK GDPR and Data Protection Act 2018, you have rights regarding your personal data, including the right to access, rectify, or delete your information. To exercise these rights, please contact us using the details below.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">6. Third-Party Services</h2>
              <p>
                Our Site may contain links to third-party websites. We are not responsible for the privacy practices of other sites. We encourage you to review the privacy policies of any third-party services before providing your information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">7. Cookies</h2>
              <p>
                We use cookies to enhance your browsing experience. You can control cookie settings through your browser preferences. Please note that disabling cookies may affect the functionality of our Site.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">8. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy periodically to reflect changes in our practices or applicable law. We will notify you of any material changes by updating the "Last Updated" date at the top of this page.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-heading font-bold mb-4">9. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy or our privacy practices, please contact us at:
              </p>
              <div className="bg-kaizen-light p-6 rounded-lg mt-4">
                <p className="font-bold mb-2">Kaizen Web</p>
                <p>Liverpool, UK</p>
                <p>Email: contact@kaizenweb.co.uk</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
