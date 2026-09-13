export class HostedHelperError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type RepositoryActor = {
  id: string;
  expiresAt: number;
  name?: string;
  email?: string;
};
export function repositoryAuthor(actor: RepositoryActor) {
  if (
    !actor.name?.trim() ||
    actor.name.length > 200 ||
    /[<>\u0000-\u001f\u007f]/.test(actor.name) ||
    !actor.email ||
    actor.email.length > 254 ||
    !/^[^\s<>@\u0000-\u001f\u007f]+@[^\s<>@\u0000-\u001f\u007f]+\.[^\s<>@\u0000-\u001f\u007f]+$/.test(
      actor.email,
    )
  )
    throw new HostedHelperError(
      409,
      "Your account needs a name and valid email before saving to the website. Ask the owner to complete your account details.",
    );
  return { name: actor.name.trim(), email: actor.email };
}
export const accountId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value,
  );

/** Authenticate with Auth, then use the existing database access function as the caller.
 * No service-role credential, local token decoding alone, or membership cache grants access. */
export class HostedRepositoryAccess {
  private origin: URL;
  constructor(
    private options: { url: string; anonKey: string; fetch?: typeof fetch },
  ) {
    try {
      this.origin = new URL(options.url);
      if (
        this.origin.protocol !== "https:" ||
        this.origin.username ||
        this.origin.password ||
        this.origin.pathname !== "/" ||
        this.origin.search ||
        this.origin.hash ||
        !options.anonKey ||
        /[\r\n]/.test(options.anonKey)
      )
        throw new Error();
    } catch {
      throw new HostedHelperError(
        503,
        "Configure the hosted helper's Supabase URL and API key.",
      );
    }
  }
  private async request(route: string, token: string, body?: unknown) {
    let response: Response;
    try {
      response = await (this.options.fetch || fetch)(
        new URL(route, this.origin),
        {
          method: body === undefined ? "GET" : "POST",
          headers: {
            apikey: this.options.anonKey,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new HostedHelperError(
        503,
        "Project access could not be checked. Reconnect and try again.",
      );
    }
    if (!response.ok)
      throw new HostedHelperError(
        response.status === 401 || response.status === 403 ? 401 : 503,
        response.status === 401 || response.status === 403
          ? "Your sign-in expired. Sign in again to use the hosted helper."
          : "Project access could not be checked. Reconnect and try again.",
      );
    try {
      return await response.json();
    } catch {
      throw new HostedHelperError(
        503,
        "Project access returned an invalid response.",
      );
    }
  }
  async verify(token: string): Promise<RepositoryActor> {
    if (
      typeof token !== "string" ||
      token.length > 8192 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
    )
      throw new HostedHelperError(401, "Sign in to use the hosted helper.");
    const user = await this.request("/auth/v1/user", token);
    let claims: any;
    try {
      claims = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
      );
    } catch {
      throw new HostedHelperError(
        401,
        "Your sign-in is invalid. Sign in again.",
      );
    }
    if (
      !accountId(user?.id) ||
      claims.sub !== user.id ||
      claims.role !== "authenticated" ||
      !Number.isFinite(claims.exp) ||
      claims.exp * 1000 <= Date.now()
    )
      throw new HostedHelperError(
        401,
        "Your sign-in expired. Sign in again to use the hosted helper.",
      );
    const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
    return {
      id: user.id,
      expiresAt: claims.exp * 1000,
      ...(typeof name === "string" ? { name } : {}),
      ...(typeof user.email === "string" ? { email: user.email } : {}),
    };
  }
  async requireProject(
    token: string,
    actor: RepositoryActor,
    projectId: string,
  ) {
    if (actor.expiresAt <= Date.now())
      throw new HostedHelperError(401, "Your sign-in expired. Sign in again.");
    const allowed = await this.request(
      "/rest/v1/rpc/builder_project_access",
      token,
      { target: projectId, capability: "edit", actor: actor.id },
    );
    if (allowed !== true)
      throw new HostedHelperError(
        403,
        "Project access ended or the project is archived. Ask its owner to check your access.",
      );
  }
}
