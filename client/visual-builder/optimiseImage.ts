import { newId, type Asset, type AssetImage } from "../../shared/visualBuilder";

export function hasAnimation(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/gif" || mime === "image/avif") return true; // Preserve GIF and potentially animated AVIF originals.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (mime === "image/png") {
    for (let offset = 8; offset + 12 <= bytes.length; ) {
      const length = view.getUint32(offset);
      if (text(offset + 4) === "acTL") return true;
      if (length > bytes.length - offset - 12) break;
      offset += length + 12;
    }
  }
  if (mime === "image/webp") {
    for (let offset = 12; offset + 8 <= bytes.length; ) {
      const kind = text(offset),
        length = view.getUint32(offset + 4, true);
      if (["ANIM", "ANMF"].includes(kind)) return true;
      if (length > bytes.length - offset - 8) break;
      offset += 8 + length + (length % 2);
    }
  }
  return false;
}
export async function createImageVariants(
  asset: Asset,
  original: Blob,
): Promise<{
  image: AssetImage;
  files: { asset: Asset; blob: Blob; width: number; height: number }[];
}> {
  const image: AssetImage = {
      source: asset.url,
      status: "original",
      variants: [],
    },
    files: { asset: Asset; blob: Blob; width: number; height: number }[] = [];
  if (hasAnimation(new Uint8Array(await original.arrayBuffer()), asset.mime))
    return {
      image: {
        ...image,
        note: "GIF, animated PNG/WebP and AVIF use their original files to preserve animation and fidelity.",
      },
      files,
    };
  const bitmap = await createImageBitmap(original);
  try {
    image.width = bitmap.width;
    image.height = bitmap.height;
    if (bitmap.width * bitmap.height > 40_000_000)
      return {
        image: {
          ...image,
          note: "Images above 40 megapixels keep their original file. Resize a copy to enable optimisation.",
        },
        files,
      };
    const widths = [
      ...new Set(
        [Math.min(320, bitmap.width), 640, 1280, 1920, 2560].filter(
          (width) => width <= bitmap.width,
        ),
      ),
    ];
    for (const width of widths) {
      const height = Math.max(
        1,
        Math.round((bitmap.height * width) / bitmap.width),
      );
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("Image optimisation is unavailable in this browser.");
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("Could not encode an optimised image.")),
          "image/webp",
          0.84,
        ),
      );
      canvas.width = canvas.height = 1;
      if (blob.type !== "image/webp")
        throw new Error(
          "This browser cannot create WebP images. The original remains available.",
        );
      if (blob.size >= original.size * 0.95) continue;
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
        ),
      )
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      files.push({
        blob,
        width,
        height,
        asset: {
          id: newId(),
          name: `${asset.name.replace(/\.[^.]+$/, "")}-${width}w.webp`,
          path: `_generated/${asset.id}/${width}.webp`,
          pack: asset.pack,
          originalPack: asset.originalPack || asset.pack,
          generatedFrom: asset.url,
          hash,
          mime: "image/webp",
          kind: "image",
          size: blob.size,
          url: "",
          tags: [],
          favourite: false,
          createdAt: new Date().toISOString(),
        },
      });
    }
    if (!files.length)
      image.note =
        "The original is already small; no larger replacement files were kept.";
    return { image, files };
  } finally {
    bitmap.close();
  }
}
