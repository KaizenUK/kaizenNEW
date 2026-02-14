import type {
  SanityImageGallerySection,
  SanitySectionSettings,
} from "../../../../src/lib/sanity/client";
import SectionWrapper from "../SectionWrapper";
import { SectionHeading } from "../shared";

type Props = SanityImageGallerySection & { settings?: SanitySectionSettings };

export default function ImageGallerySection(props: Props) {
  const { heading, images, settings } = props;

  return (
    <SectionWrapper settings={settings}>
      {heading && (
        <div className="mb-12 text-center">
          <SectionHeading text={heading} />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(images || []).map((image, index) => {
          const imageUrl = image?.asset?.url;
          if (!imageUrl) return null;
          return (
            <figure
              key={image._key || `gallery-${index}`}
              className="overflow-hidden rounded-xl border border-white/10"
            >
              <img
                src={imageUrl}
                alt={image.alt || `Gallery image ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="h-64 w-full object-cover"
              />
              {image.caption && (
                <figcaption className="bg-white/5 px-4 py-3 text-sm text-slate-400">
                  {image.caption}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
