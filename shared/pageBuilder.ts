export interface ManagedSeo {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  shareImage?: ManagedImageValue;
}

export interface ManagedPortableTextSpan {
  _type?: string;
  text?: string;
}

export interface ManagedPortableTextBlock {
  _type: string;
  _key?: string;
  style?: string;
  children?: ManagedPortableTextSpan[];
  markDefs?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface ManagedImageAsset {
  _id?: string;
  url?: string;
}

export interface ManagedImageValue {
  _key?: string;
  _type?: string;
  alt?: string;
  caption?: string;
  asset?: ManagedImageAsset & { _ref?: string; _type?: "reference" };
  [key: string]: unknown;
}

export interface ManagedColorValue {
  hex?: string;
  alpha?: number;
  hsl?: { h?: number; s?: number; l?: number; a?: number };
  rgb?: { r?: number; g?: number; b?: number; a?: number };
}

export interface ManagedSectionSettings {
  anchorId?: string;
  backgroundColor?: string;
  customBackgroundColor?: ManagedColorValue;
  backgroundImage?: ManagedImageValue;
  backgroundOverlay?: string;
  fontFamily?: string;
  paddingTop?: string;
  paddingBottom?: string;
  containerWidth?: string;
  textAlign?: string;
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
}

export interface ManagedCallToAction {
  _type?: "callToAction";
  _key?: string;
  label?: string;
  href?: string;
  style?: "primary" | "ghost" | string;
  newTab?: boolean;
}

export interface ManagedHeroSection {
  _type: "hero";
  _key?: string;
  title?: string;
  subtitle?: string;
  image?: ManagedImageValue;
  buttonLink?: ManagedCallToAction;
  settings?: ManagedSectionSettings;
}

export interface ManagedRichTextSection {
  _type: "richTextSection";
  _key?: string;
  heading?: string;
  body?: ManagedPortableTextBlock[];
  settings?: ManagedSectionSettings;
}

export interface ManagedFeatureItem {
  _key?: string;
  _type?: "featureItem";
  title?: string;
  text?: string;
}

export interface ManagedFeaturesSection {
  _type: "features";
  _key?: string;
  heading?: string;
  items?: ManagedFeatureItem[];
  settings?: ManagedSectionSettings;
}

export interface ManagedCtaSection {
  _type: "ctaSection";
  _key?: string;
  text?: string;
  buttonLink?: ManagedCallToAction;
  settings?: ManagedSectionSettings;
}

export interface ManagedTestimonialsSection {
  _type: "testimonials";
  _key?: string;
  heading?: string;
  items?: Array<{
    _key?: string;
    _type?: "testimonialItem";
    quote?: string;
    name?: string;
    role?: string;
    company?: string;
    image?: ManagedImageValue;
  }>;
  settings?: ManagedSectionSettings;
}

export interface ManagedFaqSection {
  _type: "faqSection";
  _key?: string;
  heading?: string;
  items?: Array<{
    _key?: string;
    _type?: "faqItem";
    question?: string;
    answer?: string;
  }>;
  settings?: ManagedSectionSettings;
}

export interface ManagedStatsSection {
  _type: "statsSection";
  _key?: string;
  heading?: string;
  items?: Array<{
    _key?: string;
    _type?: "statItem";
    value?: string;
    label?: string;
  }>;
  settings?: ManagedSectionSettings;
}

export interface ManagedImageGallerySection {
  _type: "imageGallery";
  _key?: string;
  heading?: string;
  images?: ManagedImageValue[];
  settings?: ManagedSectionSettings;
}

export interface ManagedVideoSection {
  _type: "videoEmbed";
  _key?: string;
  url?: string;
  caption?: string;
  settings?: ManagedSectionSettings;
}

export interface ManagedPricingTier {
  _key?: string;
  _type?: "pricingTier";
  name?: string;
  price?: string;
  description?: string;
  features?: string[];
  buttonLink?: ManagedCallToAction;
  isHighlighted?: boolean;
}

export interface ManagedPricingSection {
  _type: "pricingSection";
  _key?: string;
  heading?: string;
  subtitle?: string;
  tiers?: ManagedPricingTier[];
  settings?: ManagedSectionSettings;
}

export interface ManagedLogoBarItem {
  _key?: string;
  _type?: "logoBarItem";
  imageUrl?: string;
  alt?: string;
  href?: string;
}

export interface ManagedLogoBarSection {
  _type: "logoBar";
  _key?: string;
  heading?: string;
  logos?: ManagedLogoBarItem[];
  settings?: ManagedSectionSettings;
}

export interface ManagedTeamMember {
  _key?: string;
  _type?: "teamGridMember";
  name?: string;
  role?: string;
  imageUrl?: string;
  bio?: string;
  linkedin?: string;
}

export interface ManagedTeamGridSection {
  _type: "teamGrid";
  _key?: string;
  heading?: string;
  subtitle?: string;
  members?: ManagedTeamMember[];
  settings?: ManagedSectionSettings;
}

export interface ManagedFormField {
  _key?: string;
  _type?: "formField";
  label?: string;
  fieldType?: "text" | "email" | "tel" | "textarea" | "select";
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface ManagedContactFormSection {
  _type: "contactForm";
  _key?: string;
  heading?: string;
  subtitle?: string;
  fields?: ManagedFormField[];
  submitLabel?: string;
  successMessage?: string;
  actionUrl?: string;
  settings?: ManagedSectionSettings;
}

export interface ManagedSpacerSection {
  _type: "spacer";
  _key?: string;
  height?: "sm" | "md" | "lg" | "xl";
  showLine?: boolean;
  settings?: ManagedSectionSettings;
}

/** Content types that can appear inside layout columns (everything except layoutRow). */
export type ManagedColumnSection =
  | ManagedHeroSection
  | ManagedRichTextSection
  | ManagedFeaturesSection
  | ManagedCtaSection
  | ManagedTestimonialsSection
  | ManagedFaqSection
  | ManagedStatsSection
  | ManagedImageGallerySection
  | ManagedVideoSection
  | ManagedPricingSection
  | ManagedLogoBarSection
  | ManagedTeamGridSection
  | ManagedContactFormSection
  | ManagedSpacerSection;

export interface ManagedLayoutColumn {
  _key?: string;
  _type?: "layoutColumn";
  content?: ManagedColumnSection[];
  verticalAlign?: "top" | "center" | "bottom";
}

export interface ManagedLayoutRowSection {
  _type: "layoutRow";
  _key?: string;
  layout?: "50-50" | "33-33-33" | "70-30" | "30-70" | "25-50-25" | "25-25-25-25";
  columns?: ManagedLayoutColumn[];
  settings?: ManagedSectionSettings;
}

export type ManagedPageSection =
  | ManagedColumnSection
  | ManagedLayoutRowSection;

export interface ManagedPageData {
  _id: string;
  _type?: "page";
  title?: string;
  slug?: string;
  routePath?: string;
  replaceRouteContent?: boolean;
  seo?: ManagedSeo;
  content?: ManagedPageSection[];
}

export function normalizeRoutePath(input: string | null | undefined): string {
  const raw = String(input ?? "").trim();
  if (!raw || raw === "/") return "/";
  const cleaned = raw.replace(/^\/+/, "").replace(/\/+$/, "");
  return cleaned ? `/${cleaned}` : "/";
}
