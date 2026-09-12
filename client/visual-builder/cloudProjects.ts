import { getSupabaseClient } from "../lib/supabase";
import { activeProjectId } from "./projectStorage";
import { resumableUpload, type UploadControl } from "./resumableUpload";
import type { Asset } from "../../shared/visualBuilder";

import { builderCloudEnabled } from "./builderMode";
export const hostedProject =
  builderCloudEnabled && activeProjectId !== "kaizen";
const canonicalToSigned = new Map<string, string>();
const signedToCanonical = new Map<string, string>();
let mediaAccount: string | undefined;
let mediaGeneration = 0;
let mediaVersion = 0;
const mediaListeners = new Set<() => void>();
const signedAt = new Map<string, number>();
const pendingMedia = new Map<string, Promise<string>>();
const mediaChanged = () => {
  mediaVersion++;
  mediaListeners.forEach((listener) => listener());
};
export const subscribeProjectMedia = (listener: () => void) => {
  mediaListeners.add(listener);
  return () => {
    mediaListeners.delete(listener);
  };
};
export const projectMediaVersion = () => mediaVersion;
export function setProjectMediaAccount(id?: string) {
  if (mediaAccount === id) return;
  mediaAccount = id;
  mediaGeneration++;
  canonicalToSigned.clear();
  signedAt.clear();
  pendingMedia.clear();
  // Old display URLs must remain recognisable in drafts/undo, but cannot be rendered again.
  mediaChanged();
}
async function accountSession() {
  const client = getSupabaseClient();
  if (!client) throw new Error("The hosted builder is not configured.");
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    setProjectMediaAccount();
    throw new Error("Sign in again to open this project.");
  }
  setProjectMediaAccount(data.session.user.id);
  return data.session;
}
async function sameAccount(id: string) {
  if ((await accountSession()).user.id !== id)
    throw new Error("The signed-in account changed. Open the project again.");
}
const canonicalPattern =
  /^\/builder-project-media\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/;
const transform = (value: any, replacements: Map<string, string>): any =>
  typeof value === "string"
    ? replacements.has(value)
      ? replacements.get(value)
      : value
    : Array.isArray(value)
      ? value.map((item) => transform(item, replacements))
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
              key,
              transform(item, replacements),
            ]),
          )
        : value;
export const canonicalProjectData = <T>(value: T): T =>
  transform(value, signedToCanonical);
export const presentProjectMedia = <T>(value: T): T =>
  transform(canonicalProjectData(value), canonicalToSigned);
export async function projectMediaUrl(
  value: string,
  download?: string,
): Promise<string> {
  const canonical = signedToCanonical.get(value) || value;
  const match = canonical.match(canonicalPattern);
  if (!match) return value;
  if (match[1] !== activeProjectId)
    throw new Error("Import this asset into the selected project first.");
  const session = await accountSession();
  const generation = mediaGeneration;
  const client = getSupabaseClient();
  if (!client)
    throw new Error("Configure hosted project storage before opening assets.");
  const started = Date.now();
  const { data, error } = await client.storage
    .from("builder-project-files")
    .createSignedUrl(
      `${match[1]}/${match[2]}`,
      3600,
      download ? { download } : undefined,
    );
  if (error || !data)
    throw new Error(error?.message || "Asset access could not be verified.");
  await sameAccount(session.user.id);
  if (generation !== mediaGeneration)
    throw new Error("The signed-in account changed. Open the project again.");
  if (!download) {
    const changed = canonicalToSigned.get(canonical) !== data.signedUrl;
    canonicalToSigned.set(canonical, data.signedUrl);
    signedAt.set(canonical, started);
    if (changed) mediaChanged();
  }
  signedToCanonical.set(data.signedUrl, canonical);
  return data.signedUrl;
}
/** Renew display access ahead of the one-hour expiry, without writing editor data. */
export async function refreshProjectMedia(force = false) {
  if (!signedAt.size) return;
  const session = await accountSession(),
    generation = mediaGeneration;
  const due = [...signedAt]
    .filter(([, time]) => force || Date.now() - time >= 50 * 60_000)
    .map(([url]) => url);
  let failed = false;
  for (let offset = 0; offset < due.length; offset += 20) {
    await Promise.all(
      due.slice(offset, offset + 20).map(async (url) => {
        let request = pendingMedia.get(url);
        if (!request) {
          request = projectMediaUrl(url);
          pendingMedia.set(url, request);
        }
        try {
          await request;
        } catch {
          failed = true;
          if (
            generation === mediaGeneration &&
            Date.now() - (signedAt.get(url) || 0) >= 60 * 60_000
          ) {
            canonicalToSigned.set(url, "");
            mediaChanged();
          }
        } finally {
          if (pendingMedia.get(url) === request) pendingMedia.delete(url);
        }
      }),
    );
    await sameAccount(session.user.id);
    if (generation !== mediaGeneration)
      throw new Error("The signed-in account changed. Open the project again.");
  }
  if (failed)
    throw new Error(
      "Some project media could not be refreshed. Check your connection and project access, then retry. Your edits are unchanged.",
    );
}
async function present<T>(value: T): Promise<T> {
  const canonical = canonicalProjectData(value);
  const urls = new Set<string>();
  function collect(item: unknown) {
    if (typeof item === "string" && canonicalPattern.test(item)) urls.add(item);
    else if (Array.isArray(item)) item.forEach(collect);
    else if (item && typeof item === "object")
      Object.values(item).forEach(collect);
  }
  collect(canonical);
  // The enclosing API request rechecks project access. Reuse still-valid display
  // URLs so preview polling does not reload an iframe or interrupt playback.
  // Explicit downloads/exports continue to sign afresh through projectMediaUrl.
  const list = [...urls].filter(
    (url) =>
      !canonicalToSigned.get(url) ||
      Date.now() - (signedAt.get(url) || 0) >= 50 * 60_000,
  );
  for (let i = 0; i < list.length; i += 20)
    await Promise.all(list.slice(i, i + 20).map((url) => projectMediaUrl(url)));
  return transform(canonical, canonicalToSigned);
}
export async function cloudProjectRequest(
  input: Record<string, unknown>,
  raw = false,
): Promise<any> {
  const client = getSupabaseClient();
  if (!client) throw new Error("The hosted builder is not configured.");
  const session = await accountSession();
  const { data, error } = await client.functions.invoke("builder-projects", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: canonicalProjectData({ ...input, projectId: activeProjectId }),
  });
  await sameAccount(session.user.id);
  if (error) {
    let message = error.message;
    try {
      message = (await error.context?.clone().json())?.error || message;
    } catch {
      /* Retain transport failure. */
    }
    throw new Error(message);
  }
  const result = raw ? data : await present(data);
  await sameAccount(session.user.id);
  return result;
}
export async function cloudProjectScope(): Promise<string> {
  const client = getSupabaseClient();
  const { data, error } = await client!.auth.getUser();
  if (error || !data.user) throw new Error("Sign in again to resume uploads.");
  return `${new URL(import.meta.env.VITE_SUPABASE_URL).origin}:${data.user.id}:project:${activeProjectId}`;
}
export async function uploadProjectFile(
  asset: Asset,
  blob: Blob,
  progress: (value: number) => void,
  control: UploadControl,
): Promise<Asset> {
  const client = getSupabaseClient()!;
  const scope = await cloudProjectScope();
  if (control.scope && control.scope !== scope)
    throw new Error("This upload belongs to another account or project.");
  if (control.recover) {
    const existing = await cloudProjectRequest({
      action: "asset-read",
      assetId: asset.id,
    });
    if (existing) {
      if (
        existing.hash !== asset.hash ||
        existing.path !== asset.path ||
        existing.pack !== asset.pack
      )
        throw new Error("This asset ID is already in use.");
      progress(100);
      return existing;
    }
    const object = await client.storage
      .from("builder-project-files")
      .info(`${activeProjectId}/${asset.id}`);
    if (object.data)
      return cloudProjectRequest({ action: "register-asset", asset });
  }
  const base = new URL(import.meta.env.VITE_SUPABASE_URL);
  if (/^[\w-]+\.supabase\.co$/.test(base.hostname))
    base.hostname = base.hostname.replace(
      ".supabase.co",
      ".storage.supabase.co",
    );
  await resumableUpload(blob, {
    ...control,
    progress,
    endpoint: new URL("/storage/v1/upload/resumable", base).href,
    metadata: {
      bucketName: "builder-project-files",
      objectName: `${activeProjectId}/${asset.id}`,
      contentType: asset.mime,
      cacheControl: "3600",
      metadata: JSON.stringify({ hash: asset.hash }),
    },
    headers: async () => {
      if ((await cloudProjectScope()) !== scope)
        throw new Error(
          "The signed-in account changed. Resume with the original account.",
        );
      const { data, error } = await client.auth.getSession();
      if (error || !data.session)
        throw new Error("Sign in again to resume this upload.");
      return { authorization: `Bearer ${data.session.access_token}` };
    },
  });
  return cloudProjectRequest({ action: "register-asset", asset });
}
