import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import {
  defaultClientSettings,
  saveClientSettings,
  validateClientSettings,
  disconnectedSettings,
} from "../../shared/builderSettings";
import {
  pageMetadataHead,
  siteSitemap,
} from "../../shared/builderSiteMetadata";
import { applyRestorePlan, makeRestorePlan } from "../../shared/builderBackup";
import { applyProjectDraftAction } from "../../shared/builderProjectOperations";
import { savePage, type Workspace } from "../../shared/visualBuilder";
import { newDocument, starterBlocks } from "./starters";
import { exportProject } from "./exportProject";

describe("client settings and site handoff", () => {
  it("rejects secrets, unsafe receivers and unsupported site subfolders, with version checks", () => {
    const value = {
      ...defaultClientSettings(),
      siteUrl: "https://client.example/",
      formEndpoint: "/api/contact",
    };
    const state = saveClientSettings(undefined, 0, value);
    expect(state.value.siteUrl).toBe("https://client.example");
    expect(() => saveClientSettings(state, 0, value)).toThrow(/another window/);
    for (const formEndpoint of [
      "javascript:alert(1)",
      "//kaizen.example/contact",
      "https://user:password@client.example/contact",
      "/api/contact?key=secret",
      "/__builder-contact",
      "/\\other.example/contact",
    ])
      expect(() =>
        validateClientSettings({ ...value, formEndpoint }),
      ).toThrow();
    expect(() =>
      validateClientSettings({
        ...value,
        siteUrl: "https://client.example/subfolder",
      }),
    ).toThrow();
    expect(() =>
      validateClientSettings({
        ...value,
        cms: {
          kind: "sanity-public",
          projectId: "client123",
          dataset: "production",
          token: "secret",
        },
      } as any),
    ).toThrow(/secrets/);
    expect(disconnectedSettings(state)?.value).toEqual(defaultClientSettings());
  });
  it("keeps settings in the selected workspace and restores them with a concurrency guard", () => {
    const empty: Workspace = { pages: [], assets: [], saved: [] };
    const value = {
      ...defaultClientSettings(),
      siteUrl: "https://alpha.example",
    };
    const updated = applyProjectDraftAction(empty, {
      action: "settings",
      version: 0,
      settings: value,
    }).workspace;
    expect(empty.settings).toBeUndefined();
    const plan = makeRestorePlan(empty, updated);
    const restored = applyRestorePlan(empty, plan);
    expect(restored.settings?.value.siteUrl).toBe(value.siteUrl);
    expect(() => applyRestorePlan(updated, plan)).toThrow(/workspace changed/);
  });
  it("exports the selected receiver/favicon, escaped metadata and indexable sitemap without credentials", async () => {
    const document = newDocument('Client "site"', "about", false);
    document.data.content = [starterBlocks.ContactForm()];
    const privatePage = newDocument("Private", "private", false);
    privatePage.noIndex = true;
    const bytes = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="blue"/></svg>',
    );
    const asset = {
      id: crypto.randomUUID(),
      name: "icon.svg",
      path: "icon.svg",
      pack: "Client",
      hash: createHash("sha256").update(bytes).digest("hex"),
      mime: "image/svg+xml",
      kind: "icon" as const,
      url: "/client-favicon.svg",
      size: bytes.length,
      createdAt: new Date().toISOString(),
      tags: [],
      favourite: false,
    };
    const workspace: Workspace = {
      pages: [document, privatePage].map((doc) =>
        savePage([], doc, crypto.randomUUID(), 0),
      ),
      assets: [asset],
      saved: [],
      settings: saveClientSettings(undefined, 0, {
        ...defaultClientSettings(),
        siteUrl: "https://client.example",
        formEndpoint: "https://forms.client.example/enquiries",
        favicon: { assetId: asset.id },
      }),
    };
    const exported = await exportProject(
      [document, privatePage],
      workspace.assets,
      () => {},
      async () => bytes,
      undefined,
      undefined,
      [],
      workspace,
    );
    const files = unzipSync(new Uint8Array(await exported.blob.arrayBuffer()));
    const config = JSON.parse(strFromU8(files["src/siteConfig.json"]));
    expect(config.favicon).toContain(asset.id);
    expect(files[`public${config.favicon}`]).toBeDefined();
    expect(strFromU8(files["src/formConfig.ts"])).toContain(
      "https://forms.client.example/enquiries",
    );
    expect(strFromU8(files["public/sitemap.xml"])).toContain(
      "https://client.example/about/",
    );
    expect(strFromU8(files["public/sitemap.xml"])).not.toContain("/private/");
    expect(pageMetadataHead(document, config)).toContain(
      "Client &quot;site&quot;",
    );
    expect(pageMetadataHead(document, config)).toContain(
      'rel="canonical" href="https://client.example/about/"',
    );
    expect(siteSitemap([document], { ...config, siteUrl: "" })).toBe("");
    expect(
      exported.warnings.some((warning) =>
        warning.includes("Contact forms need"),
      ),
    ).toBe(false);
    const backup = unzipSync(files[".kaizen/project.zip"]);
    expect(JSON.parse(strFromU8(backup["project.json"])).version).toBe(2);
    expect(
      JSON.parse(strFromU8(backup["project.json"])).workspace.settings,
    ).toEqual(workspace.settings);
  });
});
