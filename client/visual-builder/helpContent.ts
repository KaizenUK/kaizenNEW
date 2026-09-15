export const helpTopics = {
  folder: {
    title: "Website folder backups",
    description:
      "Keep a copy of the original website and restore it into a new folder.",
  },
  pages: {
    title: "Pages",
    description: "Open a page to edit it, or add a new one.",
  },
  projects: {
    title: "Projects",
    description: "Choose the website you want to work on.",
  },
  site: {
    title: "Site design",
    description:
      "Set the shared colours, fonts, headers and footers for your pages.",
  },
  assets: {
    title: "Assets",
    description:
      "Manage the images, icons, fonts and files used by this website.",
  },
  releases: {
    title: "Releases",
    description:
      "Review saved changes, publish them and check their destination.",
  },
  redirects: {
    title: "Redirects",
    description: "Send visitors from an old page address to its replacement.",
  },
  previews: {
    title: "Private previews",
    description: "Manage links to saved page previews before publishing.",
  },
  backups: {
    title: "Backups",
    description:
      "Download an editable project copy or review a backup to restore.",
  },
  repository: {
    title: "Export & handoff",
    description: "Export this website or connect its website folder.",
  },
  settings: {
    title: "Settings",
    description:
      "Manage this website's details, connections and your preferred view.",
  },
  account: {
    title: "Account",
    description:
      "Manage your name, sign-in details and access on other devices.",
  },
  existing: {
    title: "Existing site pages",
    description:
      "Find pages from the original website and open their editor. Its existing design is preserved.",
  },
  editor: {
    title: "Page editor",
    description:
      "Edit this page's content and design, then preview your changes.",
  },
  source: {
    title: "Website page editor",
    description:
      "Edit the page, review your changes and save them to the website.",
  },
  people: {
    title: "People and access",
    description: "Invite people and choose what they can do in this project.",
  },
  helper: {
    title: "Website helper",
    description: "Connect the website folder used for editing and previews.",
  },
} as const;
export type HelpTopic = keyof typeof helpTopics;
export type HelpBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

/** Deliberately small Markdown subset used by the maintained help sections: no HTML or executable content. */
export function readHelpSection(
  markdown: string,
  topic: HelpTopic,
): HelpBlock[] {
  const marker = `<!-- builder-help:${topic} -->`;
  const start = markdown.indexOf(marker);
  const end = markdown.indexOf("<!-- /builder-help -->", start);
  if (
    start < 0 ||
    end < 0 ||
    markdown.indexOf(marker, start + marker.length) !== -1
  )
    throw new Error("This help section could not be loaded.");
  const section = markdown.slice(start + marker.length, end).trim();
  if (!section || section.length > 12000)
    throw new Error("This help section could not be loaded.");
  return section.split(/\n\s*\n/).map((block) => {
    const lines = block.trim().split("\n");
    if (lines.length === 1 && /^#{2,3} /.test(lines[0]))
      return { kind: "heading", text: lines[0].replace(/^#+ /, "") };
    if (lines.every((line) => /^- /.test(line)))
      return {
        kind: "list",
        ordered: false,
        items: lines.map((line) => line.slice(2)),
      };
    if (lines.every((line) => /^\d+\. /.test(line)))
      return {
        kind: "list",
        ordered: true,
        items: lines.map((line) => line.replace(/^\d+\. /, "")),
      };
    if (lines.some((line) => /^(?:#|<|```|\|)/.test(line)))
      throw new Error("This help section contains unsupported formatting.");
    return { kind: "paragraph", text: lines.join(" ") };
  });
}

export function helpLinkTarget(
  value: string,
): { topic: HelpTopic } | { href: string } | undefined {
  if (value.startsWith("#help-")) {
    const topic = value.slice(6);
    return Object.prototype.hasOwnProperty.call(helpTopics, topic)
      ? { topic: topic as HelpTopic }
      : undefined;
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password)
      return { href: url.href };
  } catch {
    /* Unknown or relative destinations remain plain text. */
  }
}
