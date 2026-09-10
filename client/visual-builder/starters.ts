import {
  defaultTheme,
  freshBlocks,
  newId,
  type Block,
  type BlockType,
  type PageDocument,
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
