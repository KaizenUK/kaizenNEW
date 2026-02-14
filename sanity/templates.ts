import type { Template } from "sanity";
import {
  LayoutTemplate,
  FileText,
  DollarSign,
  Users,
  Phone,
} from "lucide-react";

function key(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const pageTemplates: Template[] = [
  {
    id: "page-landing",
    title: "Landing Page",
    description: "Hero, features, testimonials, and CTA",
    schemaType: "page",
    icon: LayoutTemplate,
    value: {

      content: [
        {
          _type: "hero",
          _key: key(),
          title: "Your Headline Here",
          subtitle: "A compelling subtitle that explains your value proposition.",
        },
        {
          _type: "features",
          _key: key(),
          heading: "Why Choose Us",
          items: [
            {
              _type: "featureItem",
              _key: key(),
              title: "Fast & Reliable",
              text: "Describe the first benefit of your product or service.",
            },
            {
              _type: "featureItem",
              _key: key(),
              title: "Easy to Use",
              text: "Describe the second benefit of your product or service.",
            },
            {
              _type: "featureItem",
              _key: key(),
              title: "Great Support",
              text: "Describe the third benefit of your product or service.",
            },
          ],
        },
        {
          _type: "testimonials",
          _key: key(),
          heading: "What Our Clients Say",
          items: [
            {
              _type: "testimonialItem",
              _key: key(),
              quote: "This is a placeholder testimonial. Replace with a real client quote.",
              name: "Client Name",
              role: "Role",
              company: "Company",
            },
            {
              _type: "testimonialItem",
              _key: key(),
              quote: "Another placeholder testimonial. Replace with a real client quote.",
              name: "Client Name",
              role: "Role",
              company: "Company",
            },
          ],
        },
        {
          _type: "ctaSection",
          _key: key(),
          text: "Ready to get started?",
          buttonLink: {
            _type: "callToAction",
            label: "Contact Us",
            href: "/contact",
            style: "primary",
          },
        },
      ],
    },
  },
  {
    id: "page-about",
    title: "About Page",
    description: "Rich text intro, team grid, and stats",
    schemaType: "page",
    icon: FileText,
    value: {

      content: [
        {
          _type: "hero",
          _key: key(),
          title: "About Us",
          subtitle: "Learn more about who we are and what drives us.",
        },
        {
          _type: "richTextSection",
          _key: key(),
          heading: "Our Story",
        },
        {
          _type: "statsSection",
          _key: key(),
          heading: "By the Numbers",
          items: [
            { _type: "statItem", _key: key(), value: "10+", label: "Years Experience" },
            { _type: "statItem", _key: key(), value: "200+", label: "Projects Delivered" },
            { _type: "statItem", _key: key(), value: "50+", label: "Happy Clients" },
          ],
        },
        {
          _type: "teamGrid",
          _key: key(),
          heading: "Meet the Team",
          subtitle: "The people behind the work.",
        },
      ],
    },
  },
  {
    id: "page-pricing",
    title: "Pricing Page",
    description: "Pricing tiers, FAQ, and CTA",
    schemaType: "page",
    icon: DollarSign,
    value: {

      content: [
        {
          _type: "hero",
          _key: key(),
          title: "Simple, Transparent Pricing",
          subtitle: "Choose the plan that works best for you.",
        },
        {
          _type: "pricingSection",
          _key: key(),
          heading: "Our Plans",
          tiers: [
            {
              _type: "pricingTier",
              _key: key(),
              name: "Starter",
              price: "£499",
              description: "Perfect for small businesses getting started.",
              features: ["Feature one", "Feature two", "Feature three"],
            },
            {
              _type: "pricingTier",
              _key: key(),
              name: "Professional",
              price: "£999",
              description: "For growing businesses that need more.",
              features: ["Everything in Starter", "Feature four", "Feature five", "Feature six"],
              isHighlighted: true,
            },
            {
              _type: "pricingTier",
              _key: key(),
              name: "Enterprise",
              price: "Custom",
              description: "Tailored solutions for large organisations.",
              features: ["Everything in Professional", "Feature seven", "Feature eight", "Priority support"],
            },
          ],
        },
        {
          _type: "faqSection",
          _key: key(),
          heading: "Frequently Asked Questions",
          items: [
            {
              _type: "faqItem",
              _key: key(),
              question: "What's included in each plan?",
              answer: "Replace this with your actual answer.",
            },
            {
              _type: "faqItem",
              _key: key(),
              question: "Can I upgrade or downgrade later?",
              answer: "Replace this with your actual answer.",
            },
          ],
        },
        {
          _type: "ctaSection",
          _key: key(),
          text: "Not sure which plan is right for you?",
          buttonLink: {
            _type: "callToAction",
            label: "Get in Touch",
            href: "/contact",
            style: "primary",
          },
        },
      ],
    },
  },
  {
    id: "page-service",
    title: "Service Page",
    description: "Hero, features, logo bar, testimonials, and contact form",
    schemaType: "page",
    icon: Users,
    value: {

      content: [
        {
          _type: "hero",
          _key: key(),
          title: "Service Name",
          subtitle: "A brief description of what this service offers.",
        },
        {
          _type: "features",
          _key: key(),
          heading: "What's Included",
          items: [
            { _type: "featureItem", _key: key(), title: "Deliverable One", text: "Describe what the client gets." },
            { _type: "featureItem", _key: key(), title: "Deliverable Two", text: "Describe what the client gets." },
            { _type: "featureItem", _key: key(), title: "Deliverable Three", text: "Describe what the client gets." },
          ],
        },
        {
          _type: "logoBar",
          _key: key(),
          heading: "Trusted By",
        },
        {
          _type: "testimonials",
          _key: key(),
          heading: "Client Results",
          items: [
            {
              _type: "testimonialItem",
              _key: key(),
              quote: "Replace with a real client testimonial about this service.",
              name: "Client Name",
              role: "Role",
              company: "Company",
            },
          ],
        },
        {
          _type: "ctaSection",
          _key: key(),
          text: "Ready to discuss your project?",
          buttonLink: {
            _type: "callToAction",
            label: "Get a Quote",
            href: "/contact",
            style: "primary",
          },
        },
      ],
    },
  },
  {
    id: "page-contact",
    title: "Contact Page",
    description: "Hero with contact form",
    schemaType: "page",
    icon: Phone,
    value: {

      content: [
        {
          _type: "hero",
          _key: key(),
          title: "Get in Touch",
          subtitle: "We'd love to hear from you. Fill out the form below or reach out directly.",
        },
        {
          _type: "contactForm",
          _key: key(),
          heading: "Send Us a Message",
          submitLabel: "Send Message",
          successMessage: "Thanks for reaching out! We'll get back to you shortly.",
          fields: [
            { _type: "formField", _key: key(), label: "Name", fieldType: "text", required: true },
            { _type: "formField", _key: key(), label: "Email", fieldType: "email", required: true },
            { _type: "formField", _key: key(), label: "Phone", fieldType: "tel", required: false },
            { _type: "formField", _key: key(), label: "Message", fieldType: "textarea", required: true },
          ],
        },
      ],
    },
  },
];
