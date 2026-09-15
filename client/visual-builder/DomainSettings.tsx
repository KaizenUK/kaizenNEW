import React, { useEffect, useId, useRef, useState } from "react";
import { Card, Notice, Pill } from "./shell";
import {
  domainHttpsReady,
  domainOperationRunning,
  normalizeDomainHostname,
  websiteDomainMessage,
  websiteDomainStatus,
  type WebsiteDomainState,
} from "../../shared/builderDomains";
import { websiteDomainRequest, type DomainRequest } from "./domainService";

type Props = {
  accountId: string;
  projectId: string;
  onState?: (state: WebsiteDomainState) => void;
};
export default function DomainSettings(props: Props) {
  // Do not render the previous account's fields for even one frame on a switch.
  return (
    <DomainSettingsScope
      key={`${props.accountId}:${props.projectId}`}
      {...props}
    />
  );
}

function DomainSettingsScope({ accountId, projectId, onState }: Props) {
  const [summary, setSummary] = useState<WebsiteDomainState>();
  const [busy, setBusy] = useState(true),
    [hostname, setHostname] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    id: string;
    version: number;
  } | null>(null);
  const mounted = useRef(false),
    pending = useRef(false),
    sequence = useRef(0);
  const pendingAdd = useRef<{ hostname: string; id: string } | null>(null);
  const title = useRef<HTMLSpanElement>(null),
    removeButton = useRef<HTMLButtonElement>(null);
  const confirmationPanel = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const focusAfterChange = useRef(false),
    inputId = useId();
  const domain = summary?.domain;

  async function run(
    action: DomainRequest = { action: "domain-state" },
    automatic = false,
  ) {
    if (!mounted.current || pending.current) return;
    pending.current = true;
    const revision = ++sequence.current;
    setBusy(true);
    if (!automatic) {
      setError("");
      setNotice("");
    }
    try {
      const result = await websiteDomainRequest(accountId, projectId, action);
      if (!mounted.current || sequence.current !== revision) return;
      if (result.domain) pendingAdd.current = null;
      setSummary(result);
      onState?.(result);
      setError("");
      setConfirmation((current) =>
        current &&
        result.canManage &&
        current.id === result.domain?.id &&
        current.version === result.domain?.version
          ? current
          : null,
      );
      if (action.action !== "domain-state") {
        setConfirmation(null);
        focusAfterChange.current = true;
        setNotice(
          action.action === "domain-add"
            ? "Domain added. Use the records below to connect it."
            : action.action === "domain-remove"
              ? "Domain removal requested. Your saved work is kept."
              : "Domain check requested.",
        );
      }
    } catch (error) {
      if (!mounted.current || sequence.current !== revision) return;
      setError(
        error instanceof Error
          ? error.message
          : "The domain request could not be confirmed. Refresh its status before trying again.",
      );
      // A lost response requires a read before another mutation. Retain the add
      // request ID so a late commit cannot turn a retry into a second claim.
      setSummary(undefined);
      setConfirmation(null);
    } finally {
      if (sequence.current === revision) {
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    const revision = ++sequence.current;
    queueMicrotask(() => {
      if (mounted.current && revision === sequence.current) void run();
    });
    return () => {
      mounted.current = false;
      sequence.current++;
      pending.current = false;
    };
  }, []);
  useEffect(() => {
    if (confirmation) confirmationPanel.current?.focus();
  }, [confirmation]);
  useEffect(() => {
    if (focusAfterChange.current && !busy) {
      focusAfterChange.current = false;
      title.current?.focus();
    }
  }, [summary, busy]);
  useEffect(() => {
    if (!domain || busy || confirmation) return;
    const refreshVisible = () => {
      if (document.visibilityState !== "hidden")
        void run({ action: "domain-state" }, true);
    };
    const timer = window.setInterval(
      refreshVisible,
      domainOperationRunning(domain) ? 5000 : 30000,
    );
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [domain?.id, domain?.status, domain?.version, busy, confirmation]);

  function add(event: React.FormEvent) {
    event.preventDefault();
    if (
      !summary?.canManage ||
      summary.archived ||
      !summary.hosting ||
      domain ||
      pending.current
    )
      return;
    let name: string;
    try {
      name = normalizeDomainHostname(hostname);
    } catch (error) {
      setFieldError((error as Error).message);
      input.current?.focus();
      return;
    }
    setFieldError("");
    if (pendingAdd.current?.hostname !== name)
      pendingAdd.current = { hostname: name, id: crypto.randomUUID() };
    void run({
      action: "domain-add",
      domainId: pendingAdd.current.id,
      hostname: name,
    });
  }
  async function copy(value: string, label: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(value);
      if (mounted.current) setNotice(`${label} copied.`);
    } catch {
      if (mounted.current)
        setNotice(
          "Copying is unavailable. Select the record text and copy it.",
        );
    }
  }
  const running = !!domain && domainOperationRunning(domain);
  const ready = !!domain && domainHttpsReady(domain);
  const records = domain
    ? [
        domain.verification,
        ...(summary?.hosting?.ipv4.map((value) => ({
          type: "A",
          name: domain.hostname,
          value,
        })) || []),
        ...(summary?.hosting?.ipv6.map((value) => ({
          type: "AAAA",
          name: domain.hostname,
          value,
        })) || []),
      ]
    : [];
  return (
    <Card
      className="builder-domains"
      ariaLabel="Website domain"
      title={
        <span ref={title} tabIndex={-1}>
          Website domain
        </span>
      }
      description="Connect the address people use to visit this website."
    >
      <div className="builder-domain-toolbar">
        <button type="button" disabled={busy} onClick={() => void run()}>
          Refresh domain status
        </button>
        {busy && <span role="status">Checking domain status…</span>}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      {summary && !summary.canManage && (
        <p>
          An owner with publishing permission can manage this website’s domain.
        </p>
      )}
      {summary?.archived && (
        <Notice>
          This website is archived. Restore it to connect a domain; an owner can
          still remove an existing address.
        </Notice>
      )}
      {summary && !summary.hosting && (
        <Notice>
          New domain connections are not available yet. You can still check or
          remove an existing address.
        </Notice>
      )}
      {summary &&
        !domain &&
        (summary.canManage && !summary.archived && summary.hosting ? (
          <form
            className="builder-domain-add"
            aria-label="Connect website domain"
            onSubmit={add}
          >
            <label htmlFor={inputId}>Domain name</label>
            <div className="builder-domain-input-row">
              <input
                id={inputId}
                ref={input}
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                placeholder="www.yourwebsite.com"
                value={hostname}
                maxLength={253}
                disabled={busy}
                required
                aria-invalid={!!fieldError}
                aria-describedby={`${inputId}-help${fieldError ? ` ${inputId}-error` : ""}`}
                onChange={(event) => {
                  setHostname(event.target.value);
                  setFieldError("");
                }}
              />
              <button type="submit" className="builder-primary" disabled={busy}>
                Add domain
              </button>
            </div>
            <small id={`${inputId}-help`}>
              Enter one hostname without https://. You’ll need access to its DNS
              settings.
            </small>
            {fieldError && (
              <div role="alert" id={`${inputId}-error`}>
                {fieldError}
              </div>
            )}
          </form>
        ) : (
          <p>No domain is connected to this website.</p>
        ))}
      {domain && (
        <>
          <div className="builder-domain-heading">
            <h3>{domain.hostname}</h3>
            <Pill
              tone={
                ready
                  ? "green"
                  : domain.status === "attention" ||
                      (domain.status === "connected" && !ready)
                    ? "orange"
                    : "grey"
              }
            >
              {websiteDomainStatus(domain)}
            </Pill>
          </div>
          <p>{websiteDomainMessage(domain)}</p>
          {domain.bindingKind !== "client-primary" &&
            domain.status !== "connected" && (
              <p>Your existing website address will keep working.</p>
            )}
          {ready && (
            <div className="builder-domain-actions">
              <a
                href={`https://${domain.hostname}`}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                Open website
              </a>
              {domain.bindingKind === "client-primary" && (
                <a
                  href={`?view=releases&project=${encodeURIComponent(projectId)}`}
                >
                  Open Releases
                </a>
              )}
            </div>
          )}
          {domain.operation !== "remove" && (
            <details
              className="builder-domain-records"
              open={
                domain.status === "waiting_dns" || domain.status === "attention"
              }
            >
              <summary>DNS records</summary>
              <p>
                Add the TXT record to verify ownership, and point this hostname
                to the hosting addresses. Keep the TXT record after connection.
              </p>
              <ol>
                {records.map((record, index) => {
                  const label =
                    record.type === "TXT" ? "TXT" : `${record.type} ${index}`;
                  return (
                    <li
                      key={`${record.type}:${record.value}`}
                      aria-label={`${record.type} record ${index + 1}`}
                    >
                      <h4>
                        {record.type === "TXT"
                          ? "Verify ownership"
                          : "Point to this website"}{" "}
                        <span>{record.type}</span>
                      </h4>
                      <dl>
                        {(["name", "value"] as const).map((field) => (
                          <div key={field}>
                            <dt>{field === "name" ? "Name" : "Value"}</dt>
                            <dd>
                              <code>{record[field]}</code>
                              <button
                                type="button"
                                aria-label={`Copy ${label} ${field}`}
                                onClick={() =>
                                  void copy(
                                    record[field],
                                    `${record.type} ${field}`,
                                  )
                                }
                              >
                                Copy
                              </button>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  );
                })}
              </ol>
              <p className="builder-domain-dns-help">
                If your provider adds the domain to record names automatically,
                enter only the part before it. Replace conflicting A, AAAA or
                CNAME records for this hostname.
              </p>
            </details>
          )}
          {summary?.canManage && (
            <div className="builder-domain-actions">
              {domain.operation === "connect" && !summary.archived && (
                <button
                  type="button"
                  className="builder-primary"
                  disabled={busy || running}
                  onClick={() =>
                    void run({
                      action: "domain-verify",
                      domainId: domain.id,
                      version: domain.version,
                    })
                  }
                >
                  Check domain
                </button>
              )}
              {domain.operation === "connect" && !confirmation && (
                <button
                  ref={removeButton}
                  type="button"
                  disabled={busy || running}
                  onClick={() =>
                    setConfirmation({ id: domain.id, version: domain.version })
                  }
                >
                  Remove domain
                </button>
              )}
              {domain.operation === "remove" &&
                domain.status === "attention" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run({
                        action: "domain-remove",
                        domainId: domain.id,
                        version: domain.version,
                        confirm: true,
                      })
                    }
                  >
                    Retry removal
                  </button>
                )}
            </div>
          )}
          {confirmation && (
            <div
              ref={confirmationPanel}
              tabIndex={-1}
              role="group"
              aria-label="Confirm domain removal"
              className="builder-account-confirm"
            >
              <p>
                Disconnect <strong>{domain.hostname}</strong> from this website?
                Your pages, files and release history will be kept.
                {domain.bindingKind !== "client-primary" &&
                  " Your existing website address will keep working."}
              </p>
              <div className="builder-domain-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run({
                      action: "domain-remove",
                      domainId: confirmation.id,
                      version: confirmation.version,
                      confirm: true,
                    })
                  }
                >
                  Confirm removal
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setConfirmation(null);
                    queueMicrotask(() => removeButton.current?.focus());
                  }}
                >
                  Keep domain
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {!!summary?.history.length && (
        <details className="builder-domain-history">
          <summary>Removed domains</summary>
          <ul>
            {summary.history.map((item) => (
              <li key={item.id}>
                <span>{item.hostname}</span>
                <time dateTime={item.removedAt!}>
                  Removed{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    dateStyle: "medium",
                  }).format(new Date(item.removedAt!))}
                </time>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
