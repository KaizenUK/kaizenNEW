import { ArrowUpRight } from "@untitledui/icons";

interface Props {
  href: string;
  title: string;
  excerpt?: string;
  publishedAt?: string;
  publishedLabel: string;
  readTime?: number;
  authorName?: string;
  image?: { src: string; alt: string } | null;
  eager?: boolean;
}

/** Static adaptation of Untitled UI's Simple 01 image/title/author card. */
export function GuideCard({ href, title, excerpt, publishedAt, publishedLabel, readTime, authorName, image, eager }: Props) {
  const titleId = `guide-${href.split("/").filter(Boolean).pop()}`;
  return (
    <article className="min-w-0">
      <a href={href} aria-labelledby={titleId} className="group flex h-full flex-col rounded-2xl text-left outline-uui-brand focus-visible:outline-2 focus-visible:outline-offset-4">
        {image && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            <img src={image.src} alt={image.alt} width={720} height={420} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} decoding="async" className="aspect-[12/7] h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none" />
          </div>
        )}
        <div className="flex flex-1 flex-col pt-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-600">
            <time dateTime={publishedAt}>{publishedLabel}</time>
            {readTime ? <><span aria-hidden="true">·</span><span>{readTime} min read</span></> : null}
          </div>
          <div className="mt-3 flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-heading text-2xl font-bold text-kaizen-dark transition-colors group-hover:text-uui-brand-800">{title}</h2>
            <ArrowUpRight aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-uui-brand-700" />
          </div>
          {excerpt && <p className="mt-3 text-base leading-relaxed text-slate-600">{excerpt}</p>}
          <p className="mt-auto pt-5 text-sm font-semibold text-slate-700">{authorName ?? "Kaizen"}</p>
        </div>
      </a>
    </article>
  );
}
