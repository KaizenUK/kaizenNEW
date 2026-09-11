import { describe, it, expect } from "vitest";
import { strFromU8 } from "fflate";
import { newDocument, starterBlocks } from "./starters";
import {
  captureClientPublication,
  clientDraftInput,
  withClientLiveBaseline,
} from "../../shared/builderClientPublication";
import { savePage, type Workspace } from "../../shared/visualBuilder";
import {
  defaultClientSettings,
  saveClientSettings,
} from "../../shared/builderSettings";
import { compileClientPublication } from "./compileClientPublication";
function fixture(): Workspace {
  const doc = newDocument("Client about", "about", false);
  const text = starterBlocks.Text();
  text.props.text = "Frozen publication text";
  doc.data.content = [text, starterBlocks.ContactForm()];
  return {
    pages: [savePage([], doc, crypto.randomUUID(), 0)],
    assets: [],
    saved: [],
    settings: saveClientSettings(undefined, 0, {
      ...defaultClientSettings(),
      siteUrl: "https://client.example",
      formEndpoint: "https://receiver.example/enquiries",
    }),
  };
}
describe("frozen client publication", () => {
  it("fails publication when an external image cannot be bundled", async () => {
    const workspace = fixture();
    workspace.pages[0].draft.data.content = [starterBlocks.Image()];
    workspace.pages[0].draft.data.content[0].props.src =
      "https://unregistered.example/missing.svg";
    await expect(
      compileClientPublication(
        captureClientPublication(crypto.randomUUID(), workspace),
        async () => {
          throw new Error("Import this image first");
        },
        () => {},
      ),
    ).rejects.toThrow("required media could not be bundled");
  });
  it("projects the live baseline while preserving newer drafts, added/deleted pages and revision history", () => {
    const id = crypto.randomUUID(),
      workspace = fixture(),
      snapshot = captureClientPublication(id, workspace);
    const newer = structuredClone(workspace);
    newer.pages[0] = savePage(
      newer.pages,
      { ...newer.pages[0].draft, title: "Newer title" },
      newer.pages[0].id,
      1,
    );
    newer.pages.push(
      savePage(
        newer.pages,
        newDocument("New draft page", "new-page", false),
        crypto.randomUUID(),
        0,
      ),
    );
    const before = clientDraftInput(newer),
      display = withClientLiveBaseline(id, newer, snapshot);
    expect(clientDraftInput(display)).toBe(before);
    expect(display.pages[0].published?.title).toBe("Client about");
    expect(display.pages[0].draft.title).toBe("Newer title");
    expect(display.pages[1].published).toBeNull();
    expect(snapshot.workspace.pages[0].draft.title).toBe("Client about");
    const unpublished = withClientLiveBaseline(id, display, null);
    expect(unpublished.pages.every((page) => !page.published)).toBe(true);
    expect(clientDraftInput(unpublished)).toBe(before);
    expect(
      withClientLiveBaseline(id, { ...newer, pages: [] }, snapshot).pages,
    ).toEqual([]);
    expect(() =>
      withClientLiveBaseline(crypto.randomUUID(), newer, snapshot),
    ).toThrow("different client");
  });
  it("compiles trusted static HTML, selected receiver, immutable runtime and an editable backup without browser-only source", async () => {
    const snapshot = captureClientPublication(crypto.randomUUID(), fixture());
    const result = await compileClientPublication(
      snapshot,
      async () => {
        throw new Error("Unexpected asset request");
      },
      () => {},
    );
    const html = strFromU8(result.files["about/index.html"]);
    expect(html).toContain("Frozen publication text");
    expect(html).toContain(
      'data-endpoint="https://receiver.example/enquiries"',
    );
    expect(html).not.toContain("__builder-contact");
    expect(html).toContain('href="https://client.example/about/"');
    expect(
      Object.keys(result.files).some((file) =>
        /^assets\/runtime-[a-f0-9]{32}\.js$/.test(file),
      ),
    ).toBe(true);
    expect(
      Object.keys(result.files).some(
        (file) => file.startsWith("src/") || file.includes(".kaizen"),
      ),
    ).toBe(false);
    expect(result.backup.length).toBeGreaterThan(0);
  });
});
