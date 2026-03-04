import Layout from "@/components/Layout";
import { termsContent } from "@shared/legal";

const TermsAndConditions = () => {
  // Process the text to create paragraphs and headings
  const processedContent = termsContent.split("---").map((section, index) => (
    <div key={index} className="mb-8">
      {section.trim().split("\n").map((line, lineIndex) => {
        const trimmedLine = line.trim();

        // Skip empty lines
        if (!trimmedLine) return null;

        // Main document title (only the very first line of the first section)
        if (index === 0 && lineIndex === 0 && trimmedLine.startsWith("STANDARD TERMS AND CONDITIONS OF BUSINESS")) {
          return <h1 key={lineIndex} className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-kaizen-dark">{trimmedLine}</h1>;
        }
        // Major section headings (e.g., "1. Definitions", "2. Rates...", "Schedule 1...")
        if ((/^\d+\./.test(trimmedLine) && !/^\d+\.\d+/.test(trimmedLine)) || trimmedLine.startsWith("Schedule")) {
          return <h2 key={lineIndex} className="text-2xl md:text-3xl font-bold mt-8 mb-4 text-kaizen-dark">{trimmedLine}</h2>;
        }
        // Sub-section clauses (e.g., "1.1 “Client”", "16.13 Confidentiality")
        // This regex captures:
        // 1. The number (e.g., "1.1", "16.13")
        // 2. Any text between the number and an optional colon (e.g., " “Client”", " Confidentiality")
        // 3. The optional colon and any following whitespace
        // 4. The rest of the line
        const subSectionMatch = trimmedLine.match(/^(\d+\.\d+)\s*([^:]*)?(:?\s*)(.*)/);
        if (subSectionMatch) {
          const [, number, headingTextRaw, colonAndSpace, restOfLine] = subSectionMatch;
          const headingText = headingTextRaw ? headingTextRaw.trim() : ''; // Trim to remove leading/trailing spaces

          // Construct the bolded part: number, optionally followed by a space and the heading text
          const boldedContent = headingText ? `${number} ${headingText}` : number;
          return (
            <p key={lineIndex} className="mb-2 text-base md:text-lg text-kaizen-text-dark/70">
              <strong>{boldedContent}</strong>{colonAndSpace}{restOfLine}
            </p>
          );
        }
        // List items like (a), (b)
        if (/^\([a-z]\)/.test(trimmedLine)) {
          return <p key={lineIndex} className="ml-8 mb-2 text-base md:text-lg text-kaizen-text-dark/70">{trimmedLine}</p>;
        }
        // Default paragraph
        return <p key={lineIndex} className="mb-2 text-base md:text-lg text-kaizen-text-dark/70">{trimmedLine}</p>;
      })}
    </div>  ));

  return (
    <Layout>
      <div className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="prose max-w-none text-kaizen-dark/80 leading-relaxed">
              {processedContent}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TermsAndConditions;
