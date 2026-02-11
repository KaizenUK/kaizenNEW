import { assist, contextDocumentTypeName } from "@sanity/assist";
import { visionTool } from "@sanity/vision";
import {
  defineArrayMember,
  defineConfig,
  defineField,
  defineType,
  type DocumentActionComponent,
  type SanityDocument,
} from "sanity";
import { deskTool, type StructureBuilder } from "sanity/desk";
import { media } from "sanity-plugin-media";
import { SEOPane } from "sanity-plugin-seo-pane";
import { studioSessionPlugin } from "./src/lib/sanity/studioSessionPlugin";

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

const projectId =
  env.NEXT_PUBLIC_SANITY_PROJECT_ID ??
  env.PUBLIC_SANITY_PROJECT_ID ??
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??
  process.env.PUBLIC_SANITY_PROJECT_ID ??
  "";

const dataset =
  env.NEXT_PUBLIC_SANITY_DATASET ??
  env.PUBLIC_SANITY_DATASET ??
  process.env.NEXT_PUBLIC_SANITY_DATASET ??
  process.env.PUBLIC_SANITY_DATASET ??
  "production";

const siteUrl = (
  env.PUBLIC_SITE_URL ??
  env.NEXT_PUBLIC_SITE_URL ??
  process.env.PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:4321"
).replace(/\/$/, "");

const resolvedProjectId = projectId || "missing-project-id";
const resolvedDataset = dataset || "production";
const SITE_SETTINGS_ID = "siteSettings";
const DEPLOYABLE_SCHEMA_TYPES = new Set([
  "post",
  "page",
]);

async function triggerStudioDeploy(payload: {
  documentId?: string;
  schemaType?: string;
}): Promise<void> {
  const response = await fetch("/api/deploy", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Deployment trigger failed (${response.status} ${response.statusText})${message ? `: ${message}` : ""}`,
    );
  }
}

const deployNowAction: DocumentActionComponent = (props) => ({
  label: "Deploy Live",
  title: "Trigger a production deployment now",
  group: "paneActions",
  onHandle: async () => {
    try {
      await triggerStudioDeploy({
        documentId: props.id,
        schemaType: props.type,
      });
    } catch (error) {
      console.error("Manual deploy trigger failed", error);
      if (typeof window !== "undefined") {
        window.alert(
          "Deploy trigger failed. Check /api/deploy server env vars and GitHub Actions permissions.",
        );
      }
    } finally {
      props.onComplete();
    }
  },
});

deployNowAction.displayName = "DeployNowAction";

function wrapPublishWithDeploy(
  action: DocumentActionComponent,
): DocumentActionComponent {
  const PublishAndDeployAction: DocumentActionComponent = (props) => {
    const original = action(props);

    if (!original) return original;

    return {
      ...original,
      label: "Publish & Deploy",
      title: "Publish this document and trigger a production deployment",
      onHandle: async () => {
        try {
          if (typeof original.onHandle === "function") {
            await Promise.resolve(original.onHandle());
          }

          // Publish is async in the background; wait briefly before dispatching the build.
          await new Promise((resolve) => setTimeout(resolve, 1200));
          await triggerStudioDeploy({
            documentId: props.id,
            schemaType: props.type,
          });
        } catch (error) {
          console.error("Publish succeeded but deploy trigger failed", error);
          if (typeof window !== "undefined") {
            window.alert(
              "Published, but deploy trigger failed. Use the 'Deploy Live' button to retry.",
            );
          }
        }
      },
    };
  };

  PublishAndDeployAction.action = action.action;
  PublishAndDeployAction.displayName = action.displayName ?? "PublishAndDeployAction";
  return PublishAndDeployAction;
}

function applyDeployActions(
  previousActions: DocumentActionComponent[],
  schemaType: string,
): DocumentActionComponent[] {
  if (!DEPLOYABLE_SCHEMA_TYPES.has(schemaType)) {
    return previousActions;
  }

  const withPublishWrapped = previousActions.map((action) =>
    action.action === "publish" ? wrapPublishWithDeploy(action) : action,
  );

  if (withPublishWrapped.some((action) => action.displayName === deployNowAction.displayName)) {
    return withPublishWrapped;
  }

  return [deployNowAction, ...withPublishWrapped];
}

const author = defineType({
  name: "author",
  title: "Author",
  type: "document",
  fields: [
    defineField({
      name: "name",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "image",
      type: "image",
      options: {
        hotspot: true,
        aiAssist: { exclude: true },
      },
    }),
    defineField({
      name: "role",
      type: "string",
      initialValue: "Author",
    }),
  ],
  preview: {
    select: {
      title: "name",
      media: "image",
      subtitle: "role",
    },
  },
});

const codeBlock = defineType({
  name: "codeBlock",
  title: "Code Block",
  type: "object",
  fields: [
    defineField({
      name: "language",
      type: "string",
      title: "Language",
      initialValue: "typescript",
      options: {
        list: [
          { title: "TypeScript", value: "typescript" },
          { title: "JavaScript", value: "javascript" },
          { title: "TSX", value: "tsx" },
          { title: "JSX", value: "jsx" },
          { title: "Bash", value: "bash" },
          { title: "JSON", value: "json" },
          { title: "HTML", value: "markup" },
        ],
      },
    }),
    defineField({
      name: "code",
      type: "text",
      rows: 10,
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      title: "language",
      subtitle: "code",
    },
    prepare: ({ title, subtitle }) => ({
      title: `${title ?? "code"} snippet`,
      subtitle: typeof subtitle === "string" ? subtitle.slice(0, 64) : "",
    }),
  },
});

const callToAction = defineType({
  name: "callToAction",
  title: "Call To Action",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Button Label",
      type: "string",
      validation: (Rule) => Rule.required().max(40),
    }),
    defineField({
      name: "href",
      title: "Button URL",
      type: "string",
      description: "Use absolute (https://...) or site-relative (/contact) URLs.",
      validation: (Rule) =>
        Rule.required().custom((value) => {
          if (typeof value !== "string" || !value.trim()) {
            return "Button URL is required";
          }

          const href = value.trim();
          if (
            href.startsWith("/") ||
            href.startsWith("https://") ||
            href.startsWith("http://") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:")
          ) {
            return true;
          }

          return "URL must start with /, https://, http://, mailto:, or tel:";
        }),
    }),
    defineField({
      name: "style",
      title: "Style",
      type: "string",
      initialValue: "primary",
      options: {
        layout: "radio",
        list: [
          { title: "Primary", value: "primary" },
          { title: "Ghost", value: "ghost" },
        ],
      },
    }),
    defineField({
      name: "newTab",
      title: "Open In New Tab",
      type: "boolean",
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      label: "label",
      href: "href",
      style: "style",
    },
    prepare: ({ label, href, style }) => ({
      title: label || "CTA Button",
      subtitle: `${style || "primary"} - ${href || "(missing href)"}`,
    }),
  },
});

const navigationLink = defineType({
  name: "navigationLink",
  title: "Navigation Link",
  type: "object",
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      validation: (Rule) => Rule.required().max(40),
    }),
    defineField({
      name: "href",
      title: "URL",
      type: "string",
      validation: (Rule) =>
        Rule.required().custom((value) => {
          if (typeof value !== "string" || !value.trim()) {
            return "URL is required";
          }

          const href = value.trim();
          if (
            href.startsWith("/") ||
            href.startsWith("https://") ||
            href.startsWith("http://") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:")
          ) {
            return true;
          }

          return "URL must start with /, https://, http://, mailto:, or tel:";
        }),
    }),
    defineField({
      name: "newTab",
      title: "Open In New Tab",
      type: "boolean",
      initialValue: false,
    }),
  ],
  preview: {
    select: {
      title: "label",
      subtitle: "href",
    },
  },
});

const socialLink = defineType({
  name: "socialLink",
  title: "Social Link",
  type: "object",
  fields: [
    defineField({
      name: "platform",
      title: "Platform",
      type: "string",
      validation: (Rule) => Rule.required().max(30),
    }),
    defineField({
      name: "url",
      title: "URL",
      type: "string",
      validation: (Rule) => Rule.required().uri({ allowRelative: false }),
    }),
  ],
  preview: {
    select: {
      platform: "platform",
      url: "url",
    },
    prepare: ({ platform, url }) => ({
      title: platform || "Social Link",
      subtitle: url,
    }),
  },
});

const hero = defineType({
  name: "hero",
  title: "Hero",
  type: "object",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: "subtitle",
      title: "Subtitle",
      type: "text",
      rows: 3,
      validation: (Rule) => Rule.max(300),
    }),
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: {
        hotspot: true,
        aiAssist: { exclude: true },
      },
    }),
    defineField({
      name: "buttonLink",
      title: "Button Link",
      type: "callToAction",
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "subtitle",
      media: "image",
    },
  },
});

const featureItem = defineType({
  name: "featureItem",
  title: "Feature Item",
  type: "object",
  fields: [
    defineField({
      name: "icon",
      title: "Icon",
      type: "string",
      description: "Icon name or emoji.",
      validation: (Rule) => Rule.required().max(40),
    }),
    defineField({
      name: "text",
      title: "Text",
      type: "string",
      validation: (Rule) => Rule.required().max(180),
    }),
  ],
  preview: {
    select: {
      title: "text",
      subtitle: "icon",
    },
    prepare: ({ title, subtitle }) => ({
      title: title || "Feature Item",
      subtitle: subtitle ? `Icon: ${subtitle}` : "No icon",
    }),
  },
});

const features = defineType({
  name: "features",
  title: "Features",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      validation: (Rule) => Rule.max(100),
    }),
    defineField({
      name: "items",
      title: "Items",
      type: "array",
      of: [defineArrayMember({ type: "featureItem" })],
      validation: (Rule) => Rule.required().min(3).max(4),
    }),
  ],
  preview: {
    select: {
      heading: "heading",
      itemCount: "items.length",
    },
    prepare: ({ heading, itemCount }) => ({
      title: heading || "Features",
      subtitle: `${itemCount ?? 0} item(s)`,
    }),
  },
});

const ctaSection = defineType({
  name: "ctaSection",
  title: "CTA Section",
  type: "object",
  fields: [
    defineField({
      name: "text",
      title: "Big Text",
      type: "string",
      validation: (Rule) => Rule.required().max(180),
    }),
    defineField({
      name: "buttonLink",
      title: "Button",
      type: "callToAction",
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {
      title: "text",
      subtitle: "buttonLink.label",
    },
    prepare: ({ title, subtitle }) => ({
      title: title || "CTA Section",
      subtitle: subtitle ? `Button: ${subtitle}` : "No button",
    }),
  },
});

const testimonialItem = defineType({
  name: "testimonialItem",
  title: "Testimonial Item",
  type: "object",
  fields: [
    defineField({
      name: "quote",
      title: "Quote",
      type: "text",
      rows: 4,
      validation: (Rule) => Rule.required().max(600),
    }),
    defineField({
      name: "name",
      title: "Client Name",
      type: "string",
      validation: (Rule) => Rule.required().max(80),
    }),
    defineField({
      name: "role",
      title: "Client Role / Company",
      type: "string",
      validation: (Rule) => Rule.max(120),
    }),
  ],
  preview: {
    select: {
      title: "name",
      subtitle: "quote",
    },
    prepare: ({ title, subtitle }) => ({
      title: title || "Testimonial",
      subtitle: typeof subtitle === "string" ? subtitle.slice(0, 70) : "",
    }),
  },
});

const testimonials = defineType({
  name: "testimonials",
  title: "Testimonials",
  type: "object",
  fields: [
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      validation: (Rule) => Rule.max(120),
    }),
    defineField({
      name: "items",
      title: "Quotes",
      type: "array",
      of: [defineArrayMember({ type: "testimonialItem" })],
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
  preview: {
    select: {
      heading: "heading",
      itemCount: "items.length",
    },
    prepare: ({ heading, itemCount }) => ({
      title: heading || "Testimonials",
      subtitle: `${itemCount ?? 0} quote(s)`,
    }),
  },
});

const post = defineType({
  name: "post",
  title: "Post",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "excerpt",
      type: "text",
      rows: 3,
      description: "Short summary used on index cards and social snippets.",
      validation: (Rule) => Rule.max(240),
    }),
    defineField({
      name: "publishedAt",
      type: "datetime",
      validation: (Rule) => Rule.required(),
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: "author",
      type: "reference",
      to: [{ type: "author" }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "mainImage",
      title: "Main Image",
      type: "image",
      options: {
        hotspot: true,
        aiAssist: { exclude: true },
      },
      fields: [
        defineField({
          name: "alt",
          type: "string",
          title: "Alt text",
        }),
      ],
    }),
    defineField({
      name: "coverImage",
      title: "Legacy Cover Image",
      type: "image",
      options: {
        hotspot: true,
        aiAssist: { exclude: true },
      },
      hidden: ({ document }) => Boolean((document as { mainImage?: unknown })?.mainImage),
      description:
        "Optional fallback for older imported posts. Use Main Image for new content.",
      fields: [
        defineField({
          name: "alt",
          type: "string",
          title: "Alt text",
        }),
      ],
    }),
    defineField({
      name: "seo",
      title: "SEO",
      type: "object",
      description:
        "Visible scoring and validation while editing. Red errors must be fixed before publishing.",
      options: {
        collapsible: false,
        collapsed: false,
      },
      fields: [
        defineField({
          name: "metaTitle",
          title: "Meta Title",
          type: "string",
          description:
            "Required. Keep between 30 and 60 characters and include the focus keyword.",
          validation: (Rule) => [
            Rule.required().error("Meta title is required"),
            Rule.min(30).warning("Meta title should be at least 30 characters"),
            Rule.max(60).error("Google creates ellipses after 60 chars"),
            Rule.custom((value, context) => {
              const title = typeof value === "string" ? value.trim() : "";
              const focusKeyword = String(
                (context.parent as { focusKeyword?: string } | undefined)
                  ?.focusKeyword ?? "",
              ).trim();

              if (!title || !focusKeyword) {
                return true;
              }

              if (title.toLowerCase().includes(focusKeyword.toLowerCase())) {
                return true;
              }

              return "Focus keyword missing from title";
            }).warning(),
          ],
        }),
        defineField({
          name: "focusKeyword",
          title: "Focus Keyword",
          type: "string",
          description: "Primary keyword to validate against your meta title.",
        }),
        defineField({
          name: "metaDescription",
          title: "Meta Description",
          type: "text",
          rows: 4,
          description: "Required. Target 50 to 160 characters for best snippets.",
          validation: (Rule) => [
            Rule.required().error("Meta description is required"),
            Rule.min(50).warning("Descriptions should be at least 50 characters"),
            Rule.max(160).error("Descriptions should not exceed 160 characters"),
          ],
        }),
        defineField({
          name: "shareImage",
          title: "Share Image",
          type: "image",
          options: {
            hotspot: true,
            aiAssist: { exclude: true },
          },
        }),
      ],
    }),
    defineField({
      name: "readTime",
      type: "number",
      description:
        "Optional manual read time in minutes. Leave blank to auto-estimate.",
      validation: (Rule) => Rule.min(1).max(60),
    }),
    defineField({
      name: "body",
      type: "array",
      of: [
        defineArrayMember({ type: "block" }),
        defineArrayMember({
          type: "image",
          options: {
            hotspot: true,
            aiAssist: { exclude: true },
          },
          fields: [
            defineField({
              name: "alt",
              type: "string",
              title: "Alt text",
            }),
          ],
        }),
        defineArrayMember({ type: "callToAction" }),
        defineArrayMember({ type: "codeBlock" }),
      ],
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "author.name",
      media: "mainImage",
      fallbackMedia: "coverImage",
    },
    prepare: ({ title, subtitle, media, fallbackMedia }) => ({
      title,
      subtitle,
      media: media || fallbackMedia,
    }),
  },
});

const redirect = defineType({
  name: "redirect",
  title: "Redirect",
  type: "document",
  fields: [
    defineField({
      name: "source",
      title: "Source",
      type: "string",
      description: "Path to match, e.g. /old-page",
      validation: (Rule) =>
        Rule.required().custom((value) => {
          if (typeof value !== "string") return "Source is required";
          if (!value.startsWith("/")) return "Source must start with /";
          return true;
        }),
    }),
    defineField({
      name: "destination",
      title: "Destination",
      type: "string",
      description: "Target path or absolute URL.",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "isPermanent",
      title: "Permanent Redirect (301)",
      type: "boolean",
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      source: "source",
      destination: "destination",
      isPermanent: "isPermanent",
    },
    prepare: ({ source, destination, isPermanent }) => ({
      title: `${source ?? "(missing source)"} -> ${destination ?? "(missing destination)"}`,
      subtitle: isPermanent ? "301 Permanent" : "302 Temporary",
    }),
  },
});

const siteSettings = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  fields: [
    defineField({
      name: "siteTitle",
      title: "Site Title",
      type: "string",
      validation: (Rule) => Rule.required().max(100),
    }),
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
      options: {
        hotspot: true,
        aiAssist: { exclude: true },
      },
    }),
    defineField({
      name: "mainNavigation",
      title: "Main Navigation",
      type: "array",
      of: [defineArrayMember({ type: "navigationLink" })],
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: "footerText",
      title: "Footer Text",
      type: "text",
      rows: 4,
      validation: (Rule) => Rule.max(500),
    }),
    defineField({
      name: "socialLinks",
      title: "Social Links",
      type: "array",
      of: [defineArrayMember({ type: "socialLink" })],
    }),
  ],
  preview: {
    select: {
      title: "siteTitle",
      media: "logo",
    },
    prepare: ({ title, media }) => ({
      title: title || "Site Settings",
      subtitle: "Singleton",
      media,
    }),
  },
});

const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "content",
      title: "Content",
      type: "array",
      of: [
        defineArrayMember({ type: "hero" }),
        defineArrayMember({ type: "features" }),
        defineArrayMember({ type: "ctaSection" }),
        defineArrayMember({ type: "testimonials" }),
      ],
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "slug.current",
    },
    prepare: ({ title, subtitle }) => ({
      title: title || "Untitled Page",
      subtitle: subtitle ? `/${subtitle}` : "No slug",
    }),
  },
});

function resolvePostUrl(doc: SanityDocument): string {
  const slugValue =
    typeof doc.slug === "object" && doc.slug !== null && "current" in doc.slug
      ? String((doc.slug as { current?: string }).current ?? "").trim()
      : "";

  if (!slugValue) {
    return `${siteUrl}/blog`;
  }

  return `${siteUrl}/blog/${slugValue}`;
}

const studioStructure = (S: StructureBuilder) =>
  S.list()
    .title("Desk")
    .items([
      S.listItem()
        .title("Site Settings")
        .id("site-settings")
        .child(
          S.editor()
            .id("site-settings-editor")
            .schemaType("siteSettings")
            .documentId(SITE_SETTINGS_ID),
        ),
      S.divider(),
      S.listItem()
        .title("Content")
        .id("content")
        .child(
          S.list()
            .title("Content")
            .items([
              S.documentTypeListItem("page").title("Pages"),
              S.documentTypeListItem("post")
                .title("Post")
                .child(
                  S.documentTypeList("post").title("Post").child((documentId) =>
                    S.document()
                      .documentId(documentId)
                      .schemaType("post")
                      .views([
                        S.view.form(),
                        S.view
                          .component(SEOPane)
                          .title("SEO")
                          .options({
                            keywords: "seo.focusKeyword",
                            synonyms: "seo.focusKeyword",
                            url: resolvePostUrl,
                          }),
                      ]),
                  ),
                ),
              S.documentTypeListItem("author").title("Author"),
              S.documentTypeListItem("redirect").title("Redirects"),
              S.documentTypeListItem(contextDocumentTypeName).title("AI Context"),
            ]),
        ),
    ]);

const disableAiAssistInspectorRoute = {
  name: "disable-ai-assist-inspector-route",
  document: {
    inspectors: (prev: Array<{ name?: string }>) =>
      prev.filter((inspector) => inspector.name !== "ai-assistance"),
  },
};

const singletonSupport = {
  name: "singleton-support",
  document: {
    newDocumentOptions: (prev: any[], { creationContext }: any) =>
      creationContext?.type === "global"
        ? prev.filter((templateItem) => templateItem.templateId !== "siteSettings")
        : prev,
    actions: (prev: DocumentActionComponent[], { schemaType }: { schemaType: string }) => {
      let allowedActions = prev;

      if (schemaType === "siteSettings") {
        allowedActions = prev.filter((action) =>
          action.action
            ? ["publish", "discardChanges", "restore"].includes(action.action)
            : false,
        );
      }

      return applyDeployActions(allowedActions, schemaType);
    },
  },
};

export default defineConfig({
  name: "default",
  title: "Kaizen CMS",
  projectId: resolvedProjectId,
  dataset: resolvedDataset,
  basePath: "/studio",
  plugins: [
    deskTool({
      structure: studioStructure,
    }),
    media(),
    studioSessionPlugin(),
    visionTool(),
    assist(),
    singletonSupport,
    disableAiAssistInspectorRoute,
  ],
  schema: {
    types: [
      author,
      codeBlock,
      callToAction,
      navigationLink,
      socialLink,
      hero,
      featureItem,
      features,
      ctaSection,
      testimonialItem,
      testimonials,
      post,
      redirect,
      siteSettings,
      page,
    ],
  },
});
