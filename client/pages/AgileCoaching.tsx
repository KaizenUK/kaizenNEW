import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

export default function AgileCoaching() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-kaizen-dark text-kaizen-text-light py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 leading-tight">
              Agile Coaching
            </h1>

            <div className="space-y-4 mb-8 text-lg text-kaizen-text-light/80">
              <p>
                Your team knows how to build things. But do you know how to build them fast? Agile methodology helps you ship features quicker, get feedback sooner, and waste less time in meetings.
              </p>
              <p>
                We'll teach your team Agile practices that actually work. Not the buzzwords – the practices. Sprints, standups, retros, and continuous delivery.
              </p>
            </div>

            <div className="space-y-3 mb-12">
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Faster delivery cycles</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Better team communication</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Less waste, clearer priorities</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Respond to change faster</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What We Offer */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-12">What We Offer</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
            {[
              {
                title: "Team Training",
                description: "Hands-on workshops where your team learns Agile practices in a safe environment.",
              },
              {
                title: "Sprint Coaching",
                description: "We embed with your team during sprints to help them establish good habits.",
              },
              {
                title: "Process Review",
                description: "We audit your current process and recommend improvements based on what we see.",
              },
              {
                title: "Retrospectives",
                description: "We facilitate retros that lead to real change, not just talk.",
              },
            ].map((offer, idx) => (
              <div key={idx} className="p-8 bg-kaizen-light rounded-2xl border border-kaizen-light">
                <h3 className="text-lg font-heading font-bold mb-3">{offer.title}</h3>
                <p className="text-kaizen-text-dark/70">{offer.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-32 bg-kaizen-dark text-kaizen-text-light">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Ready to improve how your team delivers?
          </h2>
          <p className="text-lg text-kaizen-text-light/80 mb-8 max-w-2xl mx-auto">
            Let's talk about your team's challenges and how Agile coaching can help.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
          >
            Schedule a Chat
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
