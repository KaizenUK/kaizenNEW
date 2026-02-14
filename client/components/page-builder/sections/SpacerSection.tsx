import type { ManagedSpacerSection } from "@shared/pageBuilder";
import SectionWrapper from "../SectionWrapper";

const HEIGHT_CLASSES: Record<string, string> = {
  sm: "h-8",
  md: "h-16",
  lg: "h-24",
  xl: "h-32",
};

export default function SpacerSection(props: ManagedSpacerSection) {
  const { height = "md", showLine, settings } = props;
  const heightClass = HEIGHT_CLASSES[height] ?? HEIGHT_CLASSES.md;

  return (
    <SectionWrapper settings={settings}>
      <div className={`flex items-center ${heightClass}`}>
        {showLine && (
          <hr className="w-full border-t border-white/10" />
        )}
      </div>
    </SectionWrapper>
  );
}
