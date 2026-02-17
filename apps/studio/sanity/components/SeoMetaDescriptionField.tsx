import type { FieldProps } from "sanity";

function includesKeyword(value: string, keyword: string): boolean {
  if (!keyword) return true;
  return value.toLowerCase().includes(keyword.toLowerCase());
}

export function SeoMetaDescriptionField(props: FieldProps<string>) {
  const value = typeof props.value === "string" ? props.value.trim() : "";
  const parent = (props.parent ?? {}) as { focusKeyword?: string };
  const focusKeyword =
    typeof parent.focusKeyword === "string" ? parent.focusKeyword.trim() : "";

  const length = value.length;
  const lengthOk = length >= 50 && length <= 160;
  const keywordPresent = includesKeyword(value, focusKeyword);

  return (
    <div>
      {props.renderDefault(props)}
      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span
          style={{
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
            color: length === 0 ? "#6b7280" : lengthOk ? "#4ade80" : "#fbbf24",
          }}
        >
          {length}/160 chars
        </span>
        <span
          style={{
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.1)",
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
            color: focusKeyword
              ? keywordPresent
                ? "#4ade80"
                : "#fbbf24"
              : "#6b7280",
          }}
        >
          {focusKeyword
            ? keywordPresent
              ? "Keyword in description"
              : "Keyword missing"
            : "Set focus keyword"}
        </span>
      </div>
    </div>
  );
}
