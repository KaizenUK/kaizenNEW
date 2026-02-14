import { PortableText } from "@portabletext/react";
import type {
  SanityRichTextSection,
  SanitySectionSettings,
} from "../../../../src/lib/sanity/client";
import SectionWrapper from "../SectionWrapper";
import { SectionHeading, portableComponents } from "../shared";

type Props = SanityRichTextSection & { settings?: SanitySectionSettings };

export default function RichTextSection(props: Props) {
  const { heading, body, settings } = props;

  return (
    <SectionWrapper settings={settings}>
      {heading && <SectionHeading text={heading} />}
      <div className="mt-6">
        <PortableText
          value={body || []}
          components={portableComponents}
        />
      </div>
    </SectionWrapper>
  );
}
