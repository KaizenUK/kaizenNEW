import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-2xl">
          <h1 className="text-6xl md:text-7xl font-heading font-bold mb-6 text-kaizen-text-dark">
            404
          </h1>
          <p className="text-2xl font-heading font-bold mb-4 text-kaizen-text-dark">
            Page Not Found
          </p>
          <p className="text-lg text-kaizen-text-dark/70 mb-8">
            Sorry, the page you're looking for doesn't exist. Let's get you back on track.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-heading font-bold hover:opacity-90 transition"
          >
            Back to Home
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
