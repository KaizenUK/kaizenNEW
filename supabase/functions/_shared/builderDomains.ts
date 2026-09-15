import { isIP } from "node:net";
import {
  assertUnreservedDomain,
  normalizeDomainHostname,
} from "../../../shared/builderDomains.ts";

type DomainConfiguration = {
  workerId: string;
  reservedHostnames: string[];
  ipv4: string[];
  ipv6: string[];
};

/** This value is server configuration. None of it is read from a project action. */
export function domainConfiguration(
  value: string | undefined,
): DomainConfiguration | null {
  if (!value || value.length > 16000) return null;
  try {
    const parsed = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed.workerId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(parsed.workerId) ||
      !Array.isArray(parsed.ipv4) ||
      !Array.isArray(parsed.ipv6) ||
      parsed.ipv4.length + parsed.ipv6.length < 1 ||
      parsed.ipv4.length + parsed.ipv6.length > 16 ||
      !Array.isArray(parsed.reservedHostnames) ||
      parsed.reservedHostnames.length > 100 ||
      parsed.ipv4.some(
        (value: unknown) => typeof value !== "string" || isIP(value) !== 4,
      ) ||
      parsed.ipv6.some(
        (value: unknown) => typeof value !== "string" || isIP(value) !== 6,
      )
    )
      return null;
    return {
      workerId: parsed.workerId,
      reservedHostnames: parsed.reservedHostnames.map(normalizeDomainHostname),
      ipv4: [...new Set<string>(parsed.ipv4)].sort(),
      ipv6: [
        ...new Set<string>(
          parsed.ipv6.map((value: string) =>
            new URL(`http://[${value}]/`).hostname.slice(1, -1),
          ),
        ),
      ].sort(),
    };
  } catch {
    return null;
  }
}

const idPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export async function domainProjectAction({
  service,
  projectId,
  actor,
  input,
  configuration,
}: {
  service: {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ data: any; error: any }>;
  };
  projectId: string;
  actor: string;
  input: Record<string, unknown>;
  configuration?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const configured = domainConfiguration(configuration);
  const hosting = configured
    ? { ipv4: configured.ipv4, ipv6: configured.ipv6 }
    : null;
  const respond = (status: number, error: string) => ({
    status,
    body: { error },
  });
  const args: Record<string, unknown> = { target: projectId, actor };
  let routine = "builder_domain_state";
  if (input.action !== "domain-state") {
    const command = {
      "domain-add": "add",
      "domain-verify": "verify",
      "domain-remove": "remove",
    }[String(input.action)];
    if (!command) return respond(400, "Choose a valid domain action.");
    if (typeof input.domainId !== "string" || !idPattern.test(input.domainId)) {
      return respond(400, "Refresh the domain settings before trying again.");
    }
    Object.assign(args, { request_id: input.domainId, command });
    if (command === "add") {
      if (!configured)
        return respond(503, "Website domain setup is not available yet.");
      try {
        args.domain_hostname = normalizeDomainHostname(input.hostname);
        assertUnreservedDomain(
          args.domain_hostname as string,
          configured.reservedHostnames,
        );
      } catch (error) {
        return respond(400, (error as Error).message);
      }
      // A browser-provided token, worker, actor or provider proof is never trusted.
      args.challenge = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("");
      args.worker = configured.workerId;
    } else {
      if (
        !Number.isInteger(input.version) ||
        (input.version as number) < 1 ||
        (input.version as number) > 2147483647
      ) {
        return respond(400, "Refresh the domain status before trying again.");
      }
      if (command === "remove" && input.confirm !== true)
        return respond(400, "Confirm removing this website address.");
      args.expected_version = input.version;
    }
    routine = "builder_domain_request";
  }
  try {
    const { data, error } = await service.rpc(routine, args);
    if (error) {
      if (
        ["P0403", "P0409", "22023"].includes(error.code) &&
        typeof error.message === "string" &&
        error.message.length <= 512
      ) {
        return respond(
          error.code === "P0403" ? 403 : error.code === "22023" ? 400 : 409,
          error.message,
        );
      }
      return respond(
        409,
        "The domain request could not be confirmed. Refresh its status before trying again.",
      );
    }
    if (!data || data.projectId !== projectId)
      return respond(
        502,
        "The website domain status could not be checked. Refresh before trying again.",
      );
    return { status: 200, body: { ...data, hosting } };
  } catch {
    return respond(
      503,
      "The domain request could not be confirmed. Refresh its status before trying again.",
    );
  }
}
