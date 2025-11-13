import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

export default function WebDesign() {
  return (
    <Layout>
      {/* Hero / Intro Section */}
      <section className="bg-kaizen-dark text-kaizen-text-light py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-heading font-bold mb-8 leading-tight">
              Web Design Liverpool
            </h1>

            <div className="space-y-4 mb-8 text-lg text-kaizen-text-light/80">
              <p>
                We design and build websites that load quickly, look modern, and are easy for your non-technical team to update. No bloated frameworks, no overcomplicated dashboards – just clean, responsive websites that work.
              </p>
            </div>

            {/* Outcomes List */}
            <div className="space-y-3 mb-12">
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">More qualified enquiries</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Clearer messaging and navigation</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">SEO-ready site structure</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Mobile-first design that works everywhere</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-16 text-center">
            How Our Liverpool Web Design Projects Work
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                number: "1",
                title: "Discover",
                description:
                  "We run a workshop to understand your goals, your audience, and what's working (or not) with your current site. No assumptions – just practical conversation.",
              },
              {
                number: "2",
                title: "Design",
                description:
                  "We create wireframes and visual designs aligned with your brand. You'll see exactly how the site will look and work before we write any code.",
              },
              {
                number: "3",
                title: "Build",
                description:
                  "We build a responsive, SEO-friendly site with clean, maintainable code. The site is fast, accessible, and easy for your team to update.",
              },
              {
                number: "4",
                title: "Launch & Improve",
                description:
                  "We test thoroughly, launch the site, then work with you on small iterative improvements based on real user feedback and data.",
              },
            ].map((step, index) => (
              <div key={index} className="flex flex-col">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-kaizen-cyan to-kaizen-lime flex items-center justify-center mb-6">
                  <span className="text-kaizen-dark font-heading font-bold text-lg">{step.number}</span>
                </div>
                <h3 className="text-xl font-heading font-bold mb-4">{step.title}</h3>
                <p className="text-kaizen-text-dark/70 flex-grow">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-20 md:py-32 bg-kaizen-light">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-12 text-center">
            What's Included in Our Web Design Service
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              "Responsive design that works on mobile, tablet and desktop",
              "Fast page load times (optimised images, modern build process)",
              "SEO-ready structure with semantic HTML",
              "Easy content management (you can update text and images easily)",
              "Contact forms and email notifications",
              "Analytics setup (Google Analytics, tracking pixels)",
              "Accessibility review (WCAG standards)",
              "Launch support and initial training",
            ].map((item, index) => (
              <div key={index} className="flex gap-3">
                <Check className="text-kaizen-cyan flex-shrink-0 mt-1" size={20} />
                <span className="font-body text-kaizen-text-dark">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Next Steps Section */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-12">Next Steps</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
            {[
              {
                title: "Explore Our Case Studies",
                description: "See examples of websites we've built and the outcomes we've delivered for Liverpool businesses.",
                link: "/case-studies",
              },
              {
                title: "Learn About Local SEO",
                description: "A great website works best with Local SEO. Help local customers find you through Google search.",
                link: "/services/local-seo",
              },
              {
                title: "E-commerce Development",
                description: "If you're selling online, we can build a fast, easy-to-manage store that converts.",
                link: "/services/ecommerce",
              },
              {
                title: "Get a Quote",
                description: "Ready to talk about your project? Let's discuss what you need and how we can help.",
                link: "/contact",
              },
            ].map((item, index) => (
              <Link
                key={index}
                to={item.link}
                className="p-8 bg-kaizen-light rounded-2xl border border-kaizen-light hover:border-kaizen-cyan hover:shadow-lg transition group"
              >
                <h3 className="text-lg font-heading font-bold mb-3 group-hover:text-kaizen-cyan transition">
                  {item.title}
                </h3>
                <p className="text-kaizen-text-dark/70 text-sm mb-6">{item.description}</p>
                <div className="flex items-center gap-2 text-kaizen-cyan font-medium text-sm">
                  Learn More <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-32 bg-kaizen-dark text-kaizen-text-light">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Let's Build Your Liverpool Website
          </h2>
          <p className="text-lg text-kaizen-text-light/80 mb-8 max-w-2xl mx-auto">
            Tell us about your project. We'll give you an honest assessment of what's needed and how we can help.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
          >
            Request a Quote
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
