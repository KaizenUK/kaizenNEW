import { getSupabaseClient } from "../lib/supabase";
import {
  validateDocument,
  type Asset,
  type BuilderPage,
  type PageDocument,
  type SavedBlock,
  type Workspace,
} from "../../shared/visualBuilder";
export const cloudEnabled = import.meta.env.VITE_BUILDER_CLOUD === "1";
export const localMode = import.meta.env.DEV && !cloudEnabled;
export const cloud = cloudEnabled ? getSupabaseClient() : null;
async function local(input?: unknown): Promise<any> {
  const response = await fetch(
    "/__builder-local",
    input
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Kaizen-Builder": "1",
          },
          body: JSON.stringify(input),
        }
      : {},
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "The workspace could not be saved.");
  return result;
}
function unwrap({ data, error }: { data: any; error: any }) {
  if (error) throw new Error(error.message);
  return data;
}
async function readAll(table: string) {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = unwrap(
      await cloud
        .from(table)
        .select("payload")
        .order("id")
        .range(offset, offset + 499),
    );
    rows.push(...page.map((row) => row.payload));
    if (page.length < 500) return rows;
  }
}
export const storage = {
  async load(): Promise<Workspace> {
    if (localMode) return local();
    if (!cloud)
      throw new Error(
        "The shared builder has not been configured. See docs/visual-builder.md.",
      );
    const member = unwrap(await cloud.rpc("builder_is_editor"));
    if (!member)
      throw new Error(
        "Your account needs builder editor access. Ask the site owner to add you.",
      );
    const [pages, assets, saved] = await Promise.all([
      readAll("builder_pages"),
      readAll("builder_assets"),
      readAll("builder_saved"),
    ]);
    return {
      pages,
      assets,
      saved,
    };
  },
  async save(
    id: string,
    version: number,
    document: PageDocument,
    label = "Autosaved draft",
  ): Promise<BuilderPage> {
    validateDocument(document);
    return localMode
      ? local({ action: "save", id, version, document, label })
      : unwrap(
          await cloud.rpc("builder_save_page", {
            page_id: id,
            expected_version: version,
            document,
            revision_label: label,
          }),
        );
  },
  async publish(
    page: BuilderPage,
  ): Promise<{ page: BuilderPage; message: string }> {
    if (localMode)
      return {
        page: await local({
          action: "publish",
          id: page.id,
          version: page.version,
        }),
        message: "Published to your local site.",
      };
    const result = unwrap(
      await cloud.functions.invoke("builder-publish", {
        body: { id: page.id, version: page.version },
      }),
    );
    if (result.error) throw new Error(result.error);
    return result;
  },
  async upload(
    asset: Asset,
    blob: Blob,
    progress: (percent: number) => void,
  ): Promise<Asset> {
    let uploadUrl: string;
    let headers: Record<string, string>;
    if (localMode) {
      uploadUrl = "/__builder-local?action=upload";
      headers = {
        "X-Kaizen-Builder": "1",
        "X-Asset-Metadata": encodeURIComponent(JSON.stringify(asset)),
        "Content-Type": asset.mime,
      };
    } else {
      const bucket = ["image", "icon", "font"].includes(asset.kind)
        ? "builder-media"
        : "builder-source";
      const signed = unwrap(
        await cloud.storage.from(bucket).createSignedUploadUrl(asset.id),
      );
      uploadUrl = signed.signedUrl;
      headers = { "Content-Type": asset.mime };
    }
    const response = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(localMode ? "POST" : "PUT", uploadUrl);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          progress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () =>
        reject(new Error("Connection lost. Retry this upload."));
      xhr.timeout = 180000;
      xhr.ontimeout = () =>
        reject(new Error("Upload timed out. Retry on a faster connection."));
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve(xhr.responseText)
          : reject(
              new Error(
                `Upload failed (${xhr.status}). Check storage access and retry.`,
              ),
            );
      xhr.send(blob);
    });
    if (localMode) return JSON.parse(response);
    const publicMedia = ["image", "icon", "font"].includes(asset.kind);
    const result = {
      ...asset,
      url: publicMedia
        ? cloud.storage.from("builder-media").getPublicUrl(asset.id).data
            .publicUrl
        : `private:${asset.id}`,
    };
    unwrap(
      await cloud
        .from("builder_assets")
        .insert({ id: result.id, hash: result.hash, payload: result }),
    );
    return result;
  },
  async updateAsset(asset: Asset): Promise<Asset> {
    if (localMode) return local({ action: "asset", asset });
    unwrap(
      await cloud
        .from("builder_assets")
        .update({ payload: asset })
        .eq("id", asset.id),
    );
    return asset;
  },
  async saveBlock(item: SavedBlock): Promise<SavedBlock> {
    if (localMode) return local({ action: "saved", item });
    unwrap(
      await cloud.from("builder_saved").upsert({ id: item.id, payload: item }),
    );
    return item;
  },
  async download(asset: Asset) {
    if (!asset.url.startsWith("private:")) return asset.url;
    return unwrap(
      await cloud.storage
        .from("builder-source")
        .createSignedUrl(asset.id, 60, { download: asset.name }),
    ).signedUrl;
  },
};
