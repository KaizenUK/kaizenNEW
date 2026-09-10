import {
  clone,
  safeUrl,
  resolveResponsiveStyle,
  type ResponsiveStyle,
  type Asset,
  type AssetImage,
  type Block,
  type PageDocument,
} from "./visualBuilder.ts";

export function validAssetImage(
  value: unknown,
  source?: string,
): value is AssetImage {
  if (!value || typeof value !== "object") return false;
  const item = value as AssetImage;
  return (
    (source === undefined || item.source === source) &&
    !!safeUrl(item.source, true) &&
    ["ready", "original"].includes(item.status) &&
    (item.width === undefined ||
      (Number.isInteger(item.width) &&
        item.width > 0 &&
        item.width <= 100_000)) &&
    (item.height === undefined ||
      (Number.isInteger(item.height) &&
        item.height > 0 &&
        item.height <= 100_000)) &&
    (item.note === undefined || typeof item.note === "string") &&
    Array.isArray(item.variants) &&
    item.variants.length <= 5 &&
    (item.status === "ready") === item.variants.length > 0 &&
    new Set(item.variants.map((variant) => variant?.width)).size ===
      item.variants.length &&
    item.variants.every(
      (variant) =>
        variant &&
        !!safeUrl(variant.url, true) &&
        !/[\s,]/.test(variant.url) &&
        Number.isInteger(variant.width) &&
        variant.width > 0 &&
        variant.width <= 2560 &&
        Number.isInteger(variant.height) &&
        variant.height > 0 &&
        variant.height <= 100_000 &&
        Number.isInteger(variant.size) &&
        variant.size > 0 &&
        /^[a-f0-9]{64}$/.test(variant.hash),
    )
  );
}
export function imageIndex(assets: Asset[]): Map<string, AssetImage> {
  return new Map(
    assets
      .filter(
        (asset) =>
          !asset.generatedFrom && validAssetImage(asset.image, asset.url),
      )
      .map((asset) => [asset.url, asset.image!]),
  );
}
export function imageForBlock(
  block: Block,
  images: ReadonlyMap<string, AssetImage>,
): AssetImage | undefined {
  const source = block.props.src || "";
  return (
    images.get(source) ||
    (validAssetImage(block.props.image, source) ? block.props.image : undefined)
  );
}
export function imageBackgrounds(
  block: Block,
  images: ReadonlyMap<string, AssetImage>,
): AssetImage[] {
  const cached = Array.isArray(block.props.backgroundImages)
    ? (block.props.backgroundImages.filter((item) =>
        validAssetImage(item),
      ) as AssetImage[])
    : [];
  const sources = [
    ...new Set(
      Object.values(block.props.style || {})
        .map((style) => style.backgroundImage)
        .filter(
          (source): source is string => typeof source === "string" && !!source,
        ),
    ),
  ];
  return sources
    .map(
      (source) =>
        images.get(source) || cached.find((item) => item.source === source),
    )
    .filter(Boolean) as AssetImage[];
}
export function imageStyle(
  block: Block,
  images: ReadonlyMap<string, AssetImage>,
): ResponsiveStyle | undefined {
  const backgrounds = imageBackgrounds(block, images);
  const picture = ["Image", "Icon"].includes(block.type)
    ? imageForBlock(block, images)
    : undefined;
  const naturalRatio =
    picture?.width && picture?.height
      ? `${picture.width} / ${picture.height}`
      : undefined;
  if (!naturalRatio && !backgrounds.some((image) => image.variants.length))
    return block.props.style;
  const result = clone(block.props.style || {});
  for (const [device, target] of [
    ["desktop", 2560],
    ["tablet", 1280],
    ["mobile", 640],
  ] as const) {
    const inherited = resolveResponsiveStyle(block.props.style, device);
    // sizes=auto introduces size containment. Supply the original ratio when no
    // crop is selected, so a fluid-width image does not fall back to 300x150.
    if (
      naturalRatio &&
      (!inherited.aspectRatio || inherited.aspectRatio === "auto")
    )
      result[device] = { ...result[device], aspectRatio: naturalRatio };
    const source = inherited.backgroundImage;
    const image = backgrounds.find((item) => item.source === source);
    if (!image?.variants.length) continue;
    const variants = [...image.variants].sort((a, b) => a.width - b.width);
    const variant =
      variants.find((item) => item.width >= target) ||
      variants[variants.length - 1];
    result[device] = { ...result[device], backgroundImage: variant.url };
  }
  return result;
}
/** Capture immutable variant URLs at publication/export time. Original draft references stay editable. */
export function materializeImages(
  document: PageDocument,
  assets: Asset[],
): PageDocument {
  const result = clone(document),
    images = imageIndex(assets);
  const walk = (blocks: Block[]) =>
    blocks.forEach((block) => {
      if (["Image", "Icon"].includes(block.type)) {
        const image = imageForBlock(block, images);
        if (image) block.props.image = clone(image);
        else delete block.props.image;
      }
      const backgrounds = imageBackgrounds(block, images);
      if (backgrounds.length) block.props.backgroundImages = clone(backgrounds);
      else delete block.props.backgroundImages;
      if (block.props.children) walk(block.props.children);
    });
  walk(result.data.content);
  return result;
}
export function attachAssetImage(
  assets: Asset[],
  expected: Asset,
  image: AssetImage,
): Asset {
  const current = assets.find((asset) => asset.id === expected.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(expected))
    throw new Error(
      "This asset changed. Refresh the library before optimising it again.",
    );
  if (
    current.kind !== "image" ||
    current.generatedFrom ||
    !validAssetImage(image, current.url)
  )
    throw new Error("Invalid optimised image metadata.");
  for (const variant of image.variants) {
    const file = assets.find((asset) => asset.url === variant.url);
    if (
      !file ||
      file.generatedFrom !== current.url ||
      file.mime !== "image/webp" ||
      file.hash !== variant.hash ||
      file.size !== variant.size
    )
      throw new Error("An optimised image file is missing or changed.");
  }
  return { ...current, image: clone(image) };
}
