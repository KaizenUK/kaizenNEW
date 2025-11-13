import Layout from "@/components/Layout";
import { Link } from "react-router-dom";
import { ArrowRight, Code2 } from "lucide-react";
import { useState, useEffect } from "react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  image: string;
  publishedDate: string;
  featured?: boolean;
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: "7",
    title: "Agile: The No-Fluff Guide to Ceremonies and Sprints",
    slug: "agile-no-fluff-guide",
    excerpt: "Agile simplified. Learn the core ceremonies and sprints without the consultant fluff.",
    category: "Agile Methodology",
    image: "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2F7f77a0638dd04815ae44557e5538348c?format=webp&width=800",
    publishedDate: "2024-01-20",
    featured: true,
  },
  {
    id: "1",
    title: "Building Design Systems That Scale",
    slug: "design-systems-scale",
    excerpt: "How to architect a design system that grows with your product without technical debt.",
    category: "Design Systems",
    image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop",
    publishedDate: "2024-01-15",
  },
  {
    id: "2",
    title: "Agile Without the Buzzwords",
    slug: "agile-without-buzzwords",
    excerpt: "Practical Agile methodology for small teams building real products.",
    category: "Agile Methodology",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop",
    publishedDate: "2024-01-10",
  },
  {
    id: "3",
    title: "Local SEO for Liverpool Businesses",
    slug: "local-seo-liverpool",
    excerpt: "Ranking for 'near me' searches and local keywords in competitive markets.",
    category: "Product Strategy",
    image: "https://images.unsplash.com/photo-1460925895917-aae19e488e71?w=800&h=600&fit=crop",
    publishedDate: "2024-01-08",
  },
  {
    id: "4",
    title: "Performance Matters: Why Fast Sites Convert",
    slug: "performance-converts",
    excerpt: "The direct relationship between page speed and conversion rates.",
    category: "Dev Ops",
    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=600&fit=crop",
    publishedDate: "2024-01-05",
  },
  {
    id: "5",
    title: "Product Thinking for Web Design",
    slug: "product-thinking-design",
    excerpt: "Applying product management principles to web design projects.",
    category: "Product Strategy",
    image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop",
    publishedDate: "2024-01-01",
  },
  {
    id: "6",
    title: "Testing Strategies for Modern Web Apps",
    slug: "testing-strategies",
    excerpt: "Unit, integration, and e2e testing without the overhead.",
    category: "Dev Ops",
    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=600&fit=crop",
    publishedDate: "2023-12-28",
  },
];

const CATEGORIES = ["All", "Design Systems", "Agile Methodology", "Product Strategy", "Dev Ops"];

const CATEGORY_COLORS: { [key: string]: string } = {
  "Design Systems": "text-blue-400",
  "Agile Methodology": "text-purple-400",
  "Product Strategy": "text-amber-400",
  "Dev Ops": "text-green-400",
};

interface TypingProps {
  text: string;
  speed?: number;
}

function TypingText({ text, speed = 100 }: TypingProps) {
  const [displayText, setDisplayText] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[index]);
        setIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [index, text, speed]);

  return (
    <span>
      {displayText}
      <span className="animate-pulse">_</span>
    </span>
  );
}

export default function Blog() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredPosts = BLOG_POSTS.filter(
    (post) => selectedCategory === "All" || post.category === selectedCategory
  );

  const featuredPost = filteredPosts.find((p) => p.featured) || filteredPosts[0];
  const otherPosts = filteredPosts.filter((p) => p.id !== featuredPost?.id);

  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white py-20 md:py-32 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Title + Typing Effect */}
            <div className="max-w-2xl">
              <h1 className="text-5xl md:text-6xl font-heading font-bold mb-6 leading-tight">
                The Kaizen Journal
              </h1>
              <p className="text-xl md:text-2xl font-mono text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-amber-400 mb-8">
                <TypingText text="Iterate. Ship. Improve." speed={80} />
              </p>
              <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                Deep dives into web design, Agile methodology, and building products that matter. We write about what we actually do, not what sounds good.
              </p>
              <div className="flex gap-4">
                <span className="inline-block px-3 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">
                  Design Systems
                </span>
                <span className="inline-block px-3 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">
                  Agile Delivery
                </span>
                <span className="inline-block px-3 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">
                  Tech
                </span>
              </div>
            </div>

            {/* Right: Featured Post Card */}
            {featuredPost && (
              <div className="relative group h-80 rounded-xl overflow-hidden border border-gray-700 hover:border-blue-500/50 transition-all duration-300">
                {/* Glowing border effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-amber-500/0 group-hover:from-blue-500/20 group-hover:via-purple-500/20 group-hover:to-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Image */}
                <img
                  src={featuredPost.image}
                  alt={featuredPost.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`text-xs font-mono font-bold tracking-widest ${
                        CATEGORY_COLORS[featuredPost.category] || "text-gray-400"
                      }`}
                    >
                      {featuredPost.category}
                    </span>
                    <span className="text-gray-500 text-xs font-mono">
                      {new Date(featuredPost.publishedDate).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-xl font-heading font-bold mb-3 text-white group-hover:text-blue-300 transition">
                    {featuredPost.title}
                  </h3>
                  <div className="flex items-center gap-2 text-blue-400 font-mono text-sm opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all">
                    Read <ArrowRight size={16} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="bg-gray-950 border-b border-gray-800 px-4 py-8">
        <div className="container mx-auto">
          <p className="text-gray-500 text-sm font-mono mb-4">Filter by</p>
          <div className="flex flex-wrap gap-3">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg font-mono text-xs font-bold tracking-widest transition-all ${
                  selectedCategory === category
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Bento Grid */}
      <section className="bg-gray-950 px-4 py-20">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Featured Post - spans 2 columns */}
            {featuredPost && (
              <Link
                to={`/blog/${featuredPost.slug}`}
                className="lg:col-span-2 group relative overflow-hidden rounded-xl border border-gray-700 hover:border-blue-500/50 transition-all duration-300 bg-gray-900 h-80"
              >
                {/* Glowing border effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-amber-500/0 group-hover:from-blue-500/20 group-hover:via-purple-500/20 group-hover:to-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Image */}
                <img
                  src={featuredPost.image}
                  alt={featuredPost.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className={`text-xs font-mono font-bold tracking-widest ${
                        CATEGORY_COLORS[featuredPost.category] || "text-gray-400"
                      }`}
                    >
                      {featuredPost.category}
                    </span>
                    <span className="text-gray-500 text-xs font-mono">
                      {new Date(featuredPost.publishedDate).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-2xl font-heading font-bold mb-4 text-white group-hover:text-blue-300 transition line-clamp-2">
                    {featuredPost.title}
                  </h3>
                  <div className="flex items-center gap-2 text-blue-400 font-mono text-sm opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-2 transition-all">
                    Read Article <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            )}

            {/* Grid Posts */}
            {otherPosts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group relative overflow-hidden rounded-xl border border-gray-700 hover:border-blue-500/50 transition-all duration-300 bg-gray-900 h-64 aspect-square"
              >
                {/* Glowing border effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-amber-500/0 group-hover:from-blue-500/20 group-hover:via-purple-500/20 group-hover:to-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Image */}
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`text-xs font-mono font-bold tracking-widest ${
                        CATEGORY_COLORS[post.category] || "text-gray-400"
                      }`}
                    >
                      {post.category.split(" ")[0]}
                    </span>
                  </div>
                  <h3 className="text-sm font-heading font-bold text-white group-hover:text-blue-300 transition line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-gray-400 text-xs mt-2 line-clamp-2">{post.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-20">
              <Code2 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">No posts in this category yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 border-t border-gray-800 px-4 py-16">
        <div className="container mx-auto max-w-2xl">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 font-mono">
            <p className="text-green-400 text-sm mb-4">$ ready_to_sprint();</p>
            <h3 className="text-2xl font-heading font-bold text-white mb-3">
              Ready to sprint? Let's build your MVP.
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Take your idea from concept to launch with Agile delivery and clear thinking.
            </p>
            <Link
              to="/contact"
              className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-heading font-bold rounded-lg hover:opacity-90 transition flex items-center gap-2"
            >
              Start Project <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
