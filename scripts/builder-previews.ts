import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  unlink,
  rename,
  link,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  createPrivatePreview,
  isPreviewId,
  previewSummary,
  type PrivatePreview,
  type PreviewDuration,
} from "../shared/builderPreviews";
import type { PageDocument } from "../shared/visualBuilder";

/** Called inside the existing local builder's serialised, loopback-only action queue. */
export async function localPreviewAction(
  directory: string,
  input: {
    action: string;
    id?: string;
    document?: PageDocument;
    hours?: PreviewDuration;
  },
  now = Date.now(),
) {
  const root = path.join(directory, "previews");
  if (input.action !== "preview-list" && !isPreviewId(input.id))
    throw new Error("Invalid preview ID.");
  const filename = path.join(root, `${input.id}.json`);
  type StoredPreview = Omit<PrivatePreview, "document"> & {
    document: PageDocument | null;
    revokedAt?: string;
  };
  async function read(file: string): Promise<StoredPreview | undefined> {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  async function write(file: string, record: StoredPreview, exclusive = false) {
    await mkdir(root, { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(record), {
      flag: "wx",
      mode: 0o600,
    });
    try {
      if (exclusive) await link(temporary, file);
      else {
        for (let attempt = 0; ; attempt++) {
          try {
            await rename(temporary, file);
            break;
          } catch (error) {
            if (
              process.platform !== "win32" ||
              !["EPERM", "EBUSY", "EACCES"].includes(
                (error as NodeJS.ErrnoException).code || "",
              ) ||
              attempt >= 5
            )
              throw error;
            await new Promise((resolve) =>
              setTimeout(resolve, 50 * 2 ** attempt),
            );
          }
        }
      }
    } finally {
      await unlink(temporary).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  async function active(prune = false) {
    let files: string[];
    try {
      files = await readdir(root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const records: PrivatePreview[] = [];
    for (const file of files) {
      if (!file.endsWith(".json") || !isPreviewId(file.slice(0, -5))) continue;
      const record = await read(path.join(root, file));
      if (!record) continue;
      if (
        record.document &&
        !record.revokedAt &&
        Date.parse(record.expiresAt) > now
      )
        records.push(record as PrivatePreview);
      else if (prune && record.document)
        await write(path.join(root, file), { ...record, document: null });
    }
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (input.action === "preview-list")
    return (await active()).map(previewSummary);
  if (input.action === "preview-revoke") {
    const record = await read(filename);
    if (record && !record.revokedAt)
      await write(filename, {
        ...record,
        document: null,
        revokedAt: new Date(now).toISOString(),
      });
    return true;
  }
  if (input.action === "preview-read") {
    const record = await read(filename);
    if (
      !record?.document ||
      record.revokedAt ||
      Date.parse(record.expiresAt) <= now
    )
      throw new Error(
        "This preview has expired, was revoked, or does not exist.",
      );
    return record;
  }
  if (input.action !== "preview-create")
    throw new Error("Unsupported preview action.");
  const created = createPrivatePreview(
    input.id!,
    input.document!,
    input.hours!,
    now,
  );
  const existing = await read(filename);
  if (existing) {
    if (
      !existing.document ||
      existing.revokedAt ||
      Date.parse(existing.expiresAt) <= now
    )
      throw new Error(
        "This preview has expired or was revoked. Create a new preview.",
      );
    if (
      JSON.stringify(existing.document) !== JSON.stringify(created.document) ||
      Date.parse(existing.expiresAt) - Date.parse(existing.createdAt) !==
        input.hours! * 3_600_000
    )
      throw new Error("Preview ID was already used for a different snapshot");
    return previewSummary(existing as PrivatePreview);
  }
  if ((await active(true)).length >= 50)
    throw new Error(
      "There are already 50 active previews. Revoke an old preview before creating another.",
    );
  await write(filename, created, true);
  return previewSummary(created);
}
