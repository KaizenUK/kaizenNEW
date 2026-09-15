/** Apply only the dedicated hosting account's generated Apache configuration. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, open, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import {
  DomainProviderError,
  type DomainIdentity,
} from "./builder-domain-provider";
import { normalizeDomainHostname } from "../shared/builderDomains";

type Dependencies = {
  run: (binary: string, args: string[]) => Promise<void>;
  readConfig: () => Promise<string>;
};
const canonicalLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

/** Check actual generated virtual hosts, not a marker in an unrelated block. */
export function verifyDomainApacheConfig(
  text: string,
  item: DomainIdentity,
  custom: string | null,
) {
  if (
    normalizeDomainHostname(item.hostname) !== item.hostname ||
    typeof text !== "string" ||
    Buffer.byteLength(text) > 4194304
  )
    throw new DomainProviderError("configuration_changed");
  const marker = `# kaizen-domain-v1 ${item.domainId} ${item.projectId}`;
  const blocks: string[] =
    text.match(/<VirtualHost\b[^>]*>[\s\S]*?<\/VirtualHost\s*>/gi) || [];
  const matches = blocks.filter((block) =>
    [...block.matchAll(/^\s*Server(?:Name|Alias)\s+([^\r\n#]+)/gim)].some(
      (match) =>
        match[1]
          .trim()
          .split(/\s+/)
          .some((name) =>
            [item.hostname, `www.${item.hostname}`].includes(
              name.toLowerCase(),
            ),
          ),
    ),
  );
  if (custom === null) {
    if (matches.length || text.includes(marker))
      throw new DomainProviderError("configuration_changed");
    return;
  }
  if (
    !custom.startsWith(marker + "\n") ||
    !matches.length ||
    matches.some(
      (block) => !canonicalLines(block).includes(canonicalLines(custom)),
    )
  )
    throw new DomainProviderError("configuration_changed");
}

export function domainApacheReload(
  username: string,
  dependencies: Dependencies,
) {
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(username))
    throw new DomainProviderError("configuration_changed");
  return async (item: DomainIdentity, custom: string | null): Promise<void> => {
    try {
      // A direct, scoped task avoids processing unrelated queued server jobs.
      await dependencies.run("/usr/local/directadmin/directadmin", [
        "taskq",
        "--run",
        `action=rewrite&value=httpd&user=${username}`,
      ]);
      verifyDomainApacheConfig(await dependencies.readConfig(), item, custom);
      await dependencies.run("/usr/sbin/apachectl", ["configtest"]);
      await dependencies.run("/usr/bin/systemctl", ["reload", "httpd"]);
      await dependencies.run("/usr/bin/systemctl", [
        "is-active",
        "--quiet",
        "httpd",
      ]);
      verifyDomainApacheConfig(await dependencies.readConfig(), item, custom);
    } catch (error) {
      throw error instanceof DomainProviderError
        ? error
        : new DomainProviderError();
    }
  };
}

/** Root worker factory; no executable, path or shell expression from a project. */
export function localDomainApacheReload(username: string) {
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(username))
    throw new DomainProviderError("configuration_changed");
  const file = `/usr/local/directadmin/data/users/${username}/httpd.conf`;
  const run = promisify(execFile);
  return domainApacheReload(username, {
    run: async (binary, args) => {
      if (process.getuid?.() !== 0) throw new DomainProviderError();
      await run(binary, args, { timeout: 60000, maxBuffer: 65536 });
    },
    readConfig: async () => {
      if (process.getuid?.() !== 0) throw new DomainProviderError();
      const metadata = await lstat(file);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1 ||
        metadata.size > 4194304 ||
        metadata.mode & 0o022 ||
        (await realpath(file)) !== file
      )
        throw new DomainProviderError("configuration_changed");
      const handle = await open(
        file,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const current = await handle.stat();
        if (
          current.dev !== metadata.dev ||
          current.ino !== metadata.ino ||
          current.size > 4194304
        )
          throw new DomainProviderError("configuration_changed");
        return await handle.readFile("utf8");
      } finally {
        await handle.close();
      }
    },
  });
}
