import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

export default function WebDesignLiverpoolCityCentre() {
  return (
    <Layout>
      {/* Hero */}
      <section className="bg-kaizen-dark text-kaizen-text-light py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 leading-tight">
              Web Design Liverpool City Centre
            </h1>

            <div className="space-y-4 mb-8 text-lg text-kaizen-text-light/80">
              <p>
                If your business is in L1, L2, L3, or the Baltic Triangle, you need a website that works as hard as you do. We build modern websites for city centre businesses that need to stand out online.
              </p>
              <p>
                You're in a competitive market. Your website needs to be clear, fast, and easy for people to use – whether they're at their desk or on the street.
              </p>
            </div>

            <div className="space-y-3 mb-12">
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Prominent opening hours and location</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Mobile-first design (people visit from their phones)</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Easy booking or contact calls-to-action</span>
              </div>
              <div className="flex gap-3 items-start">
                <Check className="text-kaizen-lime flex-shrink-0 mt-1" size={20} />
                <span className="text-lg">Directions and walk-in visitor info</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* City Centre Specific */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-8">City Centre Websites Are Different</h2>
          
          <div className="max-w-3xl mx-auto space-y-6 mb-12">
            <p className="text-lg text-kaizen-text-dark/80">
              City centre businesses compete differently. Your customers might be tourists, office workers on lunch, or people walking past. They need quick information: hours, location, what you offer, how to get there.
            </p>

            <div className="space-y-4">
              {[
                {
                  title: "Opening Hours Matter",
                  desc: "People check your hours before they visit. Make it obvious.",
                },
                {
                  title: "Mobile Is Essential",
                  desc: "Half your visitors are on their phones. Your site must work perfectly on mobile.",
                },
                {
                  title: "Location & Directions",
                  desc: "Make it easy to find you. Include a map and clear directions.",
                },
                {
                  title: "Quick Calls to Action",
                  desc: "Book a table, call you, email you – make it easy to take the next step.",
                },
              ].map((item, idx) => (
                <div key={idx} className="border-l-4 border-kaizen-cyan pl-6 py-2">
                  <h3 className="font-heading font-bold mb-2">{item.title}</h3>
                  <p className="text-kaizen-text-dark/70">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-kaizen-light rounded-2xl p-8 border border-kaizen-light">
            <h3 className="text-2xl font-heading font-bold mb-4">Perfect For:</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                "Restaurants & cafes",
                "Offices & professional services",
                "Retail & boutiques",
                "Coworking spaces",
                "Hotels & accommodation",
                "Gyms & fitness studios",
                "Hair & beauty salons",
                "Event venues",
              ].map((item, idx) => (
                <li key={idx} className="flex gap-3 items-start">
                  <Check className="text-kaizen-cyan flex-shrink-0 mt-1" size={20} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-32 bg-kaizen-dark text-kaizen-text-light">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            City Centre Business? Let's Talk Website Design
          </h2>
          <p className="text-lg text-kaizen-text-light/80 mb-8 max-w-2xl mx-auto">
            We know the city centre. We know how people find you. Let's build a website that works for your business.
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
