import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  availableRegistration,
  conversionDraft,
  saveConversion,
  conversionBrief,
  validateConversion,
} from "../../shared/builderConversions";
import {
  blockRegistry,
  exampleCardRequirements,
  registeredDefaults,
  validateRegisteredProps,
} from "../../shared/builderRegistry";
import {
  type Asset,
  clone,
  validateDocument,
} from "../../shared/visualBuilder";
import RegisteredBlock, { registeredRenderers } from "./RegisteredBlocks";
import { Blocks } from "./Renderer";
import { newDocument, starterBlocks } from "./starters";
import {
  validateBackupWorkspace,
  applyRestorePlan,
  makeRestorePlan,
} from "../../shared/builderBackup";

export function conversionFixture(): Asset[] {
  return blockRegistry
    .find((entry) => entry.id === "example-card-v1")!
    .review.contract.sources.map((source, i) => ({
      id: crypto.randomUUID(),
      name: i ? `LICENCE-${i}.txt` : "ExampleCard.tsx",
      path: i ? `LICENCE-${i}.txt` : "components/ExampleCard.tsx",
      hash: source.hash,
      kind: i ? "licence" : "code",
      mime: "text/plain",
      size: 90,
      url: `private:sample/${i}`,
      pack: "Sample",
      tags: [],
      favourite: false,
      createdAt: new Date().toISOString(),
    }));
}
describe("developer assisted conversion", () => {
  it("requires an exact reviewed contract, current source hashes and the reviewed implementation", () => {
    const assets = conversionFixture(),
      source = assets[0],
      draft = conversionDraft(source, assets);
    expect(availableRegistration(source, assets)).toBeUndefined();
    draft.requirements = { ...exampleCardRequirements };
    draft.status = "needs_review";
    const result = saveConversion(assets, source, draft);
    assets[0] = result;
    expect(availableRegistration(result, assets)?.id).toBe("example-card-v1");
    expect(Object.keys(registeredRenderers).sort()).toEqual(
      blockRegistry.map((item) => item.id).sort(),
    );
    const brief = conversionBrief(result, assets);
    expect(brief).toContain(source.hash);
    expect(brief).toContain(assets[1].hash);
    expect(brief).toContain("without executing uploaded code");
    for (const change of [
      () => {
        result.conversion!.requirements.mobile = "Different mobile behaviour";
      },
      () => {
        assets[1].hash = "a".repeat(64);
      },
      () => {
        result.conversion!.sources.pop();
      },
      () => {
        result.conversion!.status = "requested";
      },
    ]) {
      const previous = clone(assets);
      change();
      expect(availableRegistration(result, assets)).toBeUndefined();
      assets.splice(0, assets.length, ...previous);
      Object.assign(result, clone(previous[0]));
      assets[0] = result;
    }
    const design = {
      ...source,
      kind: "design" as const,
      name: "page.fig",
      hash: "d".repeat(64),
    };
    const request = saveConversion([design], design, {
      ...conversionDraft(design, [design]),
      status: "needs_review",
      requirements: { ...exampleCardRequirements },
    });
    expect(availableRegistration(request, [request])).toBeUndefined();
  });
  it("rejects stale saves, invalid references, forged statuses and invalid backup metadata", () => {
    const assets = conversionFixture(),
      source = assets[0],
      draft = conversionDraft(source, assets);
    let result = saveConversion(assets, source, draft);
    assets[0] = result;
    expect(() => saveConversion(assets, source, draft)).toThrow(
      /another window/,
    );
    expect(() =>
      saveConversion(assets, result, { ...draft, status: "available" as any }),
    ).toThrow();
    expect(() =>
      saveConversion(assets, result, { ...draft, sources: [] }),
    ).toThrow();
    expect(() =>
      saveConversion(assets, result, {
        ...draft,
        sources: [
          ...draft.sources,
          {
            assetId: crypto.randomUUID(),
            hash: "b".repeat(64),
            role: "reference",
          },
        ],
      }),
    ).toThrow(/missing or changed/);
    for (let i = 0; i < 32; i++) {
      result = saveConversion(assets, result, {
        ...draft,
        notes: `Update ${i}`,
      });
      assets[0] = result;
    }
    expect(result.conversion!.version).toBe(33);
    expect(result.conversion!.history).toHaveLength(30);
    validateConversion(result.conversion!, result, assets);
    const workspace = { pages: [], assets, saved: [] };
    validateBackupWorkspace(workspace);
    const plan = makeRestorePlan(workspace, workspace);
    plan.assetUpdates = [
      {
        expected: result,
        asset: {
          ...result,
          conversion: { ...result.conversion!, sources: [] },
        },
      },
    ];
    expect(() => applyRestorePlan(workspace, plan)).toThrow();
  });
  it("renders reviewed source as escaped React text and refuses missing registrations", () => {
    const card = starterBlocks.Registered();
    card.props.text = '<script>alert("uploaded")</script>';
    const html = renderToStaticMarkup(<RegisteredBlock block={card} />);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<article");
    const doc = newDocument("Reviewed", "reviewed", false);
    doc.data.content = [card];
    validateDocument(doc);
    card.props.registrationId = "not-installed-v1";
    expect(() => validateDocument(doc)).toThrow(/not installed/);
    expect(() =>
      validateRegisteredProps({
        registrationId: "example-card-v1",
        text: { html: "anything" },
      }),
    ).toThrow();
  });
  it("retains registered nested content through validation, rendering and editable restoration", () => {
    const panel = starterBlocks.Registered();
    panel.props = {
      ...panel.props,
      ...registeredDefaults("content-panel-v1"),
      text: "Our <approach>",
      children: [starterBlocks.Text()],
    };
    panel.props.children[0].props.text = "Nested editable copy";
    const document = newDocument(
      "Nested registration",
      "nested-registration",
      false,
    );
    document.data.content = [panel];
    validateDocument(document);
    const html = renderToStaticMarkup(
      <Blocks blocks={document.data.content} />,
    );
    expect(html).toContain("Our &lt;approach&gt;");
    expect(html).toContain("Nested editable copy");
    const workspace = {
      pages: [
        {
          id: crypto.randomUUID(),
          version: 1,
          draft: document,
          published: null,
          revisions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      assets: [],
      saved: [],
    };
    const restored = applyRestorePlan(
      { pages: [], assets: [], saved: [] },
      makeRestorePlan({ pages: [], assets: [], saved: [] }, workspace),
    );
    expect(
      restored.pages[0].draft.data.content[0].props.children[0].props.text,
    ).toBe("Nested editable copy");
    panel.props.children[0].props.id = panel.props.id;
    expect(() => validateDocument(document)).toThrow(/duplicate/);
    expect(() =>
      validateRegisteredProps({
        registrationId: "example-card-v1",
        text: "Example",
        children: [starterBlocks.Text()],
      }),
    ).toThrow(/nested content/);
  });
});
