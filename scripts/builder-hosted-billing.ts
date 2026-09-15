import { HostedHelperError } from "./builder-hosted-auth";
import {
  isNativeOperationInput,
  isNativeAssetPage,
  matchesNativeOperation,
  type NativeOperationInput,
  type NativeOperationReceipt,
  type NativeAssetPage,
} from "../shared/builderNativeOperations";
import {
  measureRepositorySource,
  measureRepositoryOutput,
} from "./builder-repository-usage.mjs";
import {
  helperSignatureHeader,
  helperSignatureKey,
  signHelperBilling,
} from "../shared/builderHelperSignature";
import {
  isRepositoryBillingState,
  isRepositoryUsageState,
  type RepositoryUsageInput,
  type RepositoryUsageState,
  type RepositoryUsageSample,
  type RepositoryBillingIdentity,
  type RepositoryBillingInput,
  type RepositoryBillingState,
} from "../shared/builderRepositoryBilling";

/** Uses a narrow helper signature plus the real user's bearer, never a database
 * service-role credential. Requests are fenced by the durable attempt number. */
export class HostedRepositoryBilling {
  private endpoint: string;
  private key: Promise<CryptoKey>;
  constructor(
    private options: {
      url: string;
      anonKey: string;
      secret: string;
      fetch?: typeof fetch;
    },
  ) {
    const url = new URL(options.url);
    if (
      url.protocol !== "https:" ||
      url.origin + "/" !== url.href ||
      url.username ||
      url.password ||
      !options.anonKey ||
      !/^[a-f0-9]{64}$/.test(options.secret)
    )
      throw new Error("Configure the hosted helper billing connection.");
    this.endpoint = `${url.origin}/functions/v1/builder-billing`;
    this.key = helperSignatureKey(options.secret);
  }
  private async request(
    token: string,
    input: RepositoryBillingInput | RepositoryUsageInput | NativeOperationInput,
  ): Promise<
    | RepositoryBillingState
    | RepositoryUsageState
    | NativeOperationReceipt
    | NativeAssetPage
  > {
    if (!token)
      throw new HostedHelperError(
        401,
        "Sign in before checking publication billing.",
      );
    const unknown = () =>
      new HostedHelperError(
        503,
        input.action.startsWith("native-operation-")
          ? "A website operation could not be confirmed. Existing files remain protected until it is reconciled."
          : "attempt" in input
            ? "Publication billing could not be confirmed. Check publication status before retrying; an allowance may already be reserved."
            : "Website storage could not be confirmed. Refresh before retrying; the earlier request may have completed.",
      );
    let response: Response;
    try {
      response = await (this.options.fetch || fetch)(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.options.anonKey,
          Authorization: `Bearer ${token}`,
          [helperSignatureHeader]: await signHelperBilling(
            await this.key,
            input,
            token,
          ),
        },
        body: JSON.stringify(input),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw unknown();
    }
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw unknown();
    }
    if (!response.ok) {
      const message =
        result &&
        typeof result === "object" &&
        "error" in result &&
        typeof result.error === "string" &&
        result.error.length <= 512
          ? result.error
          : unknown().message;
      throw new HostedHelperError(
        [400, 401, 403, 409, 429].includes(response.status)
          ? response.status
          : 503,
        message,
      );
    }
    const valid = isNativeOperationInput(input)
      ? input.action === "native-operation-assets"
        ? isNativeAssetPage(result, input.id)
        : matchesNativeOperation(result, input)
      : "attempt" in input
        ? isRepositoryBillingState(result) && result.attempt === input.attempt
        : isRepositoryUsageState(result) &&
          (input.action !== "repository-usage-write" ||
            (result.version === input.version! + 1 &&
              result.measurements[input.channel!]?.bytes ===
                input.sample?.bytes &&
              result.measurements[input.channel!]?.revision ===
                input.sample?.revision &&
              result.measurements[input.channel!]?.pages ===
                input.sample?.pages));
    if (!valid) throw unknown();
    return result as RepositoryBillingState | RepositoryUsageState;
  }
  nativeOperation(token: string, input: NativeOperationInput) {
    if (!isNativeOperationInput(input))
      throw new HostedHelperError(400, "Invalid native website operation.");
    // Recovery is authenticated by the helper signature and the exact durable
    // process identity. It must not depend on an expired user's bearer token.
    return this.request(
      input.action === "native-operation-end"
        ? "native-operation-recovery"
        : token,
      input,
    );
  }
  readUsage(token: string, projectId: string) {
    return this.request(token, {
      action: "repository-usage-read",
      projectId,
    }) as Promise<RepositoryUsageState>;
  }
  writeUsage(
    token: string,
    projectId: string,
    version: number,
    channel: "source" | "preview",
    sample: RepositoryUsageSample,
    operation: "observe" | "reserve" | "publish",
  ) {
    return this.request(token, {
      action: "repository-usage-write",
      projectId,
      version,
      channel,
      sample,
      operation,
    }) as Promise<RepositoryUsageState>;
  }
  async source(
    token: string,
    projectId: string,
    sample: { bytes: number; projectedBytes: number; revision: string },
  ) {
    let state = await this.readUsage(token, projectId);
    const current = state.measurements.source;
    if (current?.bytes !== sample.bytes || current.revision !== sample.revision)
      state = await this.writeUsage(
        token,
        projectId,
        state.version,
        "source",
        { bytes: sample.bytes, revision: sample.revision },
        "observe",
      );
    if (sample.projectedBytes !== sample.bytes)
      await this.writeUsage(
        token,
        projectId,
        state.version,
        "source",
        { bytes: sample.projectedBytes, revision: sample.revision },
        "reserve",
      );
  }
  async output(
    token: string,
    projectId: string,
    root: string,
    fingerprint: string,
    files: ReadonlyMap<string, Buffer>,
  ) {
    const source = await measureRepositorySource(root);
    if (source.revision !== fingerprint)
      throw new HostedHelperError(
        409,
        "Website source changed. Build it again before previewing.",
      );
    await this.source(token, projectId, source);
    const state = await this.readUsage(token, projectId);
    await this.writeUsage(
      token,
      projectId,
      state.version,
      "preview",
      { ...measureRepositoryOutput(files), revision: fingerprint },
      "publish",
    );
  }
  reserve(token: string, identity: RepositoryBillingIdentity, attempt: number) {
    return this.request(token, {
      ...identity,
      action: "repository-reserve",
      attempt,
    }) as Promise<RepositoryBillingState>;
  }
  settle(
    token: string,
    identity: RepositoryBillingIdentity,
    state: RepositoryBillingState,
    outcome: "sent" | "live" | "failed",
  ) {
    return this.request(token, {
      ...identity,
      action: "repository-settle",
      attempt: state.attempt,
      outcome,
    }) as Promise<RepositoryBillingState>;
  }
}
