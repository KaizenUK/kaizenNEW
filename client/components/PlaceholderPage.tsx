import Layout from "./Layout";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, description }) => {
  return (
    <Layout>
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-6">{title}</h1>
          <p className="text-lg text-kaizen-text-dark/70 mb-8">
            {description || "This page is being developed. Check back soon for more information about this service."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
            >
              Back to Home
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-kaizen-light border border-kaizen-text-dark/10 text-kaizen-text-dark font-heading font-bold hover:border-kaizen-cyan transition"
            >
              Get in Touch
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PlaceholderPage;
