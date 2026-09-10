// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { webcrypto } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import {
  classifyAsset,
  expandFiles,
  normalizeAssetPath,
  prepareAsset,
} from "./assets";
afterEach(() => vi.unstubAllGlobals());
describe("asset pack import boundaries", () => {
  it("distinguishes directly usable assets from source and design references", () => {
    expect(classifyAsset("photo.webp").kind).toBe("image");
    expect(classifyAsset("icon.svg").kind).toBe("icon");
    expect(classifyAsset("font.woff2").kind).toBe("font");
    expect(classifyAsset("Card.tsx").kind).toBe("code");
    expect(classifyAsset("layout.fig").kind).toBe("design");
    expect(classifyAsset("Licence.pdf").kind).toBe("licence");
  });
  it("preserves useful subfolders and prevents traversal", () => {
    expect(normalizeAssetPath("UI8 Pack\\icons\\arrow.svg")).toBe(
      "UI8 Pack/icons/arrow.svg",
    );
    for (const path of [
      "../secret",
      "images/../../a",
      "/root/a",
      "C:\\a",
      "a\u0000b",
    ])
      expect(() => normalizeAssetPath(path)).toThrow();
  });
  it("retains filenames and licence files when opening a ZIP", async () => {
    const zip = zipSync({
      "icons/arrow.svg": strToU8("<svg/>"),
      "licences/LICENCE.txt": strToU8("Terms"),
      "__MACOSX/ignore": strToU8("ignore"),
    });
    const file = {
      size: zip.length,
      arrayBuffer: async () => zip.buffer,
    } as Blob;
    const result = await expandFiles([{ path: "pack.zip", file }], () => {});
    expect(result.map((r) => r.path)).toEqual([
      "icons/arrow.svg",
      "licences/LICENCE.txt",
    ]);
  });
  it("rejects ZIP traversal before writing any files", async () => {
    const zip = zipSync({ "../evil.tsx": strToU8("payload") });
    const file = {
      size: zip.length,
      arrayBuffer: async () => zip.buffer,
    } as Blob;
    await expect(
      expandFiles([{ path: "pack.zip", file }], () => {}),
    ).rejects.toThrow("Unsafe");
  });
  it("removes executable SVG and external resources while retaining vector shapes", async () => {
    vi.stubGlobal("Blob", NodeBlob);
    vi.stubGlobal("crypto", webcrypto);
    const file = new NodeBlob([
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject><div>unsafe</div></foreignObject><image href="https://example.com/pixel"/><path d="M0 0L10 10" fill="red"/></svg>',
    ]);
    const result = await prepareAsset(
      { path: "icons/test.svg", file: file as unknown as Blob },
      "Test",
    );
    const svg = await result.blob.text();
    expect(svg).toContain("<path");
    expect(svg).not.toMatch(/script|foreignObject|onload|https:\/\/example/);
    expect(result.asset.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
