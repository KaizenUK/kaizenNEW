import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Code2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import builder from "@/builder";
import { fetchPosts } from "../../src/api/wordpress";
import Layout from "@/components/Layout";

type CoverImage = string | { url?: string } | null;

interface BlogPost {
  id: string;
  data: {
    title: string;
    slug: string;
    excerpt: string;
    publishedDate: string;
    coverImage: CoverImage;
    tags?: string[];
  };
}

interface ProcessedPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  tags: string[];
  image: string;
  publishedDate: string;
}

const TAG_COLORS: Record<string, string> = {
  agile: "text-purple-400",
  design: "text-blue-400",
  seo: "text-amber-400",
  dev: "text-green-400",
  product: "text-pink-400",
  web: "text-cyan-400",
  strategy: "text-rose-400",
  transformation: "text-indigo-400",
};

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1460925895917-aae19e488e71?w=800&h=600&fit=crop";

function extractImageUrl(image: CoverImage): string {
  if (!image) return DEFAULT_IMAGE;
  if (typeof image === "string") return image;
  if (typeof image === "object" && image.url) return image.url;
  return DEFAULT_IMAGE;
}

export default function Blog() {
  const [selectedTag, setSelectedTag] = useState("All");
  const [posts, setPosts] = useState<ProcessedPost[]>([]);
  const [allTags, setAllTags] = useState<string[]>(["All"]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        setIsLoading(true);
        const results = await fetchPosts();

        const processedPosts: ProcessedPost[] = (results || [])
          .map((post) => {
            const coverImage =
              post._embedded &&
              post._embedded["wp:featuredmedia"] &&
              post._embedded["wp:featuredmedia"][0]
                ? post._embedded["wp:featuredmedia"][0].source_url
                : DEFAULT_IMAGE;

            const excerptText = post.excerpt?.rendered
              ? post.excerpt.rendered.replace(/<[^>]*>/g, "").trim()
              : "";

            const tags: string[] = [];

            try {
              const terms = post._embedded?.["wp:term"];
              if (Array.isArray(terms)) {
                terms.forEach((tax: any[]) => {
                  tax.forEach((t) => {
                    if (t && t.name) tags.push(t.name);
                  });
                });
              }
            } catch (e) {
              // ignore
            }

            return {
              id: String(post.id),
              title: post.title?.rendered || "Untitled",
              slug: post.slug || "",
              excerpt: excerptText,
              tags,
              image: coverImage,
              publishedDate: post.date || new Date().toISOString(),
            };
          })
          .sort(
            (a, b) =>
              new Date(b.publishedDate).getTime() -
              new Date(a.publishedDate).getTime(),
          );

        const uniqueTags = new Set<string>();
        processedPosts.forEach((post) => {
          (post.tags || []).forEach((tag) => {
            if (tag) uniqueTags.add(tag);
          });
        });

        setAllTags(["All", ...Array.from(uniqueTags).sort()]);
        setPosts(processedPosts);
      } catch (error) {
        console.error("Failed to fetch blog posts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPosts();
  }, []);

  const filteredPosts = posts.filter(
    (post) => selectedTag === "All" || post.tags.includes(selectedTag),
  );

  const featuredPost = filteredPosts[0];
  const upNextPosts = filteredPosts.slice(1, 4);
  const remainingPosts = filteredPosts.slice(4);

  return (
    <Layout>
      <Helmet>
        <title>Web Design & Agile Insights | Kaizen Blog</title>
        <meta name="description" content="Practical guides on web design, agile delivery, and product ownership. Learn from Kaizen's expert-led insights." />
        <meta name="keywords" content="blog, web design, agile delivery, product ownership, Liverpool" />
      </Helmet>

      {/* Page Loading Animation */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="loading"
            className="fixed inset-0 bg-gray-950 z-50 flex items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="w-12 h-12 border-4 border-gray-800 border-t-blue-400 rounded-full"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header - Premium Animated Masthead */}
      <section className="relative min-h-[90vh] overflow-hidden text-white px-4">
        {/* Animated Background Orbs */}
        <div className="absolute inset-0">
          {/* Top-left cyan orb */}
          <motion.div
            className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl"
            animate={{
              x: [0, 40, 0],
              y: [0, 40, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Bottom-right purple orb */}
          <motion.div
            className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-purple-500/20 blur-3xl"
            animate={{
              x: [0, -40, 0],
              y: [0, -40, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          />

          {/* Center blue orb */}
          <motion.div
            className="absolute top-1/2 left-1/2 w-80 h-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl"
            animate={{
              scale: [0.8, 1.2, 0.8],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Gradient Mesh Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 opacity-70" />

        {/* Grid Background Pattern */}
        <motion.div
          className="absolute inset-0 opacity-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.05 }}
          transition={{ duration: 1 }}
          style={{
            backgroundImage:
              "linear-gradient(0deg, transparent 24%, rgba(255,255,255,.05) 25%, rgba(255,255,255,.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.05) 75%, rgba(255,255,255,.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255,255,255,.05) 25%, rgba(255,255,255,.05) 26%, transparent 27%, transparent 74%, rgba(255,255,255,.05) 75%, rgba(255,255,255,.05) 76%, transparent 77%, transparent)",
            backgroundSize: "50px 50px",
          }}
        />

        {/* Content Container */}
        <div className="container mx-auto max-w-6xl relative z-10 py-20 md:py-32 flex flex-col justify-center">
          {/* Decorative top accent line */}
          <motion.div
            className="h-1 w-20 bg-gradient-to-r from-cyan-400 to-cyan-600 mb-12 rounded-full"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 80, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />

          {/* Massive Animated Header with Letter Reveal */}
          <motion.h1
            className="text-7xl md:text-9xl font-black tracking-tighter leading-none mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-blue-300">
              INSIGHTS
            </span>
          </motion.h1>

          {/* Animated accent line under heading */}
          <motion.div
            className="h-1.5 w-32 bg-gradient-to-r from-cyan-400 via-blue-400 to-transparent mb-8 rounded-full"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 128, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />

          {/* Premium Sub-Headline with Stagger */}
          <motion.div
            className="max-w-3xl mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <p className="text-2xl md:text-3xl leading-relaxed font-light">
              <span className="text-white">Practical guides on </span>
              <span className="text-cyan-400 font-semibold">Web Design</span>
              <span className="text-white">, </span>
              <span className="text-blue-400 font-semibold">Agile Delivery</span>
              <span className="text-white">, and </span>
              <span className="text-purple-400 font-semibold">Product Ownership</span>
              <span className="text-white">.</span>
            </p>
          </motion.div>

          {/* Filter Bar - Premium Horizontal Scroll */}
          <motion.div
            className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            {allTags.map((tag, idx) => (
              <motion.button
                key={`filter-chip-${tag}`}
                onClick={() => setSelectedTag(tag)}
                className={`relative px-5 py-2.5 rounded-full font-mono text-sm font-bold whitespace-nowrap transition-all backdrop-blur ${
                  selectedTag === tag
                    ? "bg-white/20 text-white border border-white/50 shadow-lg shadow-cyan-500/20"
                    : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white/80"
                }`}
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + idx * 0.05 }}
              >
                <span className="relative z-10">{tag}</span>
                {selectedTag === tag && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full"
                    layoutId="activeFilter"
                    transition={{ type: "spring", stiffness: 380, damping: 40 }}
                  />
                )}
              </motion.button>
            ))}
          </motion.div>

          {/* Decorative floating elements */}
          <motion.div
            className="absolute top-1/3 right-20 w-2 h-2 rounded-full bg-cyan-400"
            animate={{
              y: [0, 24, 0],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-1/3 left-32 w-1.5 h-1.5 rounded-full bg-blue-400"
            animate={{
              y: [0, -24, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
          />
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none" />
      </section>

      {/* Bento Grid Section */}
      <section className="bg-gray-950 px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <AnimatePresence mode="wait">
            {filteredPosts.length > 0 ? (
              <motion.div
                key={selectedTag}
                className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[minmax(250px,auto)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                {/* Slot 1: Feature Post - 8 cols, 2 rows */}
                {featuredPost && (
                  <motion.div
                    key={`feature-${featuredPost.id}`}
                    className="col-span-1 md:col-span-8 row-span-2"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Link
                      to={`/blog/${featuredPost.slug}`}
                      className="group relative overflow-hidden rounded-3xl border border-white/5 h-full block"
                    >
                      <img
                        src={featuredPost.image}
                        alt={featuredPost.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        decoding="async"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />

                      <div className="absolute bottom-0 left-0 right-0 p-8">
                        <h2 className="text-3xl font-sans font-bold tracking-tight text-white mb-4 leading-tight">
                          {featuredPost.title}
                        </h2>
                        <p className="text-white/60 text-sm line-clamp-2 mb-4">
                          {featuredPost.excerpt}
                        </p>
                        <div className="flex items-center gap-3">
                          {featuredPost.tags.slice(0, 2).map((tag, idx) => (
                            <span
                              key={`feature-tag-${idx}`}
                              className={`text-xs font-mono text-white/50 uppercase tracking-wider`}
                            >
                              {tag}
                            </span>
                          ))}
                          <span className="text-xs font-mono text-gray-500 ml-auto">
                            {new Date(
                              featuredPost.publishedDate,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )}

                {/* Slot 2: Up Next List - 4 cols, 2 rows */}
                <motion.div
                  className="col-span-1 md:col-span-4 row-span-2 bg-gray-950/50 border border-white/5 rounded-3xl overflow-hidden p-6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <h3 className="text-sm font-mono font-bold text-white/50 uppercase tracking-widest mb-6">
                    Up Next
                  </h3>

                  <div className="space-y-4">
                    {upNextPosts.map((post, idx) => (
                      <Link
                        key={`upnext-${post.id}`}
                        to={`/blog/${post.slug}`}
                        className="flex gap-3 group hover:opacity-80 transition"
                      >
                        <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-white/5">
                          <img
                            src={post.image}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-sans font-bold text-white leading-tight line-clamp-2 mb-1">
                            {post.title}
                          </h4>
                          <p className="text-xs font-mono text-gray-500">
                            {new Date(post.publishedDate).toLocaleDateString()}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.div>

                {/* Slot 3: CTA Card - 4 cols, 1 row */}
                <motion.div
                  className="col-span-1 md:col-span-4 bg-gradient-to-br from-cyan-500/20 to-green-500/20 border border-white/10 rounded-3xl overflow-hidden p-8 flex flex-col justify-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <h3 className="text-xl font-sans font-bold text-white mb-4">
                    Need a project rescue?
                  </h3>
                  <p className="text-white/70 text-sm mb-6 leading-relaxed">
                    Book a triage call to discuss your website challenges.
                  </p>
                  <Link
                    to="/project-rescue"
                    className="inline-flex items-center gap-2 text-cyan-400 font-medium hover:text-cyan-300 transition"
                  >
                    Book a Call <ArrowRight size={16} />
                  </Link>
                </motion.div>

                {/* Slot 4: Standard Grid Posts - 4 cols each */}
                {remainingPosts.map((post, idx) => (
                  <motion.div
                    key={`standard-${post.id}`}
                    className="col-span-1 md:col-span-4"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 + idx * 0.05 }}
                  >
                    <Link
                      to={`/blog/${post.slug}`}
                      className="group relative overflow-hidden rounded-3xl border border-white/5 bg-gray-950/50 hover:border-white/10 transition-all h-full flex flex-col"
                    >
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={post.image}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>

                      <div className="p-6 flex-1 flex flex-col">
                        <h3 className="text-lg font-sans font-bold text-white mb-3 leading-tight line-clamp-2 flex-1">
                          {post.title}
                        </h3>
                        <p className="text-white/50 text-sm line-clamp-2 mb-4">
                          {post.excerpt}
                        </p>
                        <div className="flex items-center gap-2 text-white/40 text-xs">
                          {post.tags.slice(0, 1).map((tag, idx) => (
                            <span key={`post-tag-${idx}`} className="font-mono">
                              {tag}
                            </span>
                          ))}
                          <span className="ml-auto font-mono text-gray-600">
                            {new Date(post.publishedDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                className="text-center py-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Code2 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500">No posts in this category yet.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </Layout>
  );
}
