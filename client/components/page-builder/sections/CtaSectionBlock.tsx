import type {
  SanityCtaSection,
  SanitySectionSettings,
} from "../../../../src/lib/sanity/client";
import SectionWrapper from "../SectionWrapper";
import { CtaButton } from "../shared";

type Props = SanityCtaSection & { settings?: SanitySectionSettings };

export default function CtaSectionBlock(props: Props) {
  const { text, buttonLink, settings } = props;

  return (
    <SectionWrapper settings={settings}>
      <div className="text-center">
        {text && (
          <h2 className="text-3xl font-bold leading-tight text-white md:text-4xl">
            {text}
          </h2>
        )}
        {buttonLink && (
          <div className="mt-8 flex justify-center">
            <CtaButton cta={buttonLink} />
          </div>
        )}
      </div>
    </SectionWrapper>
  );
}
