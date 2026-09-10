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
  it("ignores Mac metadata from extracted UI8 folders as well as archives", async () => {
    const file = { size: 10 } as Blob;
    const files = [
      "Pack/images/gradient.jpg",
      "Pack/__MACOSX/._gradient.jpg",
      "Pack/.DS_Store",
      "Pack/images/._gradient.jpg",
      "Pack/LICENCE.txt",
    ];
    const result = await expandFiles(
      files.map((path) => ({ path, file })),
      () => {},
    );
    expect(result.map((entry) => entry.path)).toEqual([
      "Pack/images/gradient.jpg",
      "Pack/LICENCE.txt",
    ]);
  });
  it("removes executable SVG and external resources while retaining vector shapes", async () => {
    vi.stubGlobal("Blob", NodeBlob);
    vi.stubGlobal("crypto", webcrypto);
    const file = new NodeBlob([
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject><div>unsafe</div></foreignObject><image href="https://example.com/pixel"/><path d="M0 0L10 10" fill="red"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1s" repeatCount="indefinite"/></path></svg>',
    ]);
    const result = await prepareAsset(
      { path: "icons/test.svg", file: file as unknown as Blob },
      "Test",
    );
    const svg = await result.blob.text();
    expect(svg).toContain("<path");
    expect(svg).not.toMatch(/script|foreignObject|onload|https:\/\/example|animate/i);
    expect(result.asset.hash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("retains Illustrator class-based colours and outline strokes without retaining executable styles", async () => {
    vi.stubGlobal("Blob", NodeBlob);
    vi.stubGlobal("crypto", webcrypto);
    const file = new NodeBlob([
      '<svg xmlns="http://www.w3.org/2000/svg"><style>.st0{fill:#D5E04E}.st1{fill:none;stroke:#231F20;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10}.bad{fill:url(https://outside.test/pixel)}</style><path class="st0" d="M0 0L20 20"/><path class="st1" d="M2 2L18 18"/><path class="bad" style="stroke:#123456;filter:url(https://outside.test/filter)" d="M3 3L10 10"/></svg>',
    ]);
    const { blob } = await prepareAsset(
      { path: "icons/illustrator.svg", file: file as unknown as Blob },
      "Real-world regression",
    );
    const svg = new DOMParser().parseFromString(
      await blob.text(),
      "image/svg+xml",
    );
    expect(svg.querySelector(".st0")?.getAttribute("fill")).toBe(
      "rgb(213, 224, 78)",
    );
    expect(svg.querySelector(".st1")?.getAttribute("fill")).toBe("none");
    expect(svg.querySelector(".st1")?.getAttribute("stroke-width")).toBe("5");
    expect(svg.querySelector(".bad")?.getAttribute("stroke")).toBe(
      "rgb(18, 52, 86)",
    );
    expect(await blob.text()).not.toMatch(
      /<style|style=|https:\/\/outside|filter=/,
    );
  });
});
