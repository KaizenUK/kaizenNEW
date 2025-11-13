import Layout from "@/components/Layout";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Copy, Check } from "lucide-react";
import { useState } from "react";

interface BlogPostDetail {
  id: string;
  title: string;
  slug: string;
  category: string;
  publishedDate: string;
  author: {
    name: string;
    role: string;
    image: string;
  };
  readingTime: number;
  content: React.ReactNode;
  tableOfContents: { id: string; title: string; level: number }[];
}

const BLOG_POSTS_DETAIL: { [key: string]: BlogPostDetail } = {
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
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <p className="text-xs font-mono text-gray-500 font-bold tracking-widest mb-4">
        TABLE OF CONTENTS
      </p>
      <nav className="space-y-2">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`block text-sm transition ${
              activeId === item.id
                ? "text-blue-400 font-bold"
                : "text-gray-400 hover:text-white"
            } ${item.level === 3 ? "ml-4" : ""}`}
          >
            {item.title}
          </a>
        ))}
      </nav>
    </div>
  );
}

export default function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [activeSection, setActiveSection] = useState("");

  const post = slug ? BLOG_POSTS_DETAIL[slug] : null;

  if (!post) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4">
          <h1 className="text-4xl font-heading font-bold text-white mb-4">Post not found</h1>
          <Link to="/blog" className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
            <ArrowLeft size={18} /> Back to Journal
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white py-12 px-4 md:py-20">
        <div className="container mx-auto max-w-4xl">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 font-mono text-sm"
          >
            <ArrowLeft size={16} /> Back to Journal
          </Link>

          <div className="mb-6">
            <span className="inline-block px-3 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-amber-400 font-bold tracking-widest mb-4">
              {post.category}
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl font-heading font-bold mb-6 leading-tight">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-6 text-gray-400 text-sm font-mono">
            <span>{new Date(post.publishedDate).toLocaleDateString()}</span>
            <span>•</span>
            <span>{post.readingTime} min read</span>
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <section className="bg-gray-950 px-4 py-16 md:py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar - TOC (sticky on desktop) */}
            <div className="lg:col-span-1">
              <div className="sticky top-20">
                <TableOfContents items={post.tableOfContents} activeId={activeSection} />

                {/* Author Card */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mt-6">
                  <p className="text-xs font-mono text-gray-500 font-bold tracking-widest mb-4">
                    AUTHOR
                  </p>
                  <img
                    src={post.author.image}
                    alt={post.author.name}
                    className="w-12 h-12 rounded-full mb-4"
                  />
                  <h4 className="font-heading font-bold text-white text-sm">{post.author.name}</h4>
                  <p className="text-blue-400 text-xs font-mono font-bold tracking-widest">
                    {post.author.role}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <div className="prose prose-invert max-w-none text-gray-300">
                <style>{`
                  .prose h2 { font-size: 1.875rem; font-weight: 700; margin-top: 2rem; margin-bottom: 1rem; }
                  .prose h3 { font-size: 1.5rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; }
                  .prose p { line-height: 1.8; margin-bottom: 1rem; max-width: 65ch; }
                  .prose ul { margin-bottom: 1.5rem; }
                  .prose li { margin-bottom: 0.5rem; }
                `}</style>

                {post.content}
              </div>

              {/* CTA */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 mt-12 font-mono">
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
              </div>

              {/* Related Posts */}
              <div className="mt-16 pt-8 border-t border-gray-800">
                <h3 className="text-2xl font-heading font-bold text-white mb-6">More from the Journal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    {
                      title: "Agile Without the Buzzwords",
                      slug: "agile-without-buzzwords",
                      date: "2024-01-10",
                    },
                    {
                      title: "Product Thinking for Web Design",
                      slug: "product-thinking-design",
                      date: "2024-01-01",
                    },
                  ].map((relatedPost, idx) => (
                    <Link
                      key={idx}
                      to={`/blog/${relatedPost.slug}`}
                      className="group p-4 border border-gray-700 rounded-lg hover:border-blue-500/50 hover:bg-gray-800/50 transition"
                    >
                      <h4 className="font-heading font-bold text-white group-hover:text-blue-300 transition mb-2">
                        {relatedPost.title}
                      </h4>
                      <p className="text-gray-500 text-sm font-mono">
                        {new Date(relatedPost.date).toLocaleDateString()}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
