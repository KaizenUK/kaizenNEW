/** Host-worker HTTPS evidence. DNS results never choose the network target. */
import { createHash, X509Certificate } from "node:crypto";
import { request } from "node:https";
import { checkServerIdentity, type TLSSocket } from "node:tls";
import { normalizeDomainHostname } from "../shared/builderDomains";
import {
  normalizeDomainIngress,
  type DomainIngress,
} from "./builder-domain-dns";
import { checkLive } from "./kaizen-releases.mjs";

export class DomainHttpsError extends Error {
  constructor(public reason: "tls_pending" | "routing_failed") {
    super(
      reason === "tls_pending"
        ? "The exact domain certificate could not be verified."
        : "The retained website could not be verified at this domain.",
    );
    this.name = "DomainHttpsError";
  }
}
type CertificateEvidence = {
  certificateSha256: string;
  certificateSerialNumber: string;
  certificateNames: string[];
  certificateSelfSigned: false;
  certificateExpiresAt: string;
};

function certificateEvidence(
  certificate: X509Certificate | undefined,
  hostname: string,
): CertificateEvidence {
  const expires = certificate ? Date.parse(certificate.validTo) : NaN;
  if (
    !certificate ||
    certificate.subjectAltName?.toLowerCase() !== `dns:${hostname}` ||
    certificate.checkHost(hostname, { subject: "never", wildcards: false }) !==
      hostname ||
    certificate.verify(certificate.publicKey) ||
    !Number.isFinite(expires) ||
    expires <= Date.now() + 3600000 ||
    Date.parse(certificate.validFrom) > Date.now()
  )
    throw new DomainHttpsError("tls_pending");
  return {
    certificateSerialNumber:
      certificate.serialNumber.replace(/^0+/, "").toLowerCase() || "0",
    certificateSha256: createHash("sha256")
      .update(certificate.raw)
      .digest("hex"),
    certificateNames: [hostname],
    certificateSelfSigned: false,
    certificateExpiresAt: new Date(expires).toISOString(),
  };
}

type Options = {
  hostname: string;
  ingress: DomainIngress;
  /** The retained store's original identity, also when checking an alias. */
  origin: string;
  /** Already verified by verifyRelease against the retained files. */
  manifest: any;
};
type TransportOptions = {
  /** Trusted test harness only; production calls use port 443 and system roots. */
  port?: number;
  ca?: string | Buffer;
  timeout?: number;
};

/** Checks every configured ingress, retaining the original marker/client identity. */
export async function verifyDomainHttps(
  input: Options,
  transport: TransportOptions = {},
) {
  const hostname = normalizeDomainHostname(input.hostname);
  if (hostname !== input.hostname) throw new DomainHttpsError("routing_failed");
  const ingress = normalizeDomainIngress(input.ingress);
  const original = new URL(input.origin),
    alias = new URL(`https://${hostname}`);
  const port = transport.port ?? 443,
    timeout = transport.timeout ?? 15000;
  if (
    original.origin !== input.origin ||
    original.protocol !== "https:" ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isSafeInteger(timeout) ||
    timeout < 1 ||
    timeout > 60000
  )
    throw new DomainHttpsError("routing_failed");
  let certificate: CertificateEvidence | undefined;
  const operation = new AbortController();
  let checked = 0;
  // Response buffering is bounded by the actual retained artifact, with space
  // for error/redirect bodies and older release markers. Never trust HTTP size.
  let maxBytes = 65536;
  for (const file of input.manifest.files) {
    if (!Number.isSafeInteger(file.size) || file.size < 0)
      throw new DomainHttpsError("routing_failed");
    maxBytes = Math.max(maxBytes, file.size);
  }
  for (const address of [...ingress.ipv4, ...ingress.ipv6]) {
    const fetcher = async (requested: URL, init: RequestInit) => {
      const url = new URL(requested);
      if (
        url.origin !== original.origin ||
        url.username ||
        url.password ||
        !["error", "manual"].includes(init.redirect || "")
      )
        throw new DomainHttpsError("routing_failed");
      return new Promise<Response>((resolve, reject) => {
        const fail = (error: any) =>
          reject(
            error instanceof DomainHttpsError
              ? error
              : new DomainHttpsError(
                  /CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/.test(
                    error?.code || "",
                  )
                    ? "tls_pending"
                    : "routing_failed",
                ),
          );
        const req = request(
          {
            // Numeric operator-configured address: no DNS lookup or redirect.
            hostname: address,
            port,
            servername: hostname,
            method: "GET",
            path: url.pathname + url.search,
            agent: false,
            ca: transport.ca,
            rejectUnauthorized: true,
            checkServerIdentity: (_name, peer) => {
              const invalid = checkServerIdentity(hostname, peer);
              if (invalid) return invalid;
              try {
                certificateEvidence(new X509Certificate(peer.raw), hostname);
                return undefined;
              } catch {
                return new DomainHttpsError("tls_pending");
              }
            },
            signal: AbortSignal.any([
              operation.signal,
              AbortSignal.timeout(timeout),
              ...(init.signal ? [init.signal] : []),
            ]),
            headers: {
              Host: hostname,
              "Cache-Control": "no-cache",
              "X-Requested-With": "XMLHttpRequest",
              Connection: "close",
            },
          },
          async (response) => {
            try {
              const socket = response.socket as TLSSocket;
              if (!socket.authorized) throw new DomainHttpsError("tls_pending");
              const observed = certificateEvidence(
                socket.getPeerX509Certificate(),
                hostname,
              );
              if (
                certificate &&
                certificate.certificateSha256 !== observed.certificateSha256
              )
                throw new DomainHttpsError("tls_pending");
              certificate = observed;
              const chunks: Buffer[] = [];
              let size = 0;
              for await (const chunk of response) {
                size += chunk.length;
                if (size > maxBytes)
                  throw new DomainHttpsError("routing_failed");
                chunks.push(Buffer.from(chunk));
              }
              const headers = new Headers();
              for (let i = 0; i < response.rawHeaders.length; i += 2)
                headers.append(
                  response.rawHeaders[i],
                  response.rawHeaders[i + 1],
                );
              // checkLive retains the original client's origin/marker binding.
              // Translate only a same-alias absolute Location to that origin;
              // relative and unrelated external redirects stay unchanged.
              const location = headers.get("location");
              if (location && /^https:\/\//i.test(location)) {
                const redirected = new URL(location);
                if (redirected.origin === alias.origin) {
                  redirected.host = original.host;
                  headers.set("location", redirected.href);
                }
              }
              const status = response.statusCode || 500;
              resolve(
                new Response(
                  [204, 205, 304].includes(status)
                    ? null
                    : new Uint8Array(Buffer.concat(chunks)),
                  { status, headers },
                ),
              );
            } catch (error) {
              response.destroy();
              req.destroy();
              fail(error);
            }
          },
        );
        req.once("error", fail);
        req.end();
      });
    };
    try {
      const result = await checkLive(input.origin, input.manifest, {
        fetcher,
        timeout,
      });
      checked += result.checked;
    } catch (error) {
      operation.abort();
      throw error instanceof DomainHttpsError
        ? error
        : new DomainHttpsError("routing_failed");
    }
  }
  if (!certificate) throw new DomainHttpsError("tls_pending");
  return { ...certificate, verifiedAt: new Date().toISOString(), checked };
}
