import React, { useState } from "react";
import { type Asset, type Block } from "../../shared/visualBuilder";
import {
  availableRegistration,
  conversionBrief,
  conversionDraft,
  conversionLabels,
  type ConversionDraft,
  type ConversionStatus,
} from "../../shared/builderConversions";
import {
  blockRegistry,
  exampleCardRequirements,
  registeredDefaults,
} from "../../shared/builderRegistry";
import { storage } from "./storage";
import { starterBlocks } from "./starters";

export default function ConversionPanel({
  asset,
  assets,
  onAsset,
  onUseBlock,
  notify,
  download,
}: {
  asset: Asset;
  assets: Asset[];
  onAsset: (asset: Asset) => void;
  onUseBlock: (block: Block) => void;
  notify: (message: string) => void;
  download: (name: string, value: string) => void;
}) {
  const [draft, setDraft] = useState<ConversionDraft>(() =>
    conversionDraft(asset, assets),
  );
  const [busy, setBusy] = useState(false),
    [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const registration = availableRegistration(asset, assets);
  const fields = {
    summary: "What should this block do?",
    fields: "Editable content",
    mobile: "Mobile layout",
    behaviour: "Interactions and accessibility",
  };
  async function save(exportBrief = false) {
    setBusy(true);
    setError("");
    try {
      const result = await storage.setAssetConversion(asset, draft);
      onAsset(result);
      // Keep edits made while this explicit save was in flight.
      setDraft((current) =>
        current === draft ? conversionDraft(result, assets) : current,
      );
      if (exportBrief)
        download(
          `integration-${asset.name}.md`,
          conversionBrief(
            result,
            assets.map((item) => (item.id === result.id ? result : item)),
          ),
        );
      notify(
        `Conversion request saved · version ${result.conversion!.version}.`,
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="builder-conversion" aria-label="React block conversion">
      <h3>React block conversion</h3>
      <p>
        Save a brief for a developer to review. Uploaded source stays a
        reference file. Design files need a separate React implementation.
      </p>
      {asset.conversion && (
        <p>
          Saved version {asset.conversion.version} ·{" "}
          {registration
            ? "Reviewed block available"
            : conversionLabels[asset.conversion.status]}
        </p>
      )}
      <label>
        Request title
        <input
          value={draft.title}
          maxLength={160}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      {Object.entries(fields).map(([key, label]) => (
        <label key={key}>
          {label}
          <textarea
            aria-label={label}
            rows={3}
            maxLength={4000}
            value={draft.requirements[key]}
            onChange={(e) =>
              setDraft({
                ...draft,
                requirements: { ...draft.requirements, [key]: e.target.value },
              })
            }
          />
        </label>
      ))}
      {asset.hash ===
        blockRegistry.find((entry) => entry.id === "example-card-v1")?.review.contract.sources.find(
          (source) => source.role === "source",
        )?.hash && (
        <button
          type="button"
          onClick={() =>
            setDraft({ ...draft, requirements: { ...exampleCardRequirements } })
          }
        >
          Use reviewed sample requirements
        </button>
      )}
      <fieldset>
        <legend>Source files, references and licences</legend>
        <p>
          The original file and pack licences are attached by default. Each
          reference records the exact file checksum.
        </p>
        {draft.sources.map((source) => {
          const file = assets.find((item) => item.id === source.assetId);
          return (
            <div key={source.assetId} className="builder-conversion-source">
              <span>
                {file?.path || "Missing file"} <small>({source.role})</small>
              </span>
              {file && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      window.open(
                        await storage.download(file),
                        "_blank",
                        "noopener",
                      );
                    } catch (error) {
                      setError((error as Error).message);
                    }
                  }}
                >
                  Download {file.name}
                </button>
              )}
              {source.assetId !== asset.id && (
                <button
                  type="button"
                  aria-label={`Remove reference ${file?.name || source.assetId}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      sources: draft.sources.filter((item) => item !== source),
                    })
                  }
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
        <label>
          Find a reference
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search file names"
          />
        </label>
        {query.trim() &&
          assets
            .filter(
              (item) =>
                !item.generatedFrom &&
                !draft.sources.some((source) => source.assetId === item.id) &&
                `${item.pack} ${item.path}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            )
            .slice(0, 20)
            .map((file) => (
              <button
                key={file.id}
                type="button"
                disabled={draft.sources.length >= 50}
                onClick={() => {
                  setDraft({
                    ...draft,
                    sources: [
                      ...draft.sources,
                      {
                        assetId: file.id,
                        hash: file.hash,
                        role: file.kind === "licence" ? "licence" : "reference",
                      },
                    ],
                  });
                  setQuery("");
                }}
              >
                Attach {file.path}
              </button>
            ))}
      </fieldset>
      <label>
        Conversion status
        <select
          aria-label="Conversion status"
          value={draft.status}
          onChange={(e) =>
            setDraft({ ...draft, status: e.target.value as ConversionStatus })
          }
        >
          {Object.entries(conversionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Developer notes
        <textarea
          aria-label="Developer notes"
          value={draft.notes}
          rows={3}
          maxLength={8000}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />
      </label>
      <div className="builder-row">
        <button type="button" disabled={busy} onClick={() => void save()}>
          Save conversion request
        </button>
        <button type="button" disabled={busy} onClick={() => void save(true)}>
          Save and export brief
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {registration ? (
        <div className="builder-conversion-reviewed">
          <strong>{registration.name}</strong>
          <p>{registration.description}</p>
          <p>
            Reviewed by {registration.review.reviewer} on{" "}
            {registration.review.date}. Registration: {registration.id}.
          </p>
          <p>{registration.review.notes}</p>
          <button
            type="button"
            onClick={() =>
              onUseBlock({
                ...starterBlocks.Registered(),
                props: {
                  ...starterBlocks.Registered().props,
                  ...registeredDefaults(registration.id),
                },
              })
            }
          >
            Use reviewed block
          </button>
          <p>
            Matches the saved requirements and source files. Save changed
            requirements to check their review status.
          </p>
        </div>
      ) : (
        <p>
          No matching reviewed implementation is installed for this saved
          request. A status change alone does not make it editable.
        </p>
      )}
      {!!asset.conversion?.history.length && (
        <details>
          <summary>Conversion history</summary>
          <ol>
            {[...asset.conversion.history].reverse().map((item) => (
              <li key={item.version}>
                Version {item.version} · {conversionLabels[item.status]} ·{" "}
                {new Date(item.at).toLocaleString()}
                {item.note && <p>{item.note}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
