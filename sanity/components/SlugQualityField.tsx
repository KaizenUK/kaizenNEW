import type { FieldProps } from "sanity";

const MUST_REMOVE_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "for",
  "in",
  "on",
  "at",
  "to",
  "from",
  "with",
  "by",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "it",
  "its",
  "that",
  "this",
  "these",
  "those",
]);

const NICE_TO_REMOVE_STOP_WORDS = new Set([
  "your",
  "my",
  "their",
  "our",
  "we",
  "you",
  "they",
  "he",
  "she",
  "him",
  "her",
  "who",
  "which",
  "what",
  "where",
  "when",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "can",
  "will",
  "just",
  "should",
  "now",
]);

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function SlugQualityField(
  props: FieldProps<{ _type?: "slug"; current?: string }>,
) {
  const current = String(props.value?.current ?? "").trim().toLowerCase();
  const tokens = current
    .split("-")
    .map((token) => token.trim())
    .filter(Boolean);

  const mustFound = unique(
    tokens.filter((token) => MUST_REMOVE_STOP_WORDS.has(token)),
  );
  const niceFound = unique(
    tokens.filter((token) => NICE_TO_REMOVE_STOP_WORDS.has(token)),
  );

  const suggested = tokens
    .filter(
      (token) =>
        !MUST_REMOVE_STOP_WORDS.has(token) &&
        !NICE_TO_REMOVE_STOP_WORDS.has(token),
    )
    .join("-");

  return (
    <div>
      {props.renderDefault(props)}
      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
        <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>
          Google usually ignores common stop words in URLs. Keep slugs concise
          and keyword-focused.
        </p>

        {mustFound.length > 0 && (
          <p style={{ margin: 0, fontSize: 11, color: "#f87171", fontWeight: 700 }}>
            Remove: {mustFound.join(", ")}
          </p>
        )}

        {niceFound.length > 0 && (
          <p style={{ margin: 0, fontSize: 11, color: "#fbbf24", fontWeight: 600 }}>
            Consider removing: {niceFound.join(", ")}
          </p>
        )}

        {suggested && suggested !== current && (
          <p style={{ margin: 0, fontSize: 11, color: "#4ade80" }}>
            Suggested slug: <code>{suggested}</code>
          </p>
        )}
      </div>
    </div>
  );
}

