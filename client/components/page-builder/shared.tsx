import type { SanityCallToAction } from "../../../src/lib/sanity/client";

type TableCellValue = {
  content?: string;
};

type TableRowValue = {
  cells?: TableCellValue[];
};

type TableValue = {
  caption?: string;
  hasHeaderRow?: boolean;
  rows?: TableRowValue[];
};

// ── CTA Button ─────────────────────────────────────────────────────

export function CtaButton({ cta }: { cta: SanityCallToAction }) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition";
  const primary =
    "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_10px_25px_rgba(34,211,238,0.35)] hover:scale-[1.02]";
  const ghost =
    "border border-white/20 text-white hover:border-cyan-400 hover:text-cyan-200";
  return (
    <a
      href={cta.href}
      target={cta.newTab ? "_blank" : undefined}
      rel={cta.newTab ? "noopener noreferrer" : undefined}
      className={`${base} ${cta.style === "ghost" ? ghost : primary}`}
    >
      {cta.label}
    </a>
  );
}

// ── Section Heading ────────────────────────────────────────────────

export function SectionHeading({ text }: { text: string }) {
  return (
    <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
      {text}
    </h2>
  );
}

function normalizeTableRows(value: TableValue): string[][] {
  if (!Array.isArray(value.rows)) return [];

  return value.rows
    .map((row) =>
      Array.isArray(row?.cells)
        ? row.cells.map((cell) =>
            typeof cell?.content === "string" ? cell.content.trim() : "",
          )
        : [],
    )
    .filter((row) => row.length > 0 && row.some((cell) => cell.length > 0));
}

// ── Portable Text components (for RichTextSection) ─────────────────

export const portableComponents = {
  block: {
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="mb-4 mt-10 text-2xl font-bold text-white">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="mb-3 mt-8 text-xl font-bold text-white">{children}</h3>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="mb-2 mt-6 text-lg font-semibold text-white">{children}</h4>
    ),
    normal: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-4 leading-relaxed text-gray-300">{children}</p>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="my-6 border-l-4 border-cyan-400 pl-4 text-gray-300 italic">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <ul className="mb-4 list-disc space-y-2 pl-6 text-gray-300">{children}</ul>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <ol className="mb-4 list-decimal space-y-2 pl-6 text-gray-300">{children}</ol>
    ),
  },
  marks: {
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm text-cyan-300">
        {children}
      </code>
    ),
    link: ({ value, children }: { value?: { href?: string }; children?: React.ReactNode }) => (
      <a
        href={value?.href}
        className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
        target={value?.href?.startsWith("http") ? "_blank" : undefined}
        rel={value?.href?.startsWith("http") ? "noopener noreferrer" : undefined}
      >
        {children}
      </a>
    ),
  },
  types: {
    image: ({ value }: { value?: { url?: string; alt?: string } }) =>
      value?.url ? (
        <img
          src={value.url}
          alt={value.alt ?? ""}
          className="my-6 w-full rounded-xl border border-white/10"
        />
      ) : null,
    callToAction: ({ value }: { value?: SanityCallToAction }) =>
      value ? (
        <div className="my-6">
          <CtaButton cta={value} />
        </div>
      ) : null,
    table: ({ value }: { value?: TableValue }) => {
      if (!value) return null;

      const rows = normalizeTableRows(value);
      if (rows.length === 0) return null;

      const hasHeaderRow = value.hasHeaderRow !== false;
      const [headerRow, ...bodyRows] = rows;
      const tableRows = hasHeaderRow ? bodyRows : rows;

      return (
        <figure className="my-8 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm text-gray-200">
              {hasHeaderRow && headerRow ? (
                <thead className="bg-white/[0.04]">
                  <tr>
                    {headerRow.map((cell, index) => (
                      <th
                        key={`head-${index}`}
                        scope="col"
                        className="border-b border-white/10 px-4 py-3 font-semibold text-white"
                      >
                        <span className="whitespace-pre-line">{cell}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {(tableRows.length > 0 ? tableRows : hasHeaderRow ? [] : rows).map(
                  (row, rowIndex) => (
                    <tr key={`row-${rowIndex}`} className="align-top">
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`cell-${rowIndex}-${cellIndex}`}
                          className="border-t border-white/10 px-4 py-3 text-gray-300"
                        >
                          <span className="whitespace-pre-line">{cell}</span>
                        </td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          {value.caption ? (
            <figcaption className="border-t border-white/10 px-4 py-3 text-sm text-gray-400">
              {value.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    },
  },
};
