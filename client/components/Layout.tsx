import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-kaizen-light text-kaizen-text-dark">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-kaizen-light">
        <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="font-heading font-bold text-2xl flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-kaizen-cyan to-kaizen-lime rounded flex items-center justify-center">
              <span className="text-white font-heading font-bold text-sm">K</span>
            </div>
            <span className="hidden sm:inline">Kaizen Web</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-sm font-medium hover:text-kaizen-cyan transition">
              Home
            </Link>
            <div className="group relative">
              <button className="text-sm font-medium hover:text-kaizen-cyan transition">
                Services
              </button>
              <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition">
                <Link
                  to="/services/web-design"
                  className="block px-4 py-2 text-sm hover:bg-kaizen-light"
                >
                  Web Design
                </Link>
                <Link
                  to="/services/local-seo"
                  className="block px-4 py-2 text-sm hover:bg-kaizen-light"
                >
                  Local SEO
                </Link>
                <Link
                  to="/services/digital-transformation"
                  className="block px-4 py-2 text-sm hover:bg-kaizen-light"
                >
                  Digital Transformation
                </Link>
                <Link
                  to="/services/ecommerce"
                  className="block px-4 py-2 text-sm hover:bg-kaizen-light"
                >
                  E-commerce
                </Link>
                <Link
                  to="/contract-product-owner"
                  className="block px-4 py-2 text-sm hover:bg-kaizen-light"
                >
                  Contract Product Owner
                </Link>
              </div>
            </div>
            <Link to="/case-studies" className="text-sm font-medium hover:text-kaizen-cyan transition">
              Case Studies
            </Link>
            <Link to="/blog" className="text-sm font-medium hover:text-kaizen-cyan transition">
              Blog
            </Link>
            <Link
              to="/contact"
              className="px-6 py-2 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-white font-medium text-sm hover:opacity-90 transition"
            >
              Get a Quote
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-kaizen-light">
            <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
              <Link
                to="/"
                className="text-sm font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/services/web-design"
                className="text-sm font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Web Design
              </Link>
              <Link
                to="/services/local-seo"
                className="text-sm font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Local SEO
              </Link>
              <Link
                to="/services/digital-transformation"
                className="text-sm font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Digital Transformation
              </Link>
              <Link
                to="/services/ecommerce"
                className="text-sm font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                E-commerce
              </Link>
              <Link
                to="/contract-product-owner"
                className="text-sm font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contract Product Owner
              </Link>
              <Link
                to="/case-studies"
                className="text-sm font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Case Studies
              </Link>
              <Link
                to="/blog"
                className="text-sm font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Blog
              </Link>
              <Link
                to="/contact"
                className="px-6 py-2 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-white font-medium text-sm hover:opacity-90 transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get a Quote
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">{children}</main>

      {/* Footer */}
      <footer className="bg-kaizen-dark text-kaizen-text-light border-t border-kaizen-text-dark/10">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <h3 className="font-heading font-bold text-lg mb-4">Kaizen Web</h3>
              <p className="text-sm text-kaizen-text-light/80">
                Web design and digital transformation for Liverpool businesses.
              </p>
            </div>

            {/* Services */}
            <div>
              <h4 className="font-heading font-bold text-sm mb-4">Services</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/services/web-design" className="hover:text-kaizen-cyan transition">
                    Web Design
                  </Link>
                </li>
                <li>
                  <Link to="/services/local-seo" className="hover:text-kaizen-cyan transition">
                    Local SEO
                  </Link>
                </li>
                <li>
                  <Link to="/services/digital-transformation" className="hover:text-kaizen-cyan transition">
                    Digital Transformation
                  </Link>
                </li>
                <li>
                  <Link to="/services/ecommerce" className="hover:text-kaizen-cyan transition">
                    E-commerce
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-heading font-bold text-sm mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/case-studies" className="hover:text-kaizen-cyan transition">
                    Case Studies
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="hover:text-kaizen-cyan transition">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-kaizen-cyan transition">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-heading font-bold text-sm mb-4">Get in Touch</h4>
              <p className="text-sm text-kaizen-text-light/80 mb-2">
                Liverpool, UK
              </p>
              <Link
                to="/contact"
                className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-kaizen-dark font-medium text-sm hover:opacity-90 transition"
              >
                Request a Quote
              </Link>
            </div>
          </div>

          <div className="border-t border-kaizen-text-dark/10 pt-8">
            <p className="text-sm text-kaizen-text-light/60 text-center">
              © {new Date().getFullYear()} Kaizen Web. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
