import Layout from "@/components/Layout";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Copy, Check } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useSpring, AnimatePresence } from "framer-motion";
import builder from "@/builder";

interface BlogPostDetail {
  id: string;
  data: {
    title: string;
    slug: string;
    excerpt?: string;
    publishedDate: string;
    body: string;
    coverImage?: string | { url: string };
  };
}

interface ProcessedPost {
  id: string;
  title: string;
  slug: string;
  publishedDate: string;
  body: string;
  coverImage: string;
  excerpt?: string;
  category: string;
  author: {
    name: string;
    role: string;
    image: string;
  };
  readingTime: number;
  tableOfContents: { id: string; title: string; level: number }[];
}

function getImageUrl(image: string | { url: string } | undefined): string {
  console.log("🖼️ getImageUrl input:", image, "type:", typeof image);

  if (!image) {
    console.log("❌ No image provided, using fallback");
    return "https://images.unsplash.com/photo-1460925895917-aae19e488e71?w=800&h=600&fit=crop";
  }

  if (typeof image === "string") {
    console.log("✅ Image is string:", image);
    return image;
  }

  if (image && typeof image === "object" && "url" in image) {
    console.log("✅ Image is object with url:", image.url);
    return image.url;
  }

  console.log("⚠️ Image format unrecognized:", image);
  return "https://images.unsplash.com/photo-1460925895917-aae19e488e71?w=800&h=600&fit=crop";
}

function processBodyContent(body: any): string {
  console.log("🔄 Processing body content, type:", typeof body);

  if (!body) {
    return "";
  }

  if (typeof body === "string") {
    try {
      // Check if it's a JSON string
      const parsed = JSON.parse(body);
      console.log("✅ Body is JSON string, parsed:", parsed);
      // If it's an object, check for common rich text structures
      if (typeof parsed === "object" && parsed !== null) {
        // Handle Builder rich text format (if it exists)
        if (parsed.html) return parsed.html;
        if (parsed.content) return JSON.stringify(parsed.content);
        // Just return the stringified JSON as-is
        return JSON.stringify(parsed);
      }
      return String(parsed);
    } catch (e) {
      // Not JSON, treat as plain HTML/text
      console.log("✅ Body is plain string/HTML");
      return body;
    }
  }

  if (typeof body === "object" && body !== null) {
    console.log("⚠️ Body is object, attempting to extract content");
    // Handle various object formats
    if (body.html) return body.html;
    if (body.content) return String(body.content);
    if (body.value) return String(body.value);
    return JSON.stringify(body);
  }

  return String(body);
}

function addIdToHeadings(html: string): string {
  console.log("🏷️ Adding IDs to headings");

  if (!html) return html;

  // Add IDs to h2 tags
  let result = html.replace(/<h2([^>]*)>(.*?)<\/h2>/gi, (match, attrs, content) => {
    const text = content.replace(/<[^>]*>/g, "").trim();
    const id = text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // Check if id already exists
    if (attrs.includes("id=")) {
      return match;
    }

    return `<h2 id="${id}"${attrs}>${content}</h2>`;
  });

  // Add IDs to h3 tags
  result = result.replace(/<h3([^>]*)>(.*?)<\/h3>/gi, (match, attrs, content) => {
    const text = content.replace(/<[^>]*>/g, "").trim();
    const id = text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // Check if id already exists
    if (attrs.includes("id=")) {
      return match;
    }

    return `<h3 id="${id}"${attrs}>${content}</h3>`;
  });

  return result;
}

function extractHeadings(html: string): { id: string; title: string; level: number }[] {
  const headings: { id: string; title: string; level: number }[] = [];

  if (!html) {
    console.log("⚠️ extractHeadings: No HTML content provided");
    return [{ id: "content", title: "Content", level: 2 }];
  }

  const h2Regex = /<h2[^>]*id="([^"]*)"[^>]*>(.*?)<\/h2>/gi;

  let match;
  let h2Count = 0;
  while ((match = h2Regex.exec(html)) !== null) {
    h2Count++;
    const id = match[1];
    const text = match[2].replace(/<[^>]*>/g, "").trim();
    if (text) {
      headings.push({ id, title: text, level: 2 });
    }
  }

  console.log(`📖 extractHeadings found ${h2Count} h2 tags:`, headings);

  return headings.length > 0 ? headings : [{ id: "content", title: "Content", level: 2 }];
}

function calculateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, "");
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

// Fallback blog posts for legacy routes
const LEGACY_BLOG_POSTS: { [key: string]: BlogPostDetail } = {
  "agile-no-fluff-guide": {
    id: "7",
    title: "Agile: The No-Fluff Guide to Ceremonies and Sprints",
    slug: "agile-no-fluff-guide",
    category: "Agile Methodology",
    publishedDate: "2024-01-20",
    author: {
      name: "Sarah Chen",
      role: "Agile Coach",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop",
    },
    readingTime: 12,
    tableOfContents: [
      { id: "core-concept", title: "The Core Concept: Sprints", level: 2 },
      { id: "the-ceremonies", title: "The Ceremonies", level: 2 },
      { id: "ceremonies-detail", title: "The Ceremonies in Detail", level: 2 },
      { id: "sprint-planning", title: "Sprint Planning", level: 3 },
      { id: "daily-standup", title: "Daily Stand-up (Daily Scrum)", level: 3 },
      { id: "sprint-review", title: "Sprint Review", level: 3 },
      { id: "sprint-retrospective", title: "Sprint Retrospective", level: 3 },
      { id: "backlog-refinement", title: "The Hidden Fifth Ceremony: Backlog Refinement", level: 2 },
      { id: "why-matters", title: "Why It Matters", level: 2 },
    ],
    content: (
      <div className="space-y-8">
        <section>
          <p className="text-gray-300 leading-relaxed mb-4">
            Agile is often over-complicated by consultants selling certificates. At its core, it is simply a method for managing work that prioritises delivering actual value over writing comprehensive documentation for a product that might never get built.
          </p>
          <p className="text-gray-300 leading-relaxed mb-6">
            Think of it this way: traditional project management is like baking a massive, multi-tier wedding cake and hoping the client likes the flavour when you cut it six months later. Agile is baking one cupcake, letting the client taste it, and adjusting the recipe for the next batch based on their feedback.
          </p>
          <p className="text-gray-300 leading-relaxed mb-6">
            Here is the breakdown of how it works, stripped of the fluff.
          </p>
        </section>

        <section id="core-concept">
          <h2 className="text-3xl font-heading font-bold mb-4 text-white">
            The Core Concept: Sprints
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Agile divides work into repeating cycles called Sprints. These are short, time-boxed periods (usually two weeks) where the team focuses on a specific list of tasks.
          </p>
          <p className="text-gray-300 leading-relaxed mb-6">
            Instead of trying to plan the next two years, the team plans the next two weeks. This allows them to adapt quickly if the market changes or the client changes their mind.
          </p>

          <div className="my-8 rounded-lg overflow-hidden border border-gray-700">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F7f77a0638dd04815ae44557e5538348c?format=webp&width=800"
              alt="Scrum cycle diagram showing the flow from Product Backlog through Sprint Planning, Team Sprint, Daily Scrum Meeting, Sprint Review, and Product Increment"
              className="w-full h-auto"
            />
          </div>
        </section>

        <section id="the-ceremonies">
          <h2 className="text-3xl font-heading font-bold mb-4 text-white">
            The Ceremonies
          </h2>
          <p className="text-gray-300 leading-relaxed mb-6">
            To keep this cycle efficient, Agile relies on four specific meetings, known as Ceremonies. These provide rhythm and prevent the team from getting bogged down in endless, unstructured discussions.
          </p>

          <p className="text-gray-300 leading-relaxed mb-6">
            Here is the data on what they are and why they exist:
          </p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-3 text-white font-heading font-bold bg-gray-800/50">Ceremony</th>
                  <th className="text-left p-3 text-white font-heading font-bold bg-gray-800/50">Purpose</th>
                  <th className="text-left p-3 text-white font-heading font-bold bg-gray-800/50">Duration</th>
                  <th className="text-left p-3 text-white font-heading font-bold bg-gray-800/50">Who attends?</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-700 hover:bg-gray-800/30 transition">
                  <td className="p-3 text-blue-400 font-bold">Sprint Planning</td>
                  <td className="p-3 text-gray-300">Agreeing on exactly what to build in the next cycle.</td>
                  <td className="p-3 text-gray-300">2–4 hours</td>
                  <td className="p-3 text-gray-300">Product Owner, Scrum Master, Dev Team</td>
                </tr>
                <tr className="border-b border-gray-700 hover:bg-gray-800/30 transition">
                  <td className="p-3 text-blue-400 font-bold">Daily Stand-up</td>
                  <td className="p-3 text-gray-300">A quick sync to flag problems. Not a status report.</td>
                  <td className="p-3 text-gray-300">15 mins</td>
                  <td className="p-3 text-gray-300">Scrum Master, Dev Team</td>
                </tr>
                <tr className="border-b border-gray-700 hover:bg-gray-800/30 transition">
                  <td className="p-3 text-blue-400 font-bold">Sprint Review</td>
                  <td className="p-3 text-gray-300">Showing the finished work to stakeholders.</td>
                  <td className="p-3 text-gray-300">1–2 hours</td>
                  <td className="p-3 text-gray-300">Dev Team, Product Owner, Stakeholders</td>
                </tr>
                <tr className="hover:bg-gray-800/30 transition">
                  <td className="p-3 text-blue-400 font-bold">Retrospective</td>
                  <td className="p-3 text-gray-300">Discussing how to work better next time.</td>
                  <td className="p-3 text-gray-300">1–2 hours</td>
                  <td className="p-3 text-gray-300">Scrum Master, Dev Team</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="ceremonies-detail">
          <h2 className="text-3xl font-heading font-bold mb-4 text-white">
            The Ceremonies in Detail
          </h2>

          <div className="bg-blue-900/20 border-l-4 border-blue-500 p-6 rounded mb-8">
            <p className="text-blue-200 font-heading font-bold mb-2">💡 Quick Overview</p>
            <p className="text-blue-100">
              These meetings create rhythm and accountability without creating bloat. Each serves a distinct purpose and has a strict time limit to prevent them from becoming unproductive.
            </p>
          </div>

          <h3 id="sprint-planning" className="text-2xl font-heading font-bold mb-4 text-white">
            1. Sprint Planning
          </h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            This kicks off the cycle. The team looks at the Backlog (the master to-do list) and moves the top priority items into the Sprint Backlog (the to-do list for just this cycle). The goal is to leave the room with a clear plan of what will be delivered and how.
          </p>

          <h3 id="daily-standup" className="text-2xl font-heading font-bold mb-4 text-white">
            2. Daily Stand-up (Daily Scrum)
          </h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            This is a tactical huddle, not a coffee catch-up. It happens at the same time every day. To keep it efficient, everyone stands up (physically) to encourage brevity. Each person answers three questions:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-300 mb-6">
            <li>What did I finish yesterday?</li>
            <li>What will I do today?</li>
            <li>Is anything blocking me?</li>
          </ul>

          <h3 id="sprint-review" className="text-2xl font-heading font-bold mb-4 text-white">
            3. Sprint Review
          </h3>
          <p className="text-gray-300 leading-relaxed mb-6">
            At the end of the Sprint, the team demonstrates the working software (or product) to the stakeholders. This is about proof, not promises. It ensures the team built what the business actually needed.
          </p>

          <h3 id="sprint-retrospective" className="text-2xl font-heading font-bold mb-4 text-white">
            4. Sprint Retrospective
          </h3>
          <p className="text-gray-300 leading-relaxed mb-6">
            This is the most critical meeting for long-term efficiency. The team looks internally at their process. They discuss what went well, what went wrong, and agree on actionable changes to improve the next Sprint. It is about honest feedback, not assigning blame.
          </p>

          <div className="bg-purple-900/20 border-l-4 border-purple-500 p-6 rounded mb-8">
            <p className="text-purple-200 font-heading font-bold mb-2">🎯 Pro Tip</p>
            <p className="text-purple-100">
              The retrospective is where teams actually improve. Don't skip it or rush it. Even 15 minutes of honest reflection can unlock major productivity gains in the next sprint.
            </p>
          </div>
        </section>

        <section id="backlog-refinement">
          <h2 className="text-3xl font-heading font-bold mb-4 text-white">
            The Hidden Fifth Ceremony: Backlog Refinement
          </h2>
          <p className="text-gray-300 leading-relaxed mb-6">
            While not always listed as a "core" ceremony, successful teams do this. It involves reviewing upcoming tasks in the middle of a Sprint to ensure they are clear and ready for the next planning session. It keeps the pipeline clean.
          </p>
        </section>

        <section id="why-matters">
          <h2 className="text-3xl font-heading font-bold mb-4 text-white">
            Why It Matters
          </h2>
          <p className="text-gray-300 leading-relaxed mb-6">
            The goal of these ceremonies is predictability and transparency. They remove the "black box" effect where developers disappear for months and return with the wrong product. By strictly adhering to these time-boxes, you ensure that problems are caught early and value is delivered consistently.
          </p>

          <div className="bg-green-900/20 border-l-4 border-green-500 p-6 rounded">
            <p className="text-green-200 font-heading font-bold mb-2">✅ Key Takeaway</p>
            <p className="text-green-100">
              Agile isn't about following rules. It's about building feedback loops into your process so you can adapt faster than your competition. The ceremonies are just the structure that makes this possible.
            </p>
          </div>
        </section>
      </div>
    ),
  },
  "design-systems-scale": {
    id: "1",
    title: "Building Design Systems That Scale",
    slug: "design-systems-scale",
    category: "Design Systems",
    publishedDate: "2024-01-15",
    author: {
      name: "Sarah Chen",
      role: "Design Systems Lead",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop",
    },
    readingTime: 8,
    tableOfContents: [
      { id: "why-systems", title: "Why Design Systems Matter", level: 2 },
      { id: "building-blocks", title: "The Building Blocks", level: 2 },
      { id: "token-architecture", title: "Token Architecture", level: 3 },
      { id: "component-patterns", title: "Component Patterns", level: 3 },
      { id: "governance", title: "Governance & Scaling", level: 2 },
      { id: "tools", title: "Tools That Help", level: 2 },
    ],
    content: (
      <div className="space-y-8">
        <section id="why-systems">
          <h2 className="text-3xl font-heading font-bold mb-4 text-white">
            Why Design Systems Matter
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            A design system isn't just a collection of components. It's a shared language between design and engineering that scales your product without sacrificing consistency or quality.
          </p>
          <p className="text-gray-300 leading-relaxed mb-6">
            When we started building systems for enterprise clients, we realized the difference between a "component library" and a true "design system" was philosophy. One is a tool. The other is a practice.
          </p>

          <div className="bg-blue-900/20 border-l-4 border-blue-500 p-6 rounded mb-6">
            <p className="text-blue-200 font-heading font-bold mb-2">💡 Pro Tip</p>
            <p className="text-blue-100">
              Start with your most-used component. Build it right, document it well, then expand. Don't try to systemize everything at once.
            </p>
          </div>
        </section>

        <section id="building-blocks">
          <h2 className="text-3xl font-heading font-bold mb-4 text-white">
            The Building Blocks
          </h2>
          <p className="text-gray-300 leading-relaxed mb-6">
            Every design system needs a foundation. We think of it in layers:
          </p>

          <div className="space-y-4 mb-6">
            {[
              { name: "Tokens", desc: "Colors, spacing, typography rules" },
              { name: "Components", desc: "Buttons, inputs, cards, etc." },
              { name: "Patterns", desc: "How components work together" },
              { name: "Documentation", desc: "Why and when to use each piece" },
            ].map((item, idx) => (
              <div key={idx} className="bg-gray-800 border border-gray-700 p-4 rounded">
                <p className="font-mono text-blue-400 font-bold mb-1">{item.name}</p>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          <h3 id="token-architecture" className="text-2xl font-heading font-bold mb-4 text-white">
            Token Architecture
          </h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            Token naming matters more than you think. We use a semantic approach:
          </p>

          <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden mb-6">
            <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
              <p className="font-mono text-sm text-gray-400">tokens.json</p>
              <button className="text-gray-500 hover:text-gray-300 transition">
                <Copy size={16} />
              </button>
            </div>
            <pre className="p-4 overflow-x-auto">
              <code className="font-mono text-sm text-gray-300">
{`{
  "colors": {
    "primary": "#06B6D4",
    "success": "#84CC16",
    "semantic": {
      "error": "{colors.red}",
      "warning": "{colors.amber}"
    }
  }
}`}
              </code>
            </pre>
          </div>

          <h3 id="component-patterns" className="text-2xl font-heading font-bold mb-4 text-white">
            Component Patterns
          </h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            Components follow a consistent pattern in our system. Each has:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-300 mb-6">
            <li>Clear props API (TypeScript interfaces)</li>
            <li>Multiple variants (size, color, state)</li>
            <li>Accessibility built in (ARIA labels, keyboard nav)</li>
            <li>Usage examples and edge cases documented</li>
          </ul>

          <div className="bg-purple-900/20 border-l-4 border-purple-500 p-6 rounded mb-6">
            <p className="text-purple-200 font-heading font-bold mb-2">⚙️ Agile Note</p>
            <p className="text-purple-100">
              Version your components like you version your code. Semantic versioning helps teams understand what changed and if they need to update.
            </p>
          </div>
        </section>

        <section id="governance">
          <h2 className="text-3xl font-heading font-bold mb-4 text-white">
            Governance & Scaling
          </h2>
          <p className="text-gray-300 leading-relaxed mb-6">
            The hardest part of a design system is keeping it alive and relevant. It's not a project that ends – it's ongoing practice.
          </p>
          <p className="text-gray-300 leading-relaxed mb-6">
            We recommend:
          </p>
          <ol className="list-decimal list-inside space-y-3 text-gray-300 mb-6">
            <li>A small core team (design + engineering) who owns decisions</li>
            <li>Regular audits (monthly) to catch drift</li>
            <li>Clear change management (proposals, feedback, deprecation warnings)</li>
            <li>Usage metrics (which components are actually used?)</li>
          </ol>
        </section>

        <section id="tools">
          <h2 className="text-3xl font-heading font-bold mb-4 text-white">
            Tools That Help
          </h2>
          <p className="text-gray-300 leading-relaxed mb-6">
            Don't let tooling slow you down. Start simple:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { tool: "Figma", for: "Design source of truth" },
              { tool: "Storybook", for: "Component documentation" },
              { tool: "TypeScript", for: "Type-safe APIs" },
              { tool: "Chromatic", for: "Visual regression testing" },
            ].map((item, idx) => (
              <div key={idx} className="bg-gray-800 border border-gray-700 p-4 rounded">
                <p className="font-mono text-amber-400 font-bold mb-1">{item.tool}</p>
                <p className="text-gray-400 text-sm">{item.for}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    ),
  },
};

function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-gray-500 hover:text-gray-300 transition"
    >
      {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
    </button>
  );
}

function TableOfContents({
  items,
  activeId,
}: {
  items: { id: string; title: string; level: number }[];
  activeId: string;
}) {
  return (
    <motion.div
      className="bg-gray-900 border border-gray-800 rounded-lg p-6"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
    >
      <p className="text-xs font-mono text-gray-500 font-bold tracking-widest mb-4">
        TABLE OF CONTENTS
      </p>
      <nav className="space-y-2">
        {items.map((item) => (
          <motion.a
            key={item.id}
            href={`#${item.id}`}
            className={`block text-sm transition ${
              activeId === item.id
                ? "text-blue-400 font-bold"
                : "text-gray-400 hover:text-white"
            } ${item.level === 3 ? "ml-4" : ""}`}
            whileHover={{ x: 4 }}
            transition={{ duration: 0.2 }}
          >
            {item.title}
          </motion.a>
        ))}
      </nav>
    </motion.div>
  );
}

interface ImageProps {
  src: string;
  alt: string;
}

function ImageWithPlaceholder({ src, alt }: ImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <motion.div
      className="relative overflow-hidden rounded-lg bg-gray-800 aspect-video"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {!isLoaded && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800"
          animate={{ backgroundPosition: ["0% 0%", "100% 0%"] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
      )}
      <motion.img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onLoad={() => setIsLoaded(true)}
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
    </motion.div>
  );
}

export default function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<ProcessedPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<ProcessedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const scaleX = useSpring(0, { stiffness: 100, damping: 30 });
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch post by slug from Builder
  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) {
        setIsLoading(false);
        return;
      }

      try {
        const results = await builder.getAll("blog-post", {
          fields: "data.title,data.slug,data.body,data.publishedDate,data.coverImage,data.excerpt",
          query: { "data.slug": slug },
          limit: 1,
        });

        console.log("📝 BlogDetail Fetch Results:", results);

        if (results && results.length > 0) {
          const builderPost = results[0] as BlogPostDetail;
          console.log("Post Title:", builderPost.data.title);
          console.log("Post Body Type:", typeof builderPost.data.body);
          console.log("Post Body Value:", builderPost.data.body);
          console.log("CoverImage:", builderPost.data.coverImage);

          const bodyContent = processBodyContent(builderPost.data.body);
          console.log("Processed Body Content (first 500 chars):", bodyContent?.substring(0, 500));
          const extractedHeadings = extractHeadings(bodyContent);
          console.log("Extracted Headings:", extractedHeadings);

          const processedPost: ProcessedPost = {
            id: builderPost.id,
            title: builderPost.data.title || "Untitled",
            slug: builderPost.data.slug || slug,
            publishedDate: builderPost.data.publishedDate || new Date().toISOString(),
            body: bodyContent,
            coverImage: getImageUrl(builderPost.data.coverImage),
            excerpt: builderPost.data.excerpt || "",
            category: "Blog Post",
            author: {
              name: "Kaizen",
              role: "Web Design & Agile",
              image: "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2Fbe9c606a991946d9b3a5d47d9cfbf290?format=webp&width=800",
            },
            readingTime: calculateReadingTime(bodyContent),
            tableOfContents: extractedHeadings,
          };
          setPost(processedPost);
        } else {
          // Fallback to legacy posts for development
          const legacyPost = LEGACY_BLOG_POSTS[slug];
          if (legacyPost) {
            const processedPost: ProcessedPost = {
              id: legacyPost.id,
              title: legacyPost.data.title || "Untitled",
              slug: legacyPost.data.slug || slug,
              publishedDate: legacyPost.data.publishedDate || new Date().toISOString(),
              body: "",
              coverImage: getImageUrl(legacyPost.data.coverImage),
              excerpt: legacyPost.data.excerpt || "",
              category: "Blog Post",
              author: {
                name: "Kaizen",
                role: "Web Design & Agile",
                image: "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2Fbe9c606a991946d9b3a5d47d9cfbf290?format=webp&width=800",
              },
              readingTime: 8,
              tableOfContents: [],
            };
            setPost(processedPost);
          }
        }
      } catch (error) {
        console.error("Failed to fetch post from Builder:", error);
        console.log(`Attempting to load legacy post for slug: ${slug}`);
        // Fallback to legacy posts
        const legacyPost = LEGACY_BLOG_POSTS[slug];
        if (legacyPost) {
          const processedPost: ProcessedPost = {
          id: legacyPost.id,
          title: legacyPost.data.title || "Untitled",
          slug: legacyPost.data.slug || slug,
          publishedDate: legacyPost.data.publishedDate || new Date().toISOString(),
          body: "",
          coverImage: getImageUrl(legacyPost.data.coverImage),
          excerpt: legacyPost.data.excerpt || "",
          category: "Blog Post",
          author: {
            name: "Kaizen",
            role: "Web Design & Agile",
            image: "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2Fbe9c606a991946d9b3a5d47d9cfbf290?format=webp&width=800",
          },
          readingTime: 8,
          tableOfContents: [],
        };
          setPost(processedPost);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  // Fetch related posts
  useEffect(() => {
    const fetchRelated = async () => {
      try {
        const results = await builder.getAll("blog-post", {
          fields: "data.title,data.slug,data.publishedDate",
          limit: 10,
        });

        const relatedPostsList: ProcessedPost[] = (results as BlogPost[])
          .filter((p) => p.data.slug !== slug)
          .slice(0, 2)
          .map((p) => ({
            id: p.id,
            title: p.data.title || "Untitled",
            slug: p.data.slug || "",
            publishedDate: p.data.publishedDate || new Date().toISOString(),
            body: "",
            coverImage: "",
            excerpt: "",
            category: "Blog Post",
            author: {
              name: "Kaizen",
              role: "Web Design & Agile",
              image: "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2Fbe9c606a991946d9b3a5d47d9cfbf290?format=webp&width=800",
            },
            readingTime: 5,
            tableOfContents: [],
          }));

        setRelatedPosts(relatedPostsList);
      } catch (error) {
        console.error("Failed to fetch related posts:", error);
      }
    };

    if (post) {
      fetchRelated();
    }
  }, [post, slug]);

  // Update reading progress
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      const progress = totalHeight > 0 ? scrolled / totalHeight : 0;
      const clampedProgress = Math.min(progress, 1);
      setScrollProgress(Math.round(clampedProgress * 100));
      scaleX.set(clampedProgress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scaleX]);

  // IntersectionObserver for TOC
  useEffect(() => {
    if (!post || !contentRef.current) return;

    const headings = contentRef.current.querySelectorAll("h2");
    if (headings.length === 0) {
      setActiveSection(post.tableOfContents[0]?.id || "");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleHeadings = entries.filter((entry) => entry.isIntersecting);
        if (visibleHeadings.length > 0) {
          const topHeading = visibleHeadings[0];
          const id = (topHeading.target as HTMLElement).id || post.tableOfContents[0]?.id || "";
          if (id) setActiveSection(id);
        }
      },
      { threshold: 0.5 }
    );

    headings.forEach((heading) => {
      if (heading.id) observer.observe(heading);
    });

    return () => observer.disconnect();
  }, [post]);

  if (isLoading) {
    return (
      <Layout>
        <motion.div
          className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-12 h-12 border-4 border-gray-800 border-t-blue-400 rounded-full"
          />
        </motion.div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <motion.div
          className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <h1 className="text-4xl font-heading font-bold text-white mb-4">Post not found</h1>
          <Link to="/blog" className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
            <ArrowLeft size={18} /> Back to Journal
          </Link>
        </motion.div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-800 z-[9999] px-4 py-2 flex items-center gap-3">
        <motion.div
          className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 rounded flex-1 origin-left overflow-hidden"
          style={{ scaleX }}
        />
        <span className="text-white text-xs font-mono font-bold whitespace-nowrap">
          {scrollProgress}%
        </span>
      </div>

      {/* Hero */}
      <motion.section
        className="bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white py-12 px-4 md:py-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 font-mono text-sm"
            >
              <ArrowLeft size={16} /> Back to Blog
            </Link>
          </motion.div>

          <div className="mb-6">
            <motion.span
              className="inline-block px-3 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-amber-400 font-bold tracking-widest mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              Blog Post
            </motion.span>
          </div>

          <motion.h1
            className="text-5xl md:text-6xl font-heading font-bold mb-6 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {post.title}
          </motion.h1>

          <motion.div
            className="flex flex-wrap items-center gap-6 text-gray-400 text-sm font-mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <span>{new Date(post.publishedDate).toLocaleDateString()}</span>
            <span>•</span>
            <span>{post.readingTime} min read</span>
          </motion.div>
        </div>
      </motion.section>

      {/* Content Grid */}
      <motion.section
        className="bg-gray-950 px-4 py-16 md:py-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar - TOC (sticky on desktop) */}
            <div className="lg:col-span-1">
              <div className="sticky top-20">
                <TableOfContents items={post.tableOfContents} activeId={activeSection} />

                {/* Author Card */}
                <motion.div
                  className="bg-gray-900 border border-gray-800 rounded-lg p-6 mt-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                >
                  <p className="text-xs font-mono text-gray-500 font-bold tracking-widest mb-4">
                    AUTHOR
                  </p>
                  <div className="bg-gray-100 rounded-lg p-3 mb-4 flex items-center justify-center h-24">
                    <img
                      src={post.author.image}
                      alt={post.author.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h4 className="font-heading font-bold text-white text-sm">{post.author.name}</h4>
                  <p className="text-blue-400 text-xs font-mono font-bold tracking-widest">
                    {post.author.role}
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <motion.div
                ref={contentRef}
                className="prose prose-invert max-w-none text-gray-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <style>{`
                  .prose h2 { font-size: 1.875rem; font-weight: 700; margin-top: 2rem; margin-bottom: 1rem; color: white; }
                  .prose h3 { font-size: 1.5rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; color: white; }
                  .prose p { line-height: 1.8; margin-bottom: 1rem; max-width: 65ch; color: rgb(209, 213, 219); }
                  .prose ul { margin-bottom: 1.5rem; color: rgb(209, 213, 219); }
                  .prose li { margin-bottom: 0.5rem; }
                  .prose a { color: rgb(96, 165, 250); text-decoration: underline; }
                  .prose a:hover { color: rgb(147, 197, 253); }
                  .prose img { border-radius: 0.5rem; margin: 1.5rem 0; max-width: 100%; }
                  .prose table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
                  .prose th { background-color: rgba(31, 41, 55, 0.5); padding: 0.75rem; border: 1px solid rgba(75, 85, 99, 0.5); color: white; }
                  .prose td { padding: 0.75rem; border: 1px solid rgba(75, 85, 99, 0.5); }
                `}</style>

                {post.body ? (
                  <div dangerouslySetInnerHTML={{ __html: post.body }} />
                ) : (
                  <p>No content available.</p>
                )}
              </motion.div>

              {/* CTA */}
              <motion.div
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 mt-12 font-mono"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
              >
                <p className="text-green-400 text-sm mb-4">$ ready_for_next_project();</p>
                <h3 className="text-2xl font-heading font-bold text-white mb-3">
                  Ready to build something great?
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  Let's work together. We bring clarity, Agile thinking, and a focus on what actually matters.
                </p>
                <Link
                  to="/contact"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-heading font-bold rounded-lg hover:opacity-90 transition flex items-center gap-2"
                >
                  Start a Project <ArrowRight size={18} />
                </Link>
              </motion.div>

              {/* Related Posts */}
              {relatedPosts.length > 0 && (
                <motion.div
                  className="mt-16 pt-8 border-t border-gray-800"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  <h3 className="text-2xl font-heading font-bold text-white mb-6">More from the Blog</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {relatedPosts.map((relatedPost, idx) => (
                      <motion.div
                        key={relatedPost.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.7 + idx * 0.1 }}
                      >
                        <Link
                          to={`/blog/${relatedPost.slug}`}
                          className="group p-4 border border-gray-700 rounded-lg hover:border-blue-500/50 hover:bg-gray-800/50 transition block"
                        >
                          <h4 className="font-heading font-bold text-white group-hover:text-blue-300 transition mb-2">
                            {relatedPost.title}
                          </h4>
                          <p className="text-gray-500 text-sm font-mono">
                            {new Date(relatedPost.publishedDate).toLocaleDateString()}
                          </p>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.section>
    </Layout>
  );
}
