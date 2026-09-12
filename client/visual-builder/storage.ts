import {
  hostedProject,
  cloudProjectRequest,
  cloudProjectScope,
  uploadProjectFile,
  projectMediaUrl,
} from "./cloudProjects";
import {
  activeProjectId,
  projectUrl,
  requireActiveProject,
} from "./projectStorage";
import { companionConnection } from "./companionConnection";
import {
  validateClientSettings,
  type ClientSettings,
  type SettingsState,
} from "../../shared/builderSettings";
import { getSupabaseClient } from "../lib/supabase";
import { createImageVariants } from "./optimiseImage";
import {
  resumableUpload,
  UPLOAD_CHUNK_SIZE,
  type UploadControl,
} from "./resumableUpload";
import { type RestorePlan } from "../../shared/builderBackup";
import { type ConversionDraft } from "../../shared/builderConversions";
import {
  validateDocument,
  type Asset,
  type AssetImage,
  type BuilderPage,
  type PageDocument,
  type SavedBlock,
  type Workspace,
  type SiteDesign,
  type SiteState,
  type ContentCatalogue,
} from "../../shared/visualBuilder";
import { validateSiteDesign } from "../../shared/builderSite";
import type { ReleaseStatus } from "../../shared/builderReleases";
import type { RouteState, BuilderRedirect } from "../../shared/builderRoutes";
import { validateBuilderRedirects } from "../../shared/builderRedirects.js";
import {
  validatePreviewDocument,
  isPreviewId,
  type PreviewDuration,
  type PreviewSummary,
  type PrivatePreview,
} from "../../shared/builderPreviews";
import {
  type AssetMetadataChange,
  type AssetReplacementReview,
} from "../../shared/builderLibrary";
export { builderCloudEnabled as cloudEnabled } from "./builderMode";
import { builderCloudEnabled as cloudEnabled } from "./builderMode";
export const localMode = import.meta.env.DEV && !cloudEnabled;
export const cloud = cloudEnabled ? getSupabaseClient() : null;
async function local(input?: unknown): Promise<any> {
  const response = await fetch(
    projectUrl("/__builder-local"),
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
  async saveSettings(
    version: number,
    settings: ClientSettings,
  ): Promise<SettingsState> {
    if ((await requireActiveProject()).capabilities.legacyWorkspace)
      throw new Error(
        "The original site's services remain configured in its deployment environment.",
      );
    const input = {
      action: "settings",
      version,
      settings: validateClientSettings(settings),
    };
    return (await hostedProject()) ? cloudProjectRequest(input) : local(input);
  },
  async resolveMediaUrl(url: string) {
    return (await hostedProject()) ? projectMediaUrl(url) : url;
  },
  async repository(input: Record<string, unknown>): Promise<any> {
    if (!localMode) {
      const session = await cloud?.auth.getSession();
      companionConnection.requireAccount(session?.data.session?.user.id);
      return companionConnection.request(input);
    }
    return local(input);
  },
  async clientPublication(input: Record<string, unknown>): Promise<any> {
    if ((await requireActiveProject()).capabilities.publishPath !== "worker")
      throw new Error("Use this project’s GitHub release workflow.");
    return (await hostedProject()) ? cloudProjectRequest(input) : local(input);
  },
  async setAssetConversion(
    expected: Asset,
    draft: ConversionDraft,
  ): Promise<Asset> {
    if (await hostedProject())
      return cloudProjectRequest({
        action: "asset-conversion",
        expected,
        draft,
      });
    return localMode
      ? local({ action: "asset-conversion", expected, draft })
      : unwrap(
          await cloud.rpc("builder_set_asset_conversion", { expected, draft }),
        );
  },
  async uploadScope(): Promise<string> {
    if (await hostedProject()) return cloudProjectScope();
    if (localMode) {
      const response = await fetch(projectUrl("/__builder-local?scope=1"));
      if (!response.ok)
        throw new Error("The local upload workspace is unavailable.");
      return `${location.origin}:local:${(await response.json()).scope}`;
    }
    const { data, error } = await cloud.auth.getUser();
    if (error || !data.user)
      throw new Error("Sign in again to resume your uploads.");
    return `${new URL(import.meta.env.VITE_SUPABASE_URL).origin}:${data.user.id}`;
  },
  async setAssetImage(expected: Asset, image: AssetImage): Promise<Asset> {
    if (await hostedProject())
      return cloudProjectRequest({ action: "asset-image", expected, image });
    return localMode
      ? local({ action: "asset-image", expected, image })
      : unwrap(await cloud.rpc("builder_set_asset_image", { expected, image }));
  },
  async optimiseImage(
    asset: Asset,
    progress: (percent: number) => void,
    source?: Blob,
    control: UploadControl = {},
  ): Promise<Asset> {
    if (asset.kind !== "image" || asset.generatedFrom) return asset;
    let original = source;
    if (!original) {
      const response = await fetch(await storage.download(asset));
      if (!response.ok)
        throw new Error("The original image could not be loaded.");
      original = await response.blob();
    }
    const generated = await createImageVariants(asset, original);
    for (const [index, item] of generated.files.entries()) {
      control.signal?.throwIfAborted();
      const file = await storage.uploadFile(
        item.asset,
        item.blob,
        (percent) =>
          progress(
            Math.round(
              ((index + percent / 100) / generated.files.length) * 100,
            ),
          ),
        { signal: control.signal },
      );
      generated.image.variants.push({
        url: file.url,
        width: item.width,
        height: item.height,
        hash: file.hash,
        size: file.size,
      });
    }
    generated.image.status = generated.image.variants.length
      ? "ready"
      : "original";
    const result = await storage.setAssetImage(asset, generated.image);
    progress(100);
    return result;
  },
  async loadBackupWorkspace(): Promise<Workspace> {
    if (await hostedProject())
      return cloudProjectRequest({ action: "load" }, true);
    return localMode
      ? local()
      : unwrap(await cloud.rpc("builder_backup_workspace"));
  },
  async restoreBackup(plan: RestorePlan): Promise<Workspace> {
    if (
      plan.settings &&
      (await requireActiveProject()).capabilities.legacyWorkspace
    )
      throw new Error(
        "Restore a client-settings backup into a client project. The original Kaizen site's services remain deployment-managed.",
      );
    if (await hostedProject())
      return cloudProjectRequest({ action: "restore-backup", plan });
    return localMode
      ? local({ action: "restore-backup", plan })
      : unwrap(await cloud.rpc("builder_restore_backup", { plan }));
  },
  async updateAssetMetadata(changes: AssetMetadataChange[]): Promise<Asset[]> {
    if (await hostedProject())
      return cloudProjectRequest({ action: "asset-metadata", changes });
    return localMode
      ? local({ action: "asset-metadata", changes })
      : unwrap(await cloud.rpc("builder_update_asset_metadata", { changes }));
  },
  async replaceAsset(review: AssetReplacementReview): Promise<Workspace> {
    if (await hostedProject())
      return cloudProjectRequest({ action: "replace-asset", review });
    return localMode
      ? local({ action: "replace-asset", review })
      : unwrap(await cloud.rpc("builder_replace_asset", { review }));
  },
  async loadContent(): Promise<ContentCatalogue> {
    if (await hostedProject())
      return cloudProjectRequest({ action: "content" });
    if (localMode) {
      const response = await fetch(projectUrl("/__builder-content"));
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Sanity content could not be loaded.");
      return result;
    }
    if (!cloud)
      throw new Error(
        "Connect the shared builder before loading Sanity content.",
      );
    return unwrap(await cloud.functions.invoke("builder-content"));
  },
  async load(): Promise<Workspace> {
    if (await hostedProject()) return cloudProjectRequest({ action: "load" });
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
    const siteResult = await cloud
      .from("builder_site")
      .select("payload")
      .eq("id", "site")
      .maybeSingle();
    const routesResult = await cloud
      .from("builder_routes")
      .select("payload")
      .eq("id", "site")
      .maybeSingle();
    if (
      routesResult.error &&
      !["PGRST205", "42P01"].includes(routesResult.error.code)
    )
      throw new Error(routesResult.error.message);
    if (
      siteResult.error &&
      !["PGRST205", "42P01"].includes(siteResult.error.code)
    )
      throw new Error(siteResult.error.message);
    return {
      pages,
      assets,
      saved,
      site: siteResult.data?.payload,
      routes: routesResult.data?.payload,
    };
  },
  async saveSite(version: number, design: SiteDesign): Promise<SiteState> {
    validateSiteDesign(design);
    if (await hostedProject())
      return cloudProjectRequest({ action: "site", version, design });
    return localMode
      ? local({ action: "site", version, design })
      : unwrap(
          await cloud.rpc("builder_save_site", {
            expected_version: version,
            design,
          }),
        );
  },
  async publishSite(
    workspace: Workspace,
  ): Promise<{ workspace: Workspace; message: string }> {
    if (await hostedProject())
      return cloudProjectRequest({ action: "publish-site" });
    if (localMode)
      return {
        workspace: await local({
          action: "publish-site",
          version: workspace.site?.version,
          pageVersions: Object.fromEntries(
            workspace.pages.map((page) => [page.id, page.version]),
          ),
        }),
        message: "Site design and affected pages published locally.",
      };
    return unwrap(
      await cloud.functions.invoke("builder-publish", {
        body: {
          projectId: activeProjectId,
          action: "site",
          version: workspace.site?.version,
          pageVersions: Object.fromEntries(
            workspace.pages.map((page) => [page.id, page.version]),
          ),
        },
      }),
    );
  },
  async releases(): Promise<ReleaseStatus[]> {
    if (await hostedProject()) return [];
    if (localMode) return [];
    return unwrap(await cloud.rpc("builder_list_releases"));
  },
  async saveRoutes(
    version: number,
    rules: BuilderRedirect[],
  ): Promise<RouteState> {
    const normalized = validateBuilderRedirects(rules);
    if (await hostedProject())
      return cloudProjectRequest({
        action: "routes",
        version,
        rules: normalized,
      });
    return localMode
      ? local({ action: "routes", version, rules: normalized })
      : unwrap(
          await cloud.rpc("builder_save_routes", {
            expected_version: version,
            rules: normalized,
          }),
        );
  },
  async publishRoutes(
    version: number,
  ): Promise<{ message: string; workspace?: Workspace }> {
    if (await hostedProject())
      return cloudProjectRequest({ action: "publish-routes" });
    if (localMode)
      return {
        workspace: await local({ action: "publish-routes", version }),
        message: "Redirects published to your local site.",
      };
    const result = unwrap(
      await cloud.functions.invoke("builder-publish", {
        body: {
          projectId: activeProjectId,
          action: "redirects",
          version,
          requestId: crypto.randomUUID(),
        },
      }),
    );
    if (result.error) throw new Error(result.error);
    return result;
  },
  async createPreview(
    id: string,
    document: PageDocument,
    hours: PreviewDuration,
  ): Promise<PreviewSummary> {
    validatePreviewDocument(document);
    if (!isPreviewId(id)) throw new Error("Invalid preview ID.");
    if (await hostedProject())
      return cloudProjectRequest({
        action: "preview-create",
        previewId: id,
        document,
        hours,
      });
    return localMode
      ? local({ action: "preview-create", id, document, hours })
      : unwrap(
          await cloud.rpc("builder_create_preview", {
            preview_id: id,
            snapshot: document,
            hours,
          }),
        );
  },
  async readPreview(id: string): Promise<PrivatePreview> {
    if (!isPreviewId(id)) throw new Error("Invalid preview link.");
    const preview = (await hostedProject())
      ? await cloudProjectRequest({ action: "preview-read", previewId: id })
      : localMode
        ? await local({ action: "preview-read", id })
        : unwrap(await cloud.rpc("builder_read_preview", { preview_id: id }));
    validatePreviewDocument(preview.document);
    if (preview.id !== id || !Number.isFinite(Date.parse(preview.expiresAt)))
      throw new Error("Invalid saved preview.");
    return preview;
  },
  async previews(): Promise<PreviewSummary[]> {
    if (await hostedProject())
      return cloudProjectRequest({ action: "preview-list" });
    return localMode
      ? local({ action: "preview-list" })
      : unwrap(await cloud.rpc("builder_list_previews"));
  },
  async revokePreview(id: string): Promise<void> {
    if (await hostedProject())
      return cloudProjectRequest({ action: "preview-revoke", previewId: id });
    if (!isPreviewId(id)) throw new Error("Invalid preview ID.");
    if (localMode) await local({ action: "preview-revoke", id });
    else unwrap(await cloud.rpc("builder_revoke_preview", { preview_id: id }));
  },
  async releaseAction(body: {
    action: "rollback" | "retry" | "unpublish";
    targetId?: string;
    requestId?: string;
    id?: string;
    version?: number;
  }): Promise<{ release: ReleaseStatus; message: string }> {
    if (await hostedProject())
      return cloudProjectRequest({
        action: "release-action",
        releaseAction: body,
      });
    if (localMode)
      throw new Error("Hosted release controls require the shared workspace.");
    const result = unwrap(
      await cloud.functions.invoke("builder-publish", {
        body: { ...body, projectId: activeProjectId },
      }),
    );
    if (result.error) throw new Error(result.error);
    return result;
  },
  async save(
    id: string,
    version: number,
    document: PageDocument,
    label = "Autosaved draft",
  ): Promise<BuilderPage> {
    validateDocument(document);
    if (await hostedProject())
      return cloudProjectRequest({
        action: "save",
        id,
        version,
        document,
        label,
      });
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
    if (await hostedProject())
      return cloudProjectRequest({
        action: "publish",
        id: page.id,
        version: page.version,
      });
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
        body: {
          projectId: activeProjectId,
          id: page.id,
          version: page.version,
        },
      }),
    );
    if (result.error) throw new Error(result.error);
    return result;
  },
  async upload(
    asset: Asset,
    blob: Blob,
    progress: (percent: number) => void,
    options: UploadControl & { optimise?: boolean } = {},
  ): Promise<Asset> {
    const original = await storage.uploadFile(
      asset,
      blob,
      (percent) => progress(Math.round(percent * 0.7)),
      options,
    );
    if (
      options.optimise === false ||
      original.generatedFrom ||
      original.kind !== "image" ||
      original.image
    ) {
      progress(100);
      return original;
    }
    try {
      return await storage.optimiseImage(
        original,
        (percent) => progress(70 + Math.round(percent * 0.3)),
        blob,
        options,
      );
    } catch (error) {
      if (options.signal?.aborted) throw error;
      // Optimisation failure never discards an uploaded original. Details exposes the retry action.
      const image: AssetImage = {
        source: original.url,
        status: "original",
        variants: [],
        note: `Optimisation needs another attempt: ${(error as Error).message}`,
      };
      try {
        const result = await storage.setAssetImage(original, image);
        progress(100);
        return result;
      } catch {
        progress(100);
        return original;
      }
    }
  },
  async uploadFile(
    asset: Asset,
    blob: Blob,
    progress: (percent: number) => void,
    control: UploadControl = {},
  ): Promise<Asset> {
    control.signal?.throwIfAborted();
    if (await hostedProject())
      return uploadProjectFile(asset, blob, progress, control);
    if (control.scope && (await storage.uploadScope()) !== control.scope)
      throw new Error(
        "The signed-in upload workspace changed. Sign in with the original account to resume.",
      );
    const bucket = ["image", "icon", "font"].includes(asset.kind)
      ? "builder-media"
      : "builder-source";
    const uploaded = {
      ...asset,
      url:
        bucket === "builder-media"
          ? localMode
            ? ""
            : cloud.storage.from(bucket).getPublicUrl(asset.id).data.publicUrl
          : `private:${asset.id}`,
    };
    const register = async () => {
      const response = await cloud
        .from("builder_assets")
        .insert({ id: uploaded.id, hash: uploaded.hash, payload: uploaded });
      if (response.error) {
        const existing = unwrap(
          await cloud
            .from("builder_assets")
            .select("payload")
            .eq("id", asset.id)
            .maybeSingle(),
        )?.payload as Asset | undefined;
        if (
          !existing ||
          existing.hash !== asset.hash ||
          existing.path !== asset.path ||
          existing.pack !== asset.pack
        )
          throw new Error(response.error.message);
        return existing;
      }
      return uploaded;
    };
    if (control.recover) {
      const existing: Asset | undefined = localMode
        ? await (
            await fetch(
              projectUrl(
                `/__builder-local?asset=${encodeURIComponent(asset.id)}`,
              ),
            )
          ).json()
        : unwrap(
            await cloud
              .from("builder_assets")
              .select("payload")
              .eq("id", asset.id)
              .maybeSingle(),
          )?.payload;
      if (existing) {
        if (
          existing.hash !== asset.hash ||
          existing.path !== asset.path ||
          existing.pack !== asset.pack
        )
          throw new Error("This asset ID already belongs to a different file.");
        progress(100);
        return existing;
      }
      if (!localMode) {
        const object = await cloud.storage.from(bucket).info(asset.id);
        if (object.data) {
          // Recover a completed object whose database acknowledgement was lost.
          const response = await fetch(await storage.download(uploaded), {
            signal: control.signal,
          });
          if (!response.ok)
            throw new Error(
              "The completed upload could not be verified. Sign in and retry.",
            );
          const bytes = await response.arrayBuffer();
          const hash = Array.from(
            new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          )
            .map((value) => value.toString(16).padStart(2, "0"))
            .join("");
          if (hash !== asset.hash || bytes.byteLength !== asset.size)
            throw new Error(
              "The existing upload does not match this file. Discard the pending import and select it again.",
            );
          const result = await register();
          progress(100);
          return result;
        }
      }
    }
    if (blob.size < UPLOAD_CHUNK_SIZE)
      return storage.uploadStandard(asset, blob, progress, control);
    const base = new URL(
      localMode ? location.origin : import.meta.env.VITE_SUPABASE_URL,
    );
    if (!localMode && /^[\w-]+\.supabase\.co$/.test(base.hostname))
      base.hostname = base.hostname.replace(
        ".supabase.co",
        ".storage.supabase.co",
      );
    const endpoint = new URL(
      localMode ? "/__builder-upload" : "/storage/v1/upload/resumable",
      base,
    ).href;
    const uploadUrl = await resumableUpload(blob, {
      ...control,
      endpoint,
      progress,
      metadata: localMode
        ? { asset: JSON.stringify(asset) }
        : {
            bucketName: bucket,
            objectName: asset.id,
            contentType: asset.mime,
            cacheControl: "31536000",
            metadata: JSON.stringify({ hash: asset.hash }),
          },
      headers: async () => {
        if (localMode)
          return {
            "X-Kaizen-Builder": "1",
            "X-Kaizen-Project": activeProjectId,
          };
        const { data, error } = await cloud.auth.getSession();
        if (error || !data.session)
          throw new Error("Sign in again to resume this upload.");
        if (
          control.scope &&
          control.scope !==
            `${new URL(import.meta.env.VITE_SUPABASE_URL).origin}:${data.session.user.id}`
        )
          throw new Error(
            "The signed-in account changed. Pause and sign in with the original account.",
          );
        return { authorization: `Bearer ${data.session.access_token}` };
      },
    });
    if (localMode) {
      const response = await fetch(
        projectUrl("/__builder-local?action=finish-upload"),
        {
          method: "POST",
          headers: {
            "X-Kaizen-Builder": "1",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uploadUrl, asset }),
          signal: control.signal,
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ||
            "The upload could not be registered. Resume to retry.",
        );
      return result;
    }
    return register();
  },
  async uploadStandard(
    asset: Asset,
    blob: Blob,
    progress: (percent: number) => void,
    control: UploadControl = {},
  ): Promise<Asset> {
    if (await hostedProject())
      return uploadProjectFile(asset, blob, progress, control);
    let uploadUrl: string;
    let headers: Record<string, string>;
    if (localMode) {
      uploadUrl = projectUrl("/__builder-local?action=upload");
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
      const abort = () => {
        xhr.abort();
        reject(new DOMException("Upload paused", "AbortError"));
      };
      control.signal?.throwIfAborted();
      control.signal?.addEventListener("abort", abort, { once: true });
      xhr.onloadend = () => control.signal?.removeEventListener("abort", abort);
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
    if (await hostedProject())
      return cloudProjectRequest({ action: "asset", asset });
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
    if (await hostedProject())
      return cloudProjectRequest({ action: "saved", item });
    if (localMode) return local({ action: "saved", item });
    unwrap(
      await cloud.from("builder_saved").upsert({ id: item.id, payload: item }),
    );
    return item;
  },
  async download(asset: Asset) {
    if (await hostedProject())
      return projectMediaUrl(
        asset.url,
        ["image", "icon", "font"].includes(asset.kind) ? undefined : asset.name,
      );
    if (!asset.url.startsWith("private:")) return asset.url;
    return unwrap(
      await cloud.storage
        .from("builder-source")
        .createSignedUrl(asset.id, 60, { download: asset.name }),
    ).signedUrl;
  },
};
