import { isPreviewId } from "../../../shared/builderPreviews.ts";

/** Only the verified Edge actor and server-selected Storage origin reach SQL. */
export async function registerVerifiedAsset(options: {
  service: any;
  actor: string;
  projectId: string;
  asset: any;
  storageUrl: string;
}) {
  const { asset } = options;
  if (
    !asset ||
    !isPreviewId(asset.id) ||
    !/^[a-f0-9]{64}$/.test(asset.hash) ||
    !Number.isSafeInteger(asset.size) ||
    asset.size < 1 ||
    asset.size > 50 * 1024 ** 2 ||
    typeof asset.mime !== "string" ||
    !asset.mime ||
    asset.mime.length > 255 ||
    /[\x00-\x1f\x7f]/.test(asset.mime) ||
    !["image", "icon", "font", "licence", "code", "design", "other"].includes(
      asset.kind,
    )
  )
    throw new Error("Invalid asset metadata.");
  const origin = new URL(options.storageUrl);
  if (origin.protocol !== "https:" || origin.username || origin.password)
    throw new Error("Configure the verified file address before registering.");
  const { data, error } = await options.service.rpc("builder_register_asset", {
    target: options.projectId,
    actor: options.actor,
    asset,
    public_origin: origin.origin,
  });
  if (error) throw new Error(error.message);
  return data;
}
