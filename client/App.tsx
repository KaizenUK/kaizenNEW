import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import WebDesign from "./pages/services/WebDesign";
import LocalSeo from "./pages/services/LocalSeo";
import DigitalTransformation from "./pages/services/DigitalTransformation";
import Ecommerce from "./pages/services/Ecommerce";
import ContractProductOwner from "./pages/ContractProductOwner";
import CaseStudies from "./pages/CaseStudies";
import Blog from "./pages/Blog";
import BlogDetail from "./pages/BlogDetail";
import Contact from "./pages/Contact";
import BlogAdmin from "./pages/BlogAdmin";
import Services from "./pages/Services";
import About from "./pages/About";
import AgileCoaching from "./pages/AgileCoaching";
import ProductOwner from "./pages/ProductOwner";
import TeamTransformation from "./pages/TeamTransformation";
import WebDesignLiverpool from "./pages/WebDesignLiverpool";
import WebDesignLiverpoolCityCentre from "./pages/WebDesignLiverpoolCityCentre";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import GDPRPolicy from "./pages/GDPRPolicy";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/web-design" element={<WebDesign />} />
          <Route path="/services/local-seo" element={<LocalSeo />} />
          <Route path="/services/digital-transformation" element={<DigitalTransformation />} />
          <Route path="/services/ecommerce" element={<Ecommerce />} />
          <Route path="/contract-product-owner" element={<ContractProductOwner />} />
          <Route path="/about" element={<About />} />
          <Route path="/agile-coaching" element={<AgileCoaching />} />
          <Route path="/product-owner" element={<ProductOwner />} />
          <Route path="/team-transformation" element={<TeamTransformation />} />
          <Route path="/web-design-liverpool" element={<WebDesignLiverpool />} />
          <Route path="/web-design-liverpool-city-centre" element={<WebDesignLiverpoolCityCentre />} />
          <Route path="/case-studies" element={<CaseStudies />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogDetail />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/gdpr-policy" element={<GDPRPolicy />} />
          <Route path="/admin" element={<BlogAdmin />} />
          <Route path="/dashboard" element={<BlogAdmin />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
