import { Link } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-kaizen-light text-kaizen-text-dark">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-kaizen-light">
        <nav className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition flex-shrink-0">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F19f6366118ef41298050443945090b5f?format=webp&width=800"
              alt="Kaizen Web"
              className="h-20 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className="px-3 py-2 text-sm font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50"
            >
              Home
            </Link>

            {/* Services Mega Menu */}
            <div
              className="relative"
              onMouseEnter={() => setServicesOpen(true)}
              onMouseLeave={() => setServicesOpen(false)}
            >
              <button className="px-3 py-2 text-sm font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50 flex items-center gap-1">
                Services
                <ChevronDown size={16} className={`transition ${servicesOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Mega Menu Panel */}
              {servicesOpen && (
                <div className="absolute left-0 top-full mt-0 w-screen bg-white border-t border-kaizen-light shadow-lg">
                  <div className="container mx-auto px-4 py-8">
                    <div className="grid grid-cols-3 gap-8">
                      {/* Web Services */}
                      <div>
                        <p className="text-xs font-mono text-kaizen-text-dark/50 font-bold mb-4 tracking-widest">WEB & DESIGN</p>

                        <div className="mb-6">
                          <Link
                            to="/services/web-design"
                            className="block font-heading font-bold text-sm mb-2 hover:text-kaizen-cyan transition"
                          >
                            Web Design
                          </Link>
                          <ul className="space-y-1 text-xs text-kaizen-text-dark/70 ml-0">
                            <li>Fast, modern websites</li>
                            <li>Mobile-first design</li>
                            <li>SEO-ready structure</li>
                          </ul>
                        </div>

                        <div>
                          <Link
                            to="/services/local-seo"
                            className="block font-heading font-bold text-sm mb-2 hover:text-kaizen-cyan transition"
                          >
                            Local SEO
                          </Link>
                          <ul className="space-y-1 text-xs text-kaizen-text-dark/70">
                            <li>Google Business Profile</li>
                            <li>Local search ranking</li>
                            <li>Review strategy</li>
                          </ul>
                        </div>
                      </div>

                      {/* E-commerce & Transformation */}
                      <div>
                        <p className="text-xs font-mono text-kaizen-text-dark/50 font-bold mb-4 tracking-widest">OPERATIONS</p>

                        <div className="mb-6">
                          <Link
                            to="/services/ecommerce"
                            className="block font-heading font-bold text-sm mb-2 hover:text-kaizen-cyan transition"
                          >
                            E-commerce
                          </Link>
                          <ul className="space-y-1 text-xs text-kaizen-text-dark/70">
                            <li>Online stores</li>
                            <li>Payment integration</li>
                            <li>Conversion optimized</li>
                          </ul>
                        </div>

                        <div>
                          <Link
                            to="/services/digital-transformation"
                            className="block font-heading font-bold text-sm mb-2 hover:text-kaizen-cyan transition"
                          >
                            Digital Transformation
                          </Link>
                          <ul className="space-y-1 text-xs text-kaizen-text-dark/70">
                            <li>Workflow automation</li>
                            <li>Process optimization</li>
                            <li>Back-office systems</li>
                          </ul>
                        </div>
                      </div>

                      {/* Team & Product */}
                      <div>
                        <p className="text-xs font-mono text-kaizen-text-dark/50 font-bold mb-4 tracking-widest">TEAMS & PRODUCT</p>

                        <div className="mb-6">
                          <Link
                            to="/agile-coaching"
                            className="block font-heading font-bold text-sm mb-2 hover:text-kaizen-cyan transition"
                          >
                            Agile Coaching
                          </Link>
                          <ul className="space-y-1 text-xs text-kaizen-text-dark/70">
                            <li>Team training</li>
                            <li>Sprint coaching</li>
                            <li>Process review</li>
                          </ul>
                        </div>

                        <div>
                          <Link
                            to="/product-owner"
                            className="block font-heading font-bold text-sm mb-2 hover:text-kaizen-cyan transition"
                          >
                            Product Owner
                          </Link>
                          <ul className="space-y-1 text-xs text-kaizen-text-dark/70">
                            <li>Strategic roadmap</li>
                            <li>Hands-on leadership</li>
                            <li>No full-time hire</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link
              to="/case-studies"
              className="px-3 py-2 text-sm font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50"
            >
              Case Studies
            </Link>

            <Link
              to="/blog"
              className="px-3 py-2 text-sm font-heading font-medium hover:text-kaizen-cyan transition rounded-md hover:bg-kaizen-light/50"
            >
              Blog
            </Link>
          </div>

          {/* CTA and Mobile Button */}
          <div className="flex items-center gap-4">
            <Link
              to="/contact"
              className="hidden sm:inline-block px-6 py-2 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-white font-heading font-medium text-sm hover:opacity-90 transition"
            >
              Get a Quote
            </Link>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-kaizen-light">
            <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
              <Link
                to="/"
                className="text-sm font-heading font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <button
                onClick={() => setServicesOpen(!servicesOpen)}
                className="text-left text-sm font-heading font-medium hover:text-kaizen-cyan transition flex items-center gap-2"
              >
                Services
                <ChevronDown
                  size={16}
                  className={`transition ${servicesOpen ? "rotate-180" : ""}`}
                />
              </button>
              {servicesOpen && (
                <div className="ml-4 space-y-2 border-l border-kaizen-light pl-4">
                  <Link
                    to="/services/web-design"
                    className="block text-sm text-kaizen-text-dark/70 hover:text-kaizen-cyan transition"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setServicesOpen(false);
                    }}
                  >
                    Web Design
                  </Link>
                  <Link
                    to="/services/local-seo"
                    className="block text-sm text-kaizen-text-dark/70 hover:text-kaizen-cyan transition"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setServicesOpen(false);
                    }}
                  >
                    Local SEO
                  </Link>
                  <Link
                    to="/services/ecommerce"
                    className="block text-sm text-kaizen-text-dark/70 hover:text-kaizen-cyan transition"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setServicesOpen(false);
                    }}
                  >
                    E-commerce
                  </Link>
                  <Link
                    to="/services/digital-transformation"
                    className="block text-sm text-kaizen-text-dark/70 hover:text-kaizen-cyan transition"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setServicesOpen(false);
                    }}
                  >
                    Digital Transformation
                  </Link>
                  <Link
                    to="/agile-coaching"
                    className="block text-sm text-kaizen-text-dark/70 hover:text-kaizen-cyan transition"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setServicesOpen(false);
                    }}
                  >
                    Agile Coaching
                  </Link>
                  <Link
                    to="/product-owner"
                    className="block text-sm text-kaizen-text-dark/70 hover:text-kaizen-cyan transition"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setServicesOpen(false);
                    }}
                  >
                    Product Owner
                  </Link>
                </div>
              )}
              <Link
                to="/about"
                className="text-sm font-heading font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                to="/case-studies"
                className="text-sm font-heading font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Case Studies
              </Link>
              <Link
                to="/blog"
                className="text-sm font-heading font-medium hover:text-kaizen-cyan transition"
                onClick={() => setMobileMenuOpen(false)}
              >
                Blog
              </Link>
              <Link
                to="/contact"
                className="px-6 py-2 rounded-full bg-gradient-to-r from-kaizen-cyan to-kaizen-lime text-white font-heading font-medium text-sm hover:opacity-90 transition w-full text-center"
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-8">
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
                  <Link to="/services" className="hover:text-kaizen-cyan transition">
                    All Services
                  </Link>
                </li>
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
                  <Link to="/agile-coaching" className="hover:text-kaizen-cyan transition">
                    Agile Coaching
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-heading font-bold text-sm mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/about" className="hover:text-kaizen-cyan transition">
                    About
                  </Link>
                </li>
                <li>
                  <Link to="/case-studies" className="hover:text-kaizen-cyan transition">
                    Case Studies
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="hover:text-kaizen-cyan transition">
                    Journal
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-kaizen-cyan transition">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-heading font-bold text-sm mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/privacy-policy" className="hover:text-kaizen-cyan transition">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/gdpr-policy" className="hover:text-kaizen-cyan transition">
                    GDPR Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-heading font-bold text-sm mb-4">Get in Touch</h4>
              <p className="text-sm text-kaizen-text-light/80 mb-2">Liverpool, UK</p>
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
