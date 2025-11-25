import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Code2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import builder from "@/builder";
import { fetchPosts } from "../../src/api/wordpress";
import Layout from "@/components/Layout";
import { decodeHtmlEntities, stripHtmlTags } from "@/lib/html-utils";

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
              ? decodeHtmlEntities(stripHtmlTags(post.excerpt.rendered)).trim()
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
              title: decodeHtmlEntities(post.title?.rendered || "Untitled"),
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
        <meta
          name="description"
          content="Practical guides on web design, agile delivery, and product ownership. Learn from Kaizen's expert-led insights."
        />
        <meta
          name="keywords"
          content="blog, web design, agile delivery, product ownership, Liverpool"
        />
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

      {/* Page Header - Clean Modern Masthead with Featured Post */}
      <section className="relative bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-hidden min-h-[600px]">
        {/* Decorative background elements */}
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-blue-200/30 dark:bg-blue-500/10 blur-3xl"
          animate={{
            y: [0, 40, 0],
            x: [0, 40, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-cyan-200/30 dark:bg-cyan-500/10 blur-3xl"
          animate={{
            y: [0, -40, 0],
            x: [0, -40, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />

        <div className="container mx-auto max-w-6xl px-4 py-16 md:py-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Title, Subtitle, Description, Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Title */}
              <h1 className="text-5xl md:text-6xl font-black text-gray-950 dark:text-white mb-4 leading-tight">
                The Kaizen Blog
              </h1>

              {/* Subtitle */}
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-6 font-light">
                Iterate. Ship. Improve.
              </p>

              {/* Description */}
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-10 leading-relaxed max-w-xl">
                Deep dives into web design, Agile methodology, and building
                products that matter. We write about what we actually do, not
                what sounds good.
              </p>

              {/* Filter Bar */}
              <div className="flex flex-wrap gap-3">
                {allTags.map((tag, idx) => (
                  <motion.button
                    key={`filter-chip-${tag}`}
                    onClick={() => setSelectedTag(tag)}
                    className={`relative px-5 py-2.5 rounded-full font-mono text-xs font-bold transition-all backdrop-blur group overflow-hidden ${
                      selectedTag === tag
                        ? "text-white dark:text-gray-950 shadow-lg"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white"
                    }`}
                    whileHover={{ scale: 1.08, y: -3 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.06 }}
                  >
                    {/* Background gradient that changes on active state */}
                    <motion.div
                      className={`absolute inset-0 rounded-full transition-all ${
                        selectedTag === tag
                          ? "bg-gradient-to-r from-cyan-500 to-blue-600 dark:from-cyan-400 dark:to-blue-500 shadow-lg shadow-cyan-500/50 dark:shadow-cyan-400/30"
                          : "bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800"
                      }`}
                      initial={{ scale: 1 }}
                      animate={{ scale: selectedTag === tag ? 1 : 1 }}
                      transition={{ duration: 0.3 }}
                    />

                    {/* Text and animated underline */}
                    <div className="relative z-10 flex items-center gap-1">
                      <span>{tag}</span>
                      {selectedTag === tag && (
                        <motion.div
                          className="inline-block"
                          animate={{ x: [0, 2, 0] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        >
                          ✓
                        </motion.div>
                      )}
                    </div>

                    {/* Hover effect border */}
                    {selectedTag !== tag && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-transparent group-hover:border-gray-300 dark:group-hover:border-gray-600"
                        whileHover={{
                          borderColor: "rgb(var(--kaizen-cyan) / 0.5)",
                        }}
                      />
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Right: Featured Post Card */}
            {featuredPost && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Link
                  to={`/blog/${featuredPost.slug}`}
                  className="group block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all hover:shadow-lg dark:hover:shadow-lg dark:hover:shadow-cyan-500/10"
                >
                  {/* Featured Post Image */}
                  <div className="relative h-64 overflow-hidden bg-gray-200 dark:bg-gray-800">
                    <img
                      src={featuredPost.image}
                      alt={featuredPost.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-60 group-hover:opacity-50 transition-opacity" />
                  </div>

                  {/* Featured Post Content */}
                  <div className="p-6 bg-white dark:bg-gray-900 relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      {featuredPost.tags.slice(0, 2).map((tag, idx) => (
                        <span
                          key={`featured-tag-${idx}`}
                          className="text-xs font-mono text-gray-600 dark:text-gray-400 uppercase tracking-wider"
                        >
                          {tag}
                        </span>
                      ))}
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-500 ml-auto">
                        {new Date(
                          featuredPost.publishedDate,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-950 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                      {featuredPost.title}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-3 line-clamp-2">
                      {featuredPost.excerpt}
                    </p>
                  </div>
                </Link>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Bento Grid Section */}
      <section className="bg-white dark:bg-gray-950 px-4 py-20 min-h-screen">
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
                {filteredPosts.length > 1 && (
                  <motion.div
                    key={`feature-${filteredPosts[1]?.id}`}
                    className="col-span-1 md:col-span-8 row-span-2"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Link
                      to={`/blog/${filteredPosts[1]?.slug}`}
                      className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 h-full block hover:border-gray-300 dark:hover:border-gray-700 transition-all"
                    >
                      <img
                        src={filteredPosts[1]?.image}
                        alt={filteredPosts[1]?.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        decoding="async"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />

                      <div className="absolute bottom-0 left-0 right-0 p-8">
                        <h2 className="text-3xl font-sans font-bold tracking-tight text-white mb-4 leading-tight">
                          {filteredPosts[1]?.title}
                        </h2>
                        <p className="text-white/70 text-sm line-clamp-2 mb-4">
                          {filteredPosts[1]?.excerpt}
                        </p>
                        <div className="flex items-center gap-3">
                          {filteredPosts[1]?.tags
                            .slice(0, 2)
                            .map((tag, idx) => (
                              <span
                                key={`feature-tag-${idx}`}
                                className={`text-xs font-mono text-white/60 uppercase tracking-wider`}
                              >
                                {tag}
                              </span>
                            ))}
                          <span className="text-xs font-mono text-gray-400 ml-auto">
                            {new Date(
                              filteredPosts[1]?.publishedDate,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )}

                {/* Slot 2: Up Next List - 4 cols, 2 rows */}
                <motion.div
                  className="col-span-1 md:col-span-4 row-span-2 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden p-6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <h3 className="text-sm font-mono font-bold text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-6">
                    Up Next
                  </h3>

                  <div className="space-y-4">
                    {upNextPosts.map((post) => (
                      <Link
                        key={`upnext-${post.id}`}
                        to={`/blog/${post.slug}`}
                        className="flex gap-3 group hover:opacity-70 transition"
                      >
                        <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
                          <img
                            src={post.image}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-sans font-bold text-gray-950 dark:text-white leading-tight line-clamp-2 mb-1">
                            {post.title}
                          </h4>
                          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                            {new Date(post.publishedDate).toLocaleDateString()}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.div>

                {/* Slot 3: CTA Card - 4 cols, 1 row */}
                <motion.div
                  className="col-span-1 md:col-span-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-cyan-900/30 rounded-2xl overflow-hidden p-8 flex flex-col justify-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <h3 className="text-xl font-sans font-bold text-gray-950 dark:text-white mb-4">
                    Need a project rescue?
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 text-sm mb-6 leading-relaxed">
                    Book a triage call to discuss your website challenges.
                  </p>
                  <Link
                    to="/project-rescue"
                    className="inline-flex items-center gap-2 text-blue-600 dark:text-cyan-400 font-medium hover:text-blue-700 dark:hover:text-cyan-300 transition"
                  >
                    Book a 15 Minute Call <ArrowRight size={16} />
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
                      className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-all h-full flex flex-col"
                    >
                      <div className="relative h-48 overflow-hidden bg-gray-200 dark:bg-gray-800">
                        <img
                          src={post.image}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>

                      <div className="p-6 flex-1 flex flex-col">
                        <h3 className="text-lg font-sans font-bold text-gray-950 dark:text-white mb-3 leading-tight line-clamp-2 flex-1">
                          {post.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4">
                          {post.excerpt}
                        </p>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-xs">
                          {post.tags.slice(0, 1).map((tag, idx) => (
                            <span key={`post-tag-${idx}`} className="font-mono">
                              {tag}
                            </span>
                          ))}
                          <span className="ml-auto font-mono text-gray-400 dark:text-gray-600">
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
                <Code2 className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No posts in this category yet.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </Layout>
  );
}
