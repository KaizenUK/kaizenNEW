import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { clone, type Asset, type AssetImage } from "../../shared/visualBuilder";
import {
  attachAssetImage,
  imageForBlock,
  imageIndex,
  imageStyle,
  materializeImages,
  validAssetImage,
} from "../../shared/builderImages";
import { hasAnimation } from "./optimiseImage";
import { libraryFixture } from "./library-fixture";
import { newDocument, starterBlocks } from "./starters";
import PublishedPage from "./Renderer";

export function imageFixture() {
  const original = libraryFixture().assets[0];
  original.size = 10000;
  const files: Asset[] = [320, 1280, 2560].map((width, index) => ({
    ...original,
    id: crypto.randomUUID(),
    name: `${width}.webp`,
    path: `_generated/${width}.webp`,
    url: `/builder-media/${width}.webp`,
    mime: "image/webp",
    hash: String(index + 1).repeat(64),
    size: width,
    generatedFrom: original.url,
  }));
  const image: AssetImage = {
    source: original.url,
    status: "ready",
    width: 3000,
    height: 1500,
    variants: files.map((asset, index) => ({
      url: asset.url,
      width: [320, 1280, 2560][index],
      height: [160, 640, 1280][index],
      hash: asset.hash,
      size: asset.size,
    })),
  };
  original.image = image;
  return { original, files, image };
}
describe("immutable responsive images", () => {
  it("captures image and background variants without changing the editable original URLs", () => {
    const { original, files } = imageFixture(),
      document = newDocument("Images", "images", false);
    const picture = starterBlocks.Image();
    picture.props.src = original.url;
    const section = starterBlocks.Section();
    section.props.style = {
      desktop: { backgroundImage: original.url },
      mobile: { backgroundImage: "none" },
    };
    section.props.children = [picture];
    document.data.content = [section];
    const captured = materializeImages(document, [original, ...files]);
    expect(document.data.content[0].props.backgroundImages).toBeUndefined();
    expect(captured.data.content[0].props.style!.desktop!.backgroundImage).toBe(
      original.url,
    );
    const styles = imageStyle(captured.data.content[0], new Map())!;
    expect(styles.desktop!.backgroundImage).toBe(files[2].url);
    expect(styles.tablet!.backgroundImage).toBe(files[1].url);
    expect(styles.mobile!.backgroundImage).toBe("none");
    const html = renderToStaticMarkup(<PublishedPage document={captured} />);
    expect(html).toContain(`src="${original.url}"`);
    expect(html).toContain(`${files[0].url} 320w`);
    expect(html).toContain('sizes="auto, 100vw"');
    expect(html).toContain('width="3000" height="1500"');
    expect(html).toContain("--m-aspectRatio:3000 / 1500");
    expect(
      imageStyle(picture, imageIndex([original]))?.mobile?.aspectRatio,
    ).toBe("3000 / 1500");
    picture.props.style = {
      desktop: { aspectRatio: "1 / 1" },
      mobile: { aspectRatio: "auto" },
    };
    expect(
      imageStyle(picture, imageIndex([original]))?.desktop?.aspectRatio,
    ).toBe("1 / 1");
    expect(
      imageStyle(picture, imageIndex([original]))?.mobile?.aspectRatio,
    ).toBe("3000 / 1500");
    const frozen = clone(captured);
    original.image!.variants[0].url = "/new.webp";
    expect(captured).toEqual(frozen);
  });
  it("rejects stale metadata and missing variant files and ignores a cached set after image replacement", () => {
    const { original, files, image } = imageFixture();
    expect(
      attachAssetImage([original, ...files], original, image).image,
    ).toEqual(image);
    expect(() => attachAssetImage([original], original, image)).toThrow(
      /missing/,
    );
    expect(() =>
      attachAssetImage(
        [original, ...files],
        { ...original, favourite: true },
        image,
      ),
    ).toThrow(/changed/);
    const block = starterBlocks.Image();
    block.props.src = "/replacement.png";
    block.props.image = image;
    expect(imageForBlock(block, new Map())).toBeUndefined();
    expect(imageIndex([original, ...files]).size).toBe(1);
    expect(
      validAssetImage({
        ...image,
        variants: [{ ...image.variants[0], url: "javascript:alert(1)" }],
      }),
    ).toBe(false);
    expect(
      validAssetImage({
        ...image,
        variants: [{ ...image.variants[0], url: "/file,other.webp" }],
      }),
    ).toBe(false);
  });
  it("keeps GIF/AVIF and animated PNG/WebP originals", () => {
    expect(hasAnimation(new Uint8Array(), "image/gif")).toBe(true);
    expect(hasAnimation(new Uint8Array(), "image/avif")).toBe(true);
    const png = new Uint8Array(20);
    png.set(new TextEncoder().encode("acTL"), 12);
    expect(hasAnimation(png, "image/png")).toBe(true);
    const webp = new Uint8Array(20);
    webp.set(new TextEncoder().encode("ANIM"), 12);
    expect(hasAnimation(webp, "image/webp")).toBe(true);
    expect(hasAnimation(new Uint8Array(32), "image/jpeg")).toBe(false);
  });
});
