import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { useCalendly } from "@/context/CalendlyContext";

export default function TeamTransformation() {
  const { openCalendly: openCalendlyFromContext } = useCalendly();
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-kaizen-dark text-kaizen-text-light py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 leading-tight">
              Team Transformation
            </h1>

            <div className="space-y-4 mb-8 text-lg text-kaizen-text-light/80">
              <p>
                Your team might be stuck in old patterns. Waterfall processes, siloed departments, months between releases. We help you transform into an Agile, cross-functional team that ships regularly and adapts to change.
              </p>
              <p>
                This isn't about learning a methodology. It's about changing how your team actually works every day.
              </p>
            </div>

            <div className="space-y-3 mb-12">
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">From waterfall to Agile</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Break down silos</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Faster delivery cycles</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Better collaboration</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Approach */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-12">How We Transform Teams</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
            {[
              {
                title: "Assessment",
                description: "We understand your current situation, challenges, and what your team actually needs.",
              },
              {
                title: "Design",
                description: "We create a transformation plan tailored to your team's context, not a generic template.",
              },
              {
                title: "Implementation",
                description: "We work with your team through the transition, supporting change at every step.",
              },
              {
                title: "Sustainability",
                description: "We make sure improvements stick and become part of how your team works every day.",
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
            Ready to transform how your team works?
          </h2>
          <p className="text-lg text-kaizen-text-light/80 mb-8 max-w-2xl mx-auto">
            Let's chat about your team's current situation and what transformation could look like.
          </p>
          <button
            onClick={openCalendlyFromContext}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
          >
            Schedule Discovery Call
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </Layout>
  );
}
