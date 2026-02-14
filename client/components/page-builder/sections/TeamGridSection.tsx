import SectionWrapper from "../SectionWrapper";
import { SectionHeading } from "../shared";
import type { ManagedTeamGridSection } from "@shared/pageBuilder";

export default function TeamGridSection({
  heading,
  subtitle,
  members,
  settings,
}: ManagedTeamGridSection) {
  return (
    <SectionWrapper settings={settings}>
      {heading && (
        <div className="mb-4 text-center">
          <SectionHeading text={heading} />
        </div>
      )}
      {subtitle && (
        <p className="mx-auto mb-12 max-w-2xl text-center text-lg text-gray-400">
          {subtitle}
        </p>
      )}
      <div
        className={`grid gap-6 ${
          (members?.length ?? 0) <= 2
            ? "sm:grid-cols-2 max-w-2xl mx-auto"
            : (members?.length ?? 0) === 3
              ? "sm:grid-cols-2 lg:grid-cols-3"
              : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        }`}
      >
        {(members || []).map((member) => (
          <div
            key={member._key}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center transition hover:border-cyan-400/30"
          >
            {member.imageUrl && (
              <img
                src={member.imageUrl}
                alt={member.name}
                className="mx-auto mb-4 h-24 w-24 rounded-full object-cover"
                loading="lazy"
                decoding="async"
              />
            )}
            <h3 className="text-lg font-semibold text-white">{member.name}</h3>
            {member.role && (
              <p className="mt-1 text-sm text-cyan-400">{member.role}</p>
            )}
            {member.bio && (
              <p className="mt-3 text-sm leading-relaxed text-gray-400">
                {member.bio}
              </p>
            )}
            {member.linkedin && (
              <a
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-gray-500 transition hover:text-cyan-400"
              >
                LinkedIn
              </a>
            )}
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}
