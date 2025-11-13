import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Code2, TrendingUp, Zap, Users, Briefcase } from "lucide-react";

export default function Services() {
  const services = [
    {
      icon: Code2,
      title: "Web Design Liverpool",
      description: "Fast, modern websites that generate leads and help your business grow online.",
      link: "/services/web-design",
    },
    {
      icon: TrendingUp,
      title: "Local SEO",
      description: "Help local customers find you through search. Optimize your Google Business Profile and local visibility.",
      link: "/services/local-seo",
    },
    {
      icon: Zap,
      title: "E-commerce Development",
      description: "Sell online with a store that's easy to manage and optimized to convert.",
      link: "/services/ecommerce",
    },
    {
      icon: Briefcase,
      title: "Digital Transformation",
      description: "Join up your website with back-office processes. Automate workflows, improve systems.",
      link: "/services/digital-transformation",
    },
    {
      icon: Users,
      title: "Agile Coaching",
      description: "Help your team adopt Agile methodology. Improve delivery, reduce waste, ship faster.",
      link: "/agile-coaching",
    },
    {
      icon: Briefcase,
      title: "Product Owner Services",
      description: "Contract product ownership without the full-time hire. Strategic guidance and hands-on delivery.",
      link: "/product-owner",
    },
  ];

  return (
    <Layout>
      {/* Hero */}
      <section className="bg-kaizen-dark text-kaizen-text-light py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-6 leading-tight">
              Our Services
            </h1>
            <p className="text-lg text-kaizen-text-light/80 mb-8">
              We help Liverpool businesses build better digital products. From web design to Agile coaching, we bring clarity and expertise to every project.
            </p>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 md:py-32 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, idx) => {
              const Icon = service.icon;
              return (
                <Link
                  key={idx}
                  to={service.link}
                  className="group p-8 bg-kaizen-light rounded-2xl border border-kaizen-light hover:border-kaizen-cyan hover:shadow-lg transition"
                >
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-kaizen-cyan to-kaizen-lime flex items-center justify-center mb-6 group-hover:scale-110 transition">
                    <Icon className="text-white" size={24} />
                  </div>
                  <h3 className="text-xl font-heading font-bold mb-4 group-hover:text-kaizen-cyan transition">
                    {service.title}
                  </h3>
                  <p className="text-kaizen-text-dark/70 mb-6">{service.description}</p>
                  <div className="flex items-center gap-2 text-kaizen-cyan font-medium text-sm">
                    Learn More <ArrowRight size={16} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-32 bg-kaizen-dark text-kaizen-text-light">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            Not sure which service you need?
          </h2>
          <p className="text-lg text-kaizen-text-light/80 mb-8 max-w-2xl mx-auto">
            Let's chat. We'll assess your project and recommend the right approach.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
          >
            Start a Conversation
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
