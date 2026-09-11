import { expect, it } from "vitest";
import {
  projectDeliveryWarnings,
  projectLinkWarnings,
} from "../../shared/builderDelivery";
import { initialSiteDesign, saveSiteDesign } from "../../shared/builderSite";
import { savePage, type Workspace } from "../../shared/visualBuilder";
import { newDocument, starterBlocks } from "./starters";

it("reports missing shared footer destinations and disabled forms in the frozen project", () => {
  const document = newDocument("Home", "home", false);
  document.site = { useTheme: true, footerId: "footer" };
  document.data.content = [starterBlocks.ContactForm()];
  const design = initialSiteDesign();
  design.components = [
    {
      id: "footer",
      name: "Footer",
      kind: "footer",
      blocks: [starterBlocks.Footer()],
    },
  ];
  const workspace: Workspace = {
    pages: [savePage([], document, crypto.randomUUID(), 0)],
    assets: [],
    saved: [],
    site: saveSiteDesign(undefined, 0, design),
  };
  const before = JSON.stringify(workspace);
  const warnings = projectDeliveryWarnings(
    workspace,
    undefined,
    "https://client.example",
  );
  expect(warnings).toContainEqual(
    expect.stringContaining("Link /contact/ has no page"),
  );
  expect(warnings).toContainEqual(
    expect.stringContaining("no receiving service"),
  );
  expect(JSON.stringify(workspace)).toBe(before);
  workspace.pages.push(
    savePage(
      [],
      newDocument("Contact", "contact", false),
      crypto.randomUUID(),
      0,
    ),
  );
  expect(projectDeliveryWarnings(workspace)).not.toContainEqual(
    expect.stringContaining("Link /contact/"),
  );
});

it("checks rich text and same-site absolute URLs, resolves redirect chains and ignores external URLs", () => {
  const document = newDocument("About", "about", false);
  const rich = starterBlocks.RichText();
  rich.props.html =
    '<a href="/about?from=test#copy">About</a><a href="/old/">Old</a><a href="https://client.example/missing/">Missing</a><a href="https://other.example/elsewhere/">External</a>';
  document.data.content = [rich];
  const routes = [
    {
      id: crypto.randomUUID(),
      source: "/old/",
      destination: "/older/",
      status: 301 as const,
    },
    {
      id: crypto.randomUUID(),
      source: "/older/",
      destination: "/about/",
      status: 301 as const,
    },
  ];
  expect(
    projectLinkWarnings([document], routes, "https://client.example"),
  ).toEqual([
    expect.stringContaining("Link https://client.example/missing/ has no page"),
  ]);
  routes[1].destination = "/absent/";
  expect(projectLinkWarnings([document], routes)).toContainEqual(
    expect.stringContaining("Redirect /old/ ends at /absent/"),
  );
});
