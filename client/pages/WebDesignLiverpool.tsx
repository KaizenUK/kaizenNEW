import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

export default function WebDesignLiverpool() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-kaizen-dark text-kaizen-text-light py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 leading-tight">
              Web Design Liverpool
            </h1>

            <div className="space-y-4 mb-8 text-lg text-kaizen-text-light/80">
              <p>
                Your website is your digital storefront. If it's slow, unclear, or hard to update, you're losing business. We design and build fast, modern websites that help Liverpool businesses generate leads and grow online.
              </p>
              <p>
                We're based in Liverpool. We understand how local customers search, what local businesses need, and how to compete in your market.
              </p>
            </div>

            <div className="space-y-3 mb-12">
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Fast load times that improve conversions</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Mobile-first design for your customers</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">SEO-ready from day one</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Easy for your team to update</span>
              </div>
            </div>

            <Link
              to="/services/web-design"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
            >
              Learn More About Web Design
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-12">Why Choose Kaizen for Web Design in Liverpool</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: "Local Knowledge",
                description: "We're based in Liverpool. We know your market, your customers, and what works locally.",
              },
              {
                title: "Fast Websites",
                description: "Page speed affects your Google ranking and your conversion rate. We build fast.",
              },
              {
                title: "SEO Built In",
                description: "Your website is built to rank. No SEO band-aids needed – it's designed right from the start.",
              },
              {
                title: "Easy to Update",
                description: "You shouldn't need a developer to update your team information or add a blog post.",
              },
              {
                title: "Agile Delivery",
                description: "You see progress regularly. We ship working features early, not everything at the end.",
              },
              {
                title: "Long-term Support",
                description: "We're here after launch. We help you improve your site based on real user feedback.",
              },
            ].map((item, idx) => (
              <div key={idx} className="p-8 bg-kaizen-light rounded-2xl border border-kaizen-light">
                <h3 className="text-lg font-heading font-bold mb-3">{item.title}</h3>
                <p className="text-kaizen-text-dark/70">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-32 bg-kaizen-dark text-kaizen-text-light">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Ready for a modern website?
          </h2>
          <p className="text-lg text-kaizen-text-light/80 mb-8 max-w-2xl mx-auto">
            Let's chat about what your business needs. We'll give you honest advice about what's worth building.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
          >
            Get a Web Design Quote
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
