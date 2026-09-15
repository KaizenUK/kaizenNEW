import {
  defaultTheme,
  freshBlocks,
  newId,
  normalizeSlug,
  type Block,
  type BlockType,
  type PageDocument,
  type Workspace,
} from "../../shared/visualBuilder";
export function block(
  type: BlockType,
  props: Record<string, unknown> = {},
): Block {
  return { type, props: { id: newId(), ...props } };
}
const text = (value: string, size = 20) =>
  block("Text", {
    text: value,
    tag: size >= 60 ? "h1" : size >= 28 ? "h2" : "p",
    style: {
      desktop: { fontSize: size },
      mobile: { fontSize: Math.min(size, 34) },
    },
  });
const button = () => block("Button", { text: "Let’s talk", href: "/contact/" });
const image = () =>
  block("Image", {
    src: "/builder-samples/landscape.svg",
    alt: "Abstract green hills and a yellow sun",
  });
export const starterBlocks: Record<BlockType, () => Block> = {
  Registered: () =>
    block("Registered", {
      registrationId: "example-card-v1",
      text: "Review this code before integration.",
      style: {
        desktop: {
          padding: 24,
          radius: 16,
          background: "#ffffff",
          borderWidth: 1,
          borderColor: "#d8e0d1",
        },
      },
    }),
  ContentList: () =>
    block("ContentList", {
      text: "Ideas worth sharing",
      categoryId: "",
      sort: "newest",
      limit: 6,
      variant: "cards",
      showImages: "yes",
      showExcerpts: "yes",
      showAuthors: "no",
      showDates: "yes",
      linkLabel: "Read article",
      emptyText: "No published posts in this category yet.",
      style: {
        desktop: { padding: 48, columns: 3, gap: 24, maxWidth: 1280 },
        tablet: { columns: 2 },
        mobile: { columns: 1, padding: 20 },
      },
    }),
  ContactForm: () =>
    block("ContactForm", {
      text: "Let’s make something great.",
      description: "Tell us about your project. We’ll get back to you soon.",
      label: "Contact us",
      submitLabel: "Send message",
      successMessage: "Thank you. Your message has been received.",
      privacyText:
        "I understand my details will be used to respond to this enquiry.",
      privacyUrl: "/privacy-policy/",
      showPhone: "yes",
      showSurname: "yes",
      showWebsite: "no",
      showMarketing: "no",
      marketingText: "I would also like to receive news and updates.",
      style: {
        desktop: {
          padding: 48,
          maxWidth: 800,
          background: "#ffffff",
          borderRadius: 20,
        },
        mobile: { padding: 20 },
      },
    }),
  Shared: () => block("Shared", { componentId: "unselected", overrides: {} }),
  Menu: () =>
    block("Menu", {
      text: "KAIZEN®",
      href: "/",
      label: "Main navigation",
      links: [
        { label: "Our work", href: "/case-studies/" },
        { label: "About us", href: "/about/" },
        { label: "Get in touch", href: "/contact/" },
      ],
      style: {
        desktop: { padding: 24, background: "#ffffff" },
        mobile: { padding: 20 },
      },
    }),
  Accordion: () =>
    block("Accordion", {
      items: [
        {
          title: "How do we get started?",
          content:
            "Tell us about your idea. We’ll help you take the first step.",
        },
        {
          title: "Can the website grow with us?",
          content:
            "Absolutely. Start with what you need and add more as your business grows.",
        },
      ],
      style: {
        desktop: { padding: 32, maxWidth: 960 },
        mobile: { padding: 20 },
      },
    }),
  Tabs: () =>
    block("Tabs", {
      label: "Our approach",
      items: [
        {
          title: "Discover",
          content:
            "We start by listening. Together, we find what matters most to your audience.",
        },
        {
          title: "Design",
          content:
            "Thoughtful layouts, clear words and a distinctive look bring your ideas to life.",
        },
        {
          title: "Deliver",
          content: "Launch with confidence, then keep improving.",
        },
      ],
      style: {
        desktop: { padding: 32, maxWidth: 1120 },
        mobile: { padding: 20 },
      },
    }),
  Video: () =>
    block("Video", {
      src: "/builder-samples/story.webm",
      poster: "/builder-samples/landscape.svg",
      captions: "/builder-samples/story.vtt",
      captionLanguage: "en",
      label: "Our story",
      text: "A little motion. A new beginning. Replace this sample with your own story.",
      style: { desktop: { padding: 24, maxWidth: 1120 } },
    }),
  Section: () =>
    block("Section", {
      children: [],
      style: { desktop: { padding: 64 }, mobile: { padding: 24 } },
    }),
  Container: () =>
    block("Container", {
      children: [],
      style: { desktop: { maxWidth: 1120, padding: 24 } },
    }),
  Columns: () =>
    block("Columns", {
      children: [
        block("Container", { children: [text("Your first column")] }),
        block("Container", { children: [text("Your second column")] }),
      ],
      style: { desktop: { columns: 2, gap: 24 }, mobile: { columns: 1 } },
    }),
  Grid: () =>
    block("Grid", {
      children: [],
      style: {
        desktop: { columns: 3, gap: 24, padding: 32 },
        tablet: { columns: 2 },
        mobile: { columns: 1, padding: 20 },
      },
    }),
  Text: () => text("A little change. A big difference.", 32),
  RichText: () =>
    block("RichText", {
      html: "<p>Tell your story with <strong>beautifully formatted text</strong> and <a href='/contact/'>helpful links</a>.</p>",
      style: { desktop: { fontSize: 20, lineHeight: 1.55 } },
    }),
  Image: image,
  Icon: () =>
    block("Icon", {
      src: "/builder-samples/spark.svg",
      alt: "Spark",
      style: { desktop: { maxWidth: 64 } },
    }),
  Button: button,
  Navigation: () =>
    block("Navigation", {
      children: [
        text("KAIZEN®", 24),
        block("Button", { text: "Start something good ↗", href: "/contact/" }),
      ],
      style: {
        desktop: { columns: 2, padding: 24, gap: 24 },
        mobile: { columns: 1 },
      },
    }),
  Hero: () =>
    block("Hero", {
      children: [
        block("Container", {
          children: [
            text("SMALL STEPS. EXTRAORDINARY POSSIBILITIES.", 12),
            text("Make room for\nsomething better.", 64),
            text(
              "Thoughtful design for ambitious people. Build a website that feels like you, one simple step at a time.",
            ),
            button(),
          ],
          style: { desktop: { padding: 32, gap: 24 } },
        }),
        image(),
      ],
      style: {
        desktop: { columns: 2, padding: 48, gap: 36, minHeight: 520 },
        mobile: { columns: 1, padding: 20, minHeight: 0 },
      },
    }),
  Features: () =>
    block("Features", {
      children: ["Built around you", "Beautifully simple", "Ready to grow"].map(
        (title, i) =>
          block("Container", {
            children: [
              text(`0${i + 1}`, 14),
              text(title, 28),
              text(
                "Less friction. More possibility. Make every interaction count.",
                17,
              ),
            ],
            style: {
              desktop: { padding: 32, background: "#ffffff", radius: 16 },
            },
          }),
      ),
      style: {
        desktop: { columns: 3, gap: 20, padding: 48 },
        mobile: { columns: 1, padding: 20 },
      },
    }),
  Gallery: () =>
    block("Gallery", {
      children: [image(), image(), image()],
      style: {
        desktop: { columns: 3, gap: 20, padding: 48 },
        mobile: { columns: 1, padding: 20 },
      },
    }),
  Testimonials: () =>
    block("Testimonials", {
      children: [
        text("“The best ideas feel effortless. This was one of them.”", 36),
        text("Alex Morgan · Studio founder", 16),
      ],
      style: {
        desktop: { padding: 72, align: "center", background: "#e9eddf" },
        mobile: { padding: 24 },
      },
    }),
  Pricing: () =>
    block("Pricing", {
      children: ["Essentials · £490", "Growth · £990", "Complete · £1,990"].map(
        (title) =>
          block("Container", {
            children: [
              text(title, 28),
              text("Everything you need to take the next step."),
              button(),
            ],
            style: {
              desktop: {
                background: "#ffffff",
                padding: 32,
                radius: 16,
                borderWidth: 1,
                borderColor: "#d9dfd6",
              },
            },
          }),
      ),
      style: {
        desktop: { columns: 3, padding: 48, gap: 20 },
        mobile: { columns: 1, padding: 20 },
      },
    }),
  CallToAction: () =>
    block("CallToAction", {
      children: [
        text("Your next chapter starts here.", 48),
        text("Let’s make something worth sharing."),
        button(),
      ],
      style: {
        desktop: {
          padding: 72,
          background: "#182421",
          color: "#ffffff",
          align: "center",
          gap: 24,
        },
        mobile: { padding: 24 },
      },
    }),
  Footer: () =>
    block("Footer", {
      children: [
        text("KAIZEN®", 24),
        text("Made with care. Built for what comes next.", 14),
        block("Button", { text: "Get in touch ↗", href: "/contact/" }),
      ],
      style: {
        desktop: { padding: 40, columns: 3, gap: 24 },
        mobile: { columns: 1, padding: 24 },
      },
    }),
};
export function newDocument(
  title = "Untitled page",
  slug = `new-page-${newId().slice(0, 6)}`,
  template = true,
): PageDocument {
  return {
    schemaVersion: 1,
    title,
    slug,
    description: "",
    noIndex: false,
    theme: { ...defaultTheme },
    data: {
      root: { props: {} },
      content: template
        ? freshBlocks([
            starterBlocks.Navigation(),
            starterBlocks.Hero(),
            starterBlocks.Features(),
            starterBlocks.CallToAction(),
            starterBlocks.Footer(),
          ])
        : [],
    },
  };
}

export const pageTemplates = [
  {
    id: "home",
    name: "Home",
    description:
      "Introduce your business, highlight what you do and invite people to get in touch.",
    tone: "#CFC8FF",
  },
  {
    id: "about",
    name: "About",
    description: "Tell your story and explain the values behind your work.",
    tone: "#A0D7E7",
  },
  {
    id: "services",
    name: "Services",
    description: "Present three services and show how you work with customers.",
    tone: "#FFCE73",
  },
  {
    id: "contact",
    name: "Contact",
    description:
      "An enquiry form with space for your contact details and opening hours.",
    tone: "#B8E0F2",
  },
  {
    id: "pricing",
    name: "Pricing",
    description:
      "Compare three packages and answer common questions before an enquiry.",
    tone: "#FFA2C0",
  },
  {
    id: "landing",
    name: "Landing page",
    description:
      "Focus on one offer with a clear introduction, benefits and next step.",
    tone: "#7FBA7A",
  },
] as const;
export type PageTemplateId = (typeof pageTemplates)[number]["id"];

const templateSection = (children: Block[], background?: string) =>
  block("Section", {
    children,
    style: {
      desktop: { padding: 48, gap: 24, ...(background ? { background } : {}) },
      mobile: { padding: 24 },
    },
  });
const templateIntro = (eyebrow: string, heading: string, description: string) =>
  templateSection([text(eyebrow, 14), text(heading, 64), text(description)]);
const templateCards = (items: [string, string][]) =>
  block("Features", {
    ...starterBlocks.Features().props,
    children: items.map(([heading, description], index) =>
      block("Container", {
        children: [
          text(`0${index + 1}`, 14),
          text(heading, 28),
          text(description, 18),
        ],
        style: {
          desktop: { padding: 32, gap: 16, background: "#ffffff", radius: 16 },
        },
      }),
    ),
  });

/** Templates use the existing block contract and bundled samples. Every call owns fresh IDs. */
export function templateDocument(
  id: PageTemplateId,
  options: { siteName?: string; slug?: string; useSiteTheme?: boolean } = {},
): PageDocument {
  const template = pageTemplates.find((item) => item.id === id);
  if (!template) throw new Error("Choose one of the available page templates.");
  const siteName = options.siteName?.trim() || "Your business";
  const menu = block("Menu", {
    ...starterBlocks.Menu().props,
    text: siteName,
    href: "/home/",
    links: [
      { label: "Home", href: "/home/" },
      { label: "About", href: "/about/" },
      { label: "Services", href: "/services/" },
      { label: "Contact", href: "/contact/" },
    ],
  });
  const footer = block("Footer", {
    ...starterBlocks.Footer().props,
    children: [
      text(siteName, 24),
      text("Add a short description of your business.", 16),
      button(),
    ],
  });
  let content: Block[];
  switch (id) {
    case "home":
      content = [
        menu,
        starterBlocks.Hero(),
        templateCards([
          [
            "What you do",
            "Describe the service that brings people to your business.",
          ],
          [
            "Who you help",
            "Explain who you work with and the problems you help them solve.",
          ],
          [
            "Why choose you",
            "Share what makes your approach useful to your customers.",
          ],
        ]),
        starterBlocks.CallToAction(),
        footer,
      ];
      break;
    case "about":
      content = [
        menu,
        templateIntro(
          "ABOUT US",
          "Good work starts with good people.",
          "Introduce your business and the people behind it.",
        ),
        block("Columns", {
          children: [
            templateSection([
              text("Our story", 36),
              text(
                "Share how your business began, what you have learned and what matters to you today.",
              ),
            ]),
            image(),
          ],
          style: {
            desktop: { columns: 2, gap: 32, padding: 48 },
            mobile: { columns: 1, padding: 24 },
          },
        }),
        templateCards([
          ["Care", "Describe how you look after your customers."],
          ["Craft", "Explain the skills and experience behind your work."],
          [
            "Community",
            "Share the people or places that inspire your business.",
          ],
        ]),
        footer,
      ];
      break;
    case "services":
      content = [
        menu,
        templateIntro(
          "OUR SERVICES",
          "Practical help for your next step.",
          "Give customers a clear picture of what you can help them achieve.",
        ),
        templateCards([
          [
            "Your first service",
            "Explain the result, what is included and who this service is for.",
          ],
          [
            "Your second service",
            "Describe another way you help, with a clear benefit for the customer.",
          ],
          [
            "Your third service",
            "Introduce a specialist service or an ongoing way to work together.",
          ],
        ]),
        starterBlocks.Tabs(),
        starterBlocks.CallToAction(),
        footer,
      ];
      break;
    case "contact":
      content = [
        menu,
        templateIntro(
          "GET IN TOUCH",
          "Let’s talk about your project.",
          "Tell visitors how to reach you and what happens after they get in touch.",
        ),
        block("Columns", {
          children: [
            starterBlocks.ContactForm(),
            templateSection([
              text("Contact details", 32),
              text(
                "Add your business email address, telephone number and location.",
              ),
              text("When we are here", 28),
              text("Add your opening hours and usual reply times."),
            ]),
          ],
          style: {
            desktop: { columns: 2, gap: 32, padding: 32 },
            mobile: { columns: 1, padding: 20 },
          },
        }),
        footer,
      ];
      break;
    case "pricing":
      content = [
        menu,
        templateIntro(
          "PRICING",
          "Find the right fit.",
          "Explain your packages, replace the sample prices and help customers choose.",
        ),
        block("Pricing", {
          ...starterBlocks.Pricing().props,
          children: ["Essential", "Plus", "Complete"].map((name) =>
            block("Container", {
              children: [
                text(name, 28),
                text("Add your price", 36),
                text(
                  "Describe what is included, how you charge and any conditions.",
                ),
                button(),
              ],
              style: {
                desktop: {
                  padding: 32,
                  gap: 20,
                  background: "#ffffff",
                  radius: 16,
                },
              },
            }),
          ),
        }),
        block("Accordion", {
          ...starterBlocks.Accordion().props,
          items: [
            {
              title: "What is included?",
              content:
                "List what each package covers and anything customers need to arrange separately.",
            },
            {
              title: "Can I ask for something different?",
              content:
                "Explain how customers can discuss a tailored quote with you.",
            },
          ],
        }),
        footer,
      ];
      break;
    case "landing":
      content = [
        block("Navigation", {
          ...starterBlocks.Navigation().props,
          children: [text(siteName, 24), button()],
        }),
        templateIntro(
          "YOUR FEATURED OFFER",
          "One idea. Your next step.",
          "Introduce one product, service or campaign and the change it can make for your customer.",
        ),
        templateSection([
          image(),
          text("Make the benefit clear", 36),
          text(
            "Show the main result people can expect. Replace this sample illustration with an image of your own work.",
          ),
          button(),
        ]),
        starterBlocks.CallToAction(),
        footer,
      ];
      break;
  }
  return {
    ...newDocument(template.name, options.slug || id, false),
    site: { useTheme: options.useSiteTheme !== false },
    data: { root: { props: {} }, content: freshBlocks(content) },
  };
}

/** Keep both current and published routes, redirect routes and supplied website paths available to their owners. */
export function templateSlug(
  id: PageTemplateId,
  workspace: Workspace,
  reserveExisting = false,
  websitePaths: string[] = [],
) {
  const occupied = new Set(
    [
      ...workspace.pages.flatMap((page) => [
        page.draft.slug,
        ...(page.published ? [page.published.slug] : []),
      ]),
      ...[
        ...(workspace.routes?.draft || []),
        ...(workspace.routes?.published || []),
      ].map((rule) => rule.source),
      ...websitePaths,
    ].map((slug) => slug.replace(/^\/+|\/+$/g, "").toLowerCase()),
  );
  const base = reserveExisting ? `template-${id}` : id;
  let suffix = 1;
  while (true) {
    const candidate = normalizeSlug(
      `${base}${suffix === 1 ? "" : `-${suffix}`}`,
      reserveExisting,
    );
    if (!occupied.has(candidate)) return candidate;
    suffix++;
  }
}
