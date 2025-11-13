import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

export default function ProductOwner() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-kaizen-dark text-kaizen-text-light py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 leading-tight">
              Contract Product Owner
            </h1>

            <div className="space-y-4 mb-8 text-lg text-kaizen-text-light/80">
              <p>
                You have a team that needs to ship products faster. But do you have someone making the hard decisions about what matters? Someone who owns the roadmap?
              </p>
              <p>
                We provide hands-on product ownership without the full-time hire. We'll set strategy, manage priorities, and make sure your team is always working on the right thing.
              </p>
            </div>

            <div className="space-y-3 mb-12">
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Clear product roadmap</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Strategic decision-making</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Better use of engineering time</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">No full-time hire required</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Bring */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-12">What We Bring</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
            {[
              {
                title: "Experience with Web Platforms",
                description: "We've built and shipped digital products. We know what works and what doesn't.",
              },
              {
                title: "iGaming & Complex Operations",
                description: "We've worked on high-stakes products with complex business requirements.",
              },
              {
                title: "Roadmap Management",
                description: "We'll build a roadmap that's ambitious but achievable, and help your team stay focused.",
              },
              {
                title: "Stakeholder Management",
                description: "We talk to your team, your customers, and your business stakeholders to make good decisions.",
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
            Looking for strategic product leadership?
          </h2>
          <p className="text-lg text-kaizen-text-light/80 mb-8 max-w-2xl mx-auto">
            Let's discuss your product challenges and how we can help.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
          >
            Start Conversation
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
