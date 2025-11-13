import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-kaizen-dark text-kaizen-text-light py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 leading-tight">
              Web Design Liverpool
            </h1>

            <div className="space-y-4 mb-8 text-lg text-kaizen-text-light/80">
              <p>
                We design and build fast, modern websites that help Liverpool businesses generate leads and grow online. No bloat, no jargon – just clean websites that work.
              </p>
              <p>
                We bring Agile product thinking to every project, so your website launches on time and gets better over time as we learn what works for your audience.
              </p>
              <p>
                We're based around the Baltic Triangle and L1, so we understand how local customers search and what Liverpool businesses need to compete online.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/contact"
                className="px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition inline-flex items-center justify-center gap-2"
              >
                Get a Liverpool Web Design Quote
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/services/web-design"
                className="px-8 py-3 rounded-full bg-white/10 border border-kaizen-text-light/30 text-kaizen-text-light font-heading font-bold hover:bg-white/20 transition inline-flex items-center justify-center gap-2"
              >
                View Services
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Who We Help Section */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Websites for Liverpool Businesses Like Yours
            </h2>
            <p className="text-lg text-kaizen-text-dark/70 max-w-2xl mx-auto">
              We work with a range of local businesses, each with different needs. Here's who we help.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Professional Services */}
            <div className="p-8 bg-kaizen-light rounded-2xl border border-kaizen-light">
              <h3 className="text-xl font-heading font-bold mb-6">Professional Services</h3>
              <ul className="space-y-4 text-kaizen-text-dark/70">
                <li className="flex gap-3">
                  <CheckCircle2 className="text-kaizen-cyan flex-shrink-0 mt-1" size={20} />
                  <span>Solicitors, accountants and consultants who need to attract clients through a credible, professional online presence</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="text-kaizen-cyan flex-shrink-0 mt-1" size={20} />
                  <span>Businesses that struggle with making their services clear to potential clients</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="text-kaizen-cyan flex-shrink-0 mt-1" size={20} />
                  <span>Firms needing a simple way to manage and update their website without technical help</span>
                </li>
              </ul>
            </div>

            {/* Trades & Services */}
            <div className="p-8 bg-kaizen-light rounded-2xl border border-kaizen-light">
              <h3 className="text-xl font-heading font-bold mb-6">Trades & Home Services</h3>
              <ul className="space-y-4 text-kaizen-text-dark/70">
                <li className="flex gap-3">
                  <CheckCircle2 className="text-kaizen-cyan flex-shrink-0 mt-1" size={20} />
                  <span>Plumbers, electricians, decorators and other trades who want more qualified enquiries from local customers</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="text-kaizen-cyan flex-shrink-0 mt-1" size={20} />
                  <span>Service businesses that need to show their portfolio and customer testimonials</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="text-kaizen-cyan flex-shrink-0 mt-1" size={20} />
                  <span>Companies looking to appear in local search results and get more "near me" bookings</span>
                </li>
              </ul>
            </div>

            {/* E-commerce & Retail */}
            <div className="p-8 bg-kaizen-light rounded-2xl border border-kaizen-light">
              <h3 className="text-xl font-heading font-bold mb-6">E-commerce & Local Retail</h3>
              <ul className="space-y-4 text-kaizen-text-dark/70">
                <li className="flex gap-3">
                  <CheckCircle2 className="text-kaizen-cyan flex-shrink-0 mt-1" size={20} />
                  <span>Shops, boutiques and online retailers that want a beautiful, easy-to-manage storefront</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="text-kaizen-cyan flex-shrink-0 mt-1" size={20} />
                  <span>Businesses that need stronger online visibility to compete with larger chains</span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="text-kaizen-cyan flex-shrink-0 mt-1" size={20} />
                  <span>Retailers wanting to drive customers both online and in-store</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Local Trust Block */}
      <section className="py-20 md:py-32 bg-kaizen-dark text-kaizen-text-light">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-8">
              Proudly Based in Liverpool
            </h2>

            <div className="space-y-6 text-lg text-kaizen-text-light/80 mb-8">
              <p>
                We're based around the Baltic Triangle and L1, where we work with clients across Merseyside. We understand how local customers search – from "plumber near me" to specific area names like L2, L3, and the city centre.
              </p>
              <p>
                We know what it takes for a Liverpool business to stand out online. Whether you're in the city centre, the suburbs, or anywhere across Merseyside, we've worked with local businesses and understand the competitive landscape.
              </p>
              <p>
                If you'd like to chat about a project or just grab a coffee in town to discuss what's needed, we're here. No jargon, no high-pressure sales – just a practical conversation about what your business needs online.
              </p>
            </div>

            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
            >
              Book a Quick Video Call
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              What We Do
            </h2>
            <p className="text-lg text-kaizen-text-dark/70 max-w-2xl mx-auto">
              Beyond beautiful websites, we help Liverpool businesses improve how they work online.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Web Design",
                description: "Modern, responsive websites that load fast and help you get enquiries.",
                link: "/services/web-design",
              },
              {
                title: "Local SEO",
                description: "Help local customers find you through search. Google Business Profile, location pages, reviews.",
                link: "/services/local-seo",
              },
              {
                title: "E-commerce",
                description: "Sell online with a store that's easy to manage and set up to convert visitors into customers.",
                link: "/services/ecommerce",
              },
              {
                title: "Digital Transformation",
                description: "Join up your website with your back-office processes so everything runs more smoothly.",
                link: "/services/digital-transformation",
              },
              {
                title: "Contract Product Owner",
                description: "Need someone to own your roadmap and deliver better digital products without hiring full-time.",
                link: "/contract-product-owner",
              },
            ].map((service, index) => (
              <Link
                key={index}
                to={service.link}
                className="p-8 bg-kaizen-light rounded-2xl border border-kaizen-light hover:border-kaizen-cyan hover:shadow-lg transition group"
              >
                <h3 className="text-xl font-heading font-bold mb-4 group-hover:text-kaizen-cyan transition">
                  {service.title}
                </h3>
                <p className="text-kaizen-text-dark/70 mb-6">{service.description}</p>
                <div className="flex items-center gap-2 text-kaizen-cyan font-medium text-sm">
                  Learn More <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Work */}
      <section className="py-20 md:py-32 bg-kaizen-light">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Recent Work & Results
            </h2>
            <p className="text-lg text-kaizen-text-dark/70 max-w-2xl mx-auto">
              We focus on clear, measurable outcomes. Here's what we've delivered for Liverpool businesses.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {[
              {
                industry: "Professional Services",
                problem: "Low enquiry volume from website",
                outcome: "Clearer enquiry funnel, improved messaging",
              },
              {
                industry: "E-commerce Retailer",
                problem: "Slow site, hard to update product information",
                outcome: "Fast, responsive store with simple content management",
              },
              {
                industry: "Local Service Business",
                problem: "Not appearing in local search results",
                outcome: "Google Business Profile optimised, better local visibility",
              },
              {
                industry: "Office-Based Business",
                problem: "Website felt outdated, poor mobile experience",
                outcome: "Modern design, mobile-first, better user experience",
              },
            ].map((study, index) => (
              <div key={index} className="p-8 bg-white rounded-2xl border border-kaizen-light">
                <div className="text-sm font-medium text-kaizen-cyan mb-3">{study.industry}</div>
                <h3 className="text-lg font-heading font-bold mb-4">The Challenge</h3>
                <p className="text-kaizen-text-dark/70 mb-6">{study.problem}</p>
                <h3 className="text-lg font-heading font-bold mb-4">The Outcome</h3>
                <p className="text-kaizen-text-dark/70">{study.outcome}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              to="/case-studies"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
            >
              Explore More Case Studies
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Why Work With Kaizen */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Why Work With Kaizen
            </h2>
            <p className="text-lg text-kaizen-text-dark/70 max-w-2xl mx-auto">
              How we're different from the typical agency
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              {
                title: "Clear Roadmap",
                description:
                  "We'll show you exactly what we're building and why. You'll understand the strategy, not just see mockups.",
              },
              {
                title: "Agile Delivery",
                description:
                  "Projects launch faster because we break work into smaller, testable pieces. We adapt if something isn't working.",
              },
              {
                title: "Long-Term Maintainability",
                description:
                  "We build clean, well-documented code that's easy for you or another developer to update later. No vendor lock-in.",
              },
              {
                title: "Practical Focus",
                description:
                  "We skip the buzzwords and focus on outcomes. More enquiries. Better visibility. Simpler processes. That's what matters.",
              },
            ].map((item, index) => (
              <div key={index} className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-gradient-to-br from-kaizen-cyan to-kaizen-lime">
                    <CheckCircle2 className="text-white" size={24} />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-heading font-bold mb-2">{item.title}</h3>
                  <p className="text-kaizen-text-dark/70">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32 bg-kaizen-dark text-kaizen-text-light">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Ready to Build Your Liverpool Web Design?
          </h2>
          <p className="text-lg text-kaizen-text-light/80 mb-8 max-w-2xl mx-auto">
            Let's chat about what your business needs. No jargon, no obligation – just a practical conversation.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
          >
            Get a Quote
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
