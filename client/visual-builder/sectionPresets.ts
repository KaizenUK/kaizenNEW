import { block } from "./starters";
import type { Block, BlockType, StyleValues } from "../../shared/visualBuilder";

const copy = (text: string, size = 18, tag = "p") =>
  block("Text", {
    text,
    tag,
    style: {
      desktop: { fontSize: size, lineHeight: tag === "p" ? 1.6 : 1.12 },
      mobile: { fontSize: Math.min(size, 36) },
    },
  });
const link = (text: string, href = "/contact/") =>
  block("Button", { text, href });
const group = (children: Block[], style: StyleValues = {}) =>
  block("Container", {
    children,
    style: {
      desktop: { gap: 20, ...style },
      mobile: { padding: 20, columnSpan: 1 },
    },
  });
const photo = (alt = "Abstract green landscape") =>
  block("Image", {
    src: "/builder-samples/landscape.svg",
    alt,
    style: {
      desktop: { height: 340, objectFit: "cover", radius: 20 },
      mobile: { height: 240 },
    },
  });
const section = (type: BlockType, children: Block[], style: StyleValues = {}) =>
  block(type, {
    children,
    style: {
      desktop: { padding: 64, gap: 28, ...style },
      tablet: { padding: 36 },
      mobile: { padding: 24, columns: 1 },
    },
  });

export type SectionPreset = {
  id: string;
  name: string;
  category: string;
  description: string;
  create: () => Block;
};
export const sectionPresets: SectionPreset[] = [
  {
    id: "studio-navigation",
    name: "Studio navigation",
    category: "Navigation",
    description: "A dark header with a working mobile menu.",
    create: () =>
      block("Menu", {
        text: "STUDIO NORTH",
        href: "/",
        label: "Main navigation",
        links: [
          { label: "Our work", href: "/case-studies/" },
          { label: "About", href: "/about/" },
          { label: "Let’s talk", href: "/contact/" },
        ],
        style: {
          desktop: { padding: 28, background: "#182421", color: "#ffffff" },
          mobile: { padding: 20 },
        },
      }),
  },
  {
    id: "editorial-hero",
    name: "Editorial hero",
    category: "Heroes",
    description: "An oversized introduction with a full-width image below.",
    create: () =>
      section(
        "Section",
        [
          group(
            [
              copy("INDEPENDENT THINKING. CONSIDERED DESIGN.", 12),
              copy("Good things\nstart with a conversation.", 76, "h1"),
              copy(
                "We help ambitious teams turn clear ideas into thoughtful digital experiences.",
              ),
              link("Explore our work", "/case-studies/"),
            ],
            { maxWidth: 860, padding: 16 },
          ),
          photo(),
        ],
        { background: "#f0eee7" },
      ),
  },
  {
    id: "feature-editorial",
    name: "Services overview",
    category: "Features",
    description: "A strong introduction beside three numbered services.",
    create: () =>
      section(
        "Features",
        [
          group([
            copy("WHAT WE DO", 12),
            copy("From first idea\nto what’s next.", 48, "h2"),
            copy(
              "Bring the challenge. We’ll bring curiosity, care and a practical way forward.",
            ),
          ]),
          group([
            ...[
              "Find your direction",
              "Design the experience",
              "Build for the future",
            ].map((title, index) =>
              group(
                [
                  copy(`0${index + 1}`, 13),
                  copy(title, 28, "h3"),
                  copy(
                    "A focused collaboration, shaped around your team and the people you serve.",
                  ),
                ],
                {
                  padding: 24,
                  borderWidth: 1,
                  borderColor: "#d5d9d1",
                  radius: 12,
                },
              ),
            ),
          ]),
        ],
        { columns: 2, columnWidths: "1 1.3" },
      ),
  },
  {
    id: "project-gallery",
    name: "Project gallery",
    category: "Galleries",
    description: "Two large project cards with editable images and captions.",
    create: () =>
      section(
        "Gallery",
        ["A fresh perspective", "Room to grow"].map((title, i) =>
          group(
            [
              photo(),
              copy(`SELECTED WORK / 0${i + 1}`, 12),
              copy(title, 32, "h2"),
              copy("Replace this sample with your project story."),
              link("View project", "/case-studies/"),
            ],
            { background: "#ffffff", padding: 24, radius: 20 },
          ),
        ),
        { columns: 2, background: "#e9eddf" },
      ),
  },
  {
    id: "testimonial-pair",
    name: "Customer stories",
    category: "Testimonials",
    description:
      "Two contrasting quote cards. Replace the sample quotes before publishing.",
    create: () =>
      section(
        "Testimonials",
        [
          group(
            [
              copy("SAMPLE CUSTOMER QUOTE", 12),
              copy(
                "“A thoughtful team who made the whole process feel simple.”",
                32,
                "blockquote",
              ),
              copy("Customer name · Company", 14),
            ],
            {
              padding: 36,
              radius: 20,
              background: "#182421",
              color: "#ffffff",
            },
          ),
          group(
            [
              copy("SAMPLE CUSTOMER QUOTE", 12),
              copy(
                "“We finally have a website that feels like us.”",
                32,
                "blockquote",
              ),
              copy("Customer name · Company", 14),
            ],
            { padding: 36, radius: 20, background: "#e9eddf" },
          ),
        ],
        { columns: 2 },
      ),
  },
  {
    id: "pricing-comparison",
    name: "Simple pricing",
    category: "Pricing",
    description: "Two service tiers with clear inclusions and calls to action.",
    create: () =>
      section(
        "Pricing",
        ["Essentials", "Partnership"].map((name, index) =>
          group(
            [
              copy(index ? "FOR WHAT COMES NEXT" : "A CONFIDENT BEGINNING", 12),
              copy(name, 36, "h2"),
              copy(index ? "Let’s shape it together" : "Your price here", 24),
              copy(
                index
                  ? "Ongoing design and development, with room to adapt as your business grows."
                  : "A focused project with a clear scope, timeline and dedicated point of contact.",
              ),
              block("RichText", {
                html: "<ul><li>Discovery and planning</li><li>Responsive design</li><li>Launch support</li></ul>",
              }),
              link(index ? "Discuss a partnership" : "Ask for a proposal"),
            ],
            {
              padding: 36,
              radius: 20,
              background: index ? "#e9eddf" : "#ffffff",
              borderWidth: 1,
              borderColor: "#d5d9d1",
            },
          ),
        ),
        { columns: 2 },
      ),
  },
  {
    id: "contact-banner",
    name: "Contact banner",
    category: "Calls to action",
    description: "A compact invitation with an aligned action button.",
    create: () =>
      section(
        "CallToAction",
        [
          group([
            copy("HAVE SOMETHING IN MIND?", 12),
            copy("Let’s make it happen.", 48, "h2"),
          ]),
          group([link("Start a conversation")], {
            justifyItems: "end",
            alignItems: "center",
          }),
        ],
        {
          columns: 2,
          columnWidths: "2 1",
          background: "#e9eddf",
          alignItems: "center",
        },
      ),
  },
  {
    id: "studio-footer",
    name: "Studio footer",
    category: "Footers",
    description: "A spacious dark footer with contact and navigation columns.",
    create: () =>
      section(
        "Footer",
        [
          group([
            copy("STUDIO NORTH", 28, "h2"),
            copy("Thoughtful work.\nLasting relationships.", 18),
          ]),
          group([
            copy("EXPLORE", 12),
            link("Our work", "/case-studies/"),
            link("About us", "/about/"),
          ]),
          group([
            copy("SAY HELLO", 12),
            link("Get in touch"),
            link("Privacy", "/privacy-policy/"),
          ]),
        ],
        {
          columns: 3,
          columnWidths: "2 1 1",
          background: "#182421",
          color: "#ffffff",
        },
      ),
  },
];
