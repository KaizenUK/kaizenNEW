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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/services/web-design" element={<WebDesign />} />
          <Route path="/services/local-seo" element={<LocalSeo />} />
          <Route path="/services/digital-transformation" element={<DigitalTransformation />} />
          <Route path="/services/ecommerce" element={<Ecommerce />} />
          <Route path="/contract-product-owner" element={<ContractProductOwner />} />
          <Route path="/case-studies" element={<CaseStudies />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogDetail />} />
          <Route path="/contact" element={<Contact />} />
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
