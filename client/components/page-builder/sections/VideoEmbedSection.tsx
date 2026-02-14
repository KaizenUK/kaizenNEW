import type {
  SanityVideoEmbedSection,
  SanitySectionSettings,
} from "../../../../src/lib/sanity/client";
import SectionWrapper from "../SectionWrapper";

type Props = SanityVideoEmbedSection & { settings?: SanitySectionSettings };

function getEmbedUrl(rawUrl?: string): string {
  const url = rawUrl ?? "";
  if (!url) return "";

  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return "";
}

export default function VideoEmbedSection(props: Props) {
  const { url, caption, settings } = props;
  const embedUrl = getEmbedUrl(url);

  if (!embedUrl) return null;

  return (
    <SectionWrapper settings={settings}>
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10">
        <iframe
          src={embedUrl}
          title={caption || "Embedded video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 h-full w-full"
        />
      </div>
      {caption && (
        <p className="mt-3 text-center text-sm text-slate-400">{caption}</p>
      )}
    </SectionWrapper>
  );
}
