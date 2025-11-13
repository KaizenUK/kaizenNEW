import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export default function About() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-kaizen-dark text-kaizen-text-light py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 leading-tight">
              About Kaizen Web
            </h1>
            <p className="text-lg text-kaizen-text-light/80">
              We're a Liverpool-based web design and digital transformation studio. We work with businesses that want better websites, clearer digital thinking, and faster delivery.
            </p>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-8">Our Story</h2>
            
            <div className="space-y-6 text-kaizen-text-dark/80 leading-relaxed mb-12">
              <p>
                Kaizen Web started with a simple observation: most websites are built by people who don't understand business, and most businesses don't understand what makes websites actually work.
              </p>

              <p>
                We bridge that gap. Our team brings together web design, Agile delivery, and product thinking. We don't just build websites – we help you think differently about your digital products.
              </p>

              <p>
                We're based around the Baltic Triangle in Liverpool. We work with businesses across Merseyside, from small professional services firms to larger operations that need a fresh approach to digital.
              </p>
            </div>

            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-8">How We Work</h2>
            
            <div className="space-y-4 mb-12">
              {[
                "We ask questions first, sell solutions second. We need to understand your business before we propose anything.",
                "We use Agile methodology. That means regular feedback, small improvements, and shipping working software fast.",
                "We care about maintainability. Code we write today should be easy to update in three years' time.",
                "We focus on outcomes, not buzzwords. More enquiries, better visibility, simpler processes – that's success.",
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <CheckCircle2 className="text-kaizen-cyan flex-shrink-0 mt-1" size={20} />
                  <p className="text-kaizen-text-dark">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 md:py-32 bg-kaizen-light">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-12 text-center">Our Values</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                title: "Clarity",
                description: "We avoid jargon and explain things plainly. You should always know what we're doing and why.",
              },
              {
                title: "Pragmatism",
                description: "We use the right tool for the job. Sometimes that's a fancy framework, sometimes it's a simple static site.",
              },
              {
                title: "Accountability",
                description: "We deliver what we promise. You get regular updates, honest assessment, and high standards.",
              },
            ].map((value, idx) => (
              <div key={idx} className="text-center">
                <h3 className="text-xl font-heading font-bold mb-4">{value.title}</h3>
                <p className="text-kaizen-text-dark/70">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-32 bg-kaizen-dark text-kaizen-text-light">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Interested in working together?
          </h2>
          <p className="text-lg text-kaizen-text-light/80 mb-8 max-w-2xl mx-auto">
            Let's chat about your project. We're based in Liverpool and work with businesses across Merseyside.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
          >
            Get in Touch
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
