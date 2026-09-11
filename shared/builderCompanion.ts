export type CompanionIdentity = {
  origin: string;
  accountId: string;
  projectId: string;
  projectName: string;
};

export function companionIdentity(value: unknown): CompanionIdentity {
  const input = value as CompanionIdentity;
  if (!input || typeof input !== "object")
    throw new Error("Invalid connection identity.");
  const origin = new URL(input.origin);
  if (
    origin.origin !== input.origin ||
    !["http:", "https:"].includes(origin.protocol)
  )
    throw new Error("Invalid builder origin.");
  for (const key of ["accountId", "projectId", "projectName"] as const)
    if (
      typeof input[key] !== "string" ||
      !input[key].trim() ||
      input[key].length > 100 ||
      /[\u0000-\u001f]/.test(input[key])
    )
      throw new Error("Invalid connection identity.");
  return {
    origin: input.origin,
    accountId: input.accountId,
    projectId: input.projectId,
    projectName: input.projectName,
  };
}

export function localCompanionOrigin(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Use a localhost address, such as http://127.0.0.1:4321.");
  return url.origin;
}
