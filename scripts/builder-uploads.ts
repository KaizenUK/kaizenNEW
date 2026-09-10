import { Server } from "@tus/server";
import { FileStore } from "@tus/file-store";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type { Asset } from "../shared/visualBuilder";

const MAX_FILE = 50 * 1024 * 1024;
function validate(asset: Asset, size: number) {
  if (
    !asset ||
    !/^[a-f0-9-]{36}$/.test(asset.id) ||
    !/^[a-f0-9]{64}$/.test(asset.hash) ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > MAX_FILE ||
    asset.size !== size ||
    typeof asset.name !== "string" ||
    typeof asset.path !== "string" ||
    typeof asset.pack !== "string" ||
    typeof asset.mime !== "string"
  )
    throw new Error("Invalid upload metadata or file size.");
}
function within(root: string, id: string) {
  const target = path.resolve(root, id);
  if (
    !/^[a-f0-9-]+$/.test(id) ||
    !target.startsWith(path.resolve(root) + path.sep)
  )
    throw new Error("Invalid upload path.");
  return target;
}
export function localUploadServer(directory: string) {
  const uploadDirectory = path.resolve(directory, "uploads"),
    assetsDirectory = path.resolve(directory, "assets");
  const datastore = new FileStore({
    directory: uploadDirectory,
    expirationPeriodInMilliseconds: 24 * 60 * 60 * 1000,
  });
  const server = new Server({
    path: "/__builder-upload",
    datastore,
    maxSize: MAX_FILE,
    allowedOrigins: [],
    relativeLocation: true,
    respectForwardedHeaders: false,
    onUploadCreate: async (_request, upload) => {
      try {
        validate(JSON.parse(upload.metadata?.asset || "null"), upload.size!);
        await datastore.deleteExpired();
        return {};
      } catch {
        throw { status_code: 400, body: "Invalid builder upload metadata." };
      }
    },
  });
  return {
    handle: server.handle.bind(server),
    async finish(uploadUrl: string, asset: Asset): Promise<Asset> {
      const url = new URL(uploadUrl, "http://localhost");
      if (!/^\/__builder-upload\/[a-f0-9-]+$/.test(url.pathname))
        throw new Error("Invalid upload address.");
      const id = url.pathname.split("/").pop()!;
      const upload = await datastore.getUpload(id);
      validate(asset, upload.size!);
      if (
        upload.offset !== upload.size ||
        upload.metadata?.asset !== JSON.stringify(asset)
      )
        throw new Error(
          "This upload is incomplete or its metadata changed. Resume the original import.",
        );
      const bytes = await readFile(within(uploadDirectory, id));
      if (
        bytes.length !== asset.size ||
        createHash("sha256").update(bytes).digest("hex") !== asset.hash
      )
        throw new Error(
          "The uploaded file did not match its checksum. Discard the pending import and select the file again.",
        );
      await mkdir(assetsDirectory, { recursive: true });
      const destination = within(assetsDirectory, asset.id);
      try {
        await copyFile(
          within(uploadDirectory, id),
          destination,
          constants.COPYFILE_EXCL,
        );
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code !== "EEXIST" ||
          createHash("sha256")
            .update(await readFile(destination))
            .digest("hex") !== asset.hash
        )
          throw error;
      }
      const extension =
        asset.name
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "bin";
      return { ...asset, url: `/builder-media/${asset.id}.${extension}` };
    },
    async release(uploadUrl: string) {
      const id = new URL(uploadUrl, "http://localhost").pathname
        .split("/")
        .pop()!;
      within(uploadDirectory, id); // Validate the resolved target before the file store removes it.
      await datastore.remove(id);
    },
  };
}
