import Layout from "@/components/Layout";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
    coverImage?: any;
    tags?: string[];
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
  tags: string[];
  category: string;
  author: {
    name: string;
    role: string;
    image: string;
  };
  readingTime: number;
  tableOfContents: { id: string; title: string; level: number }[];
}

interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  publishedDate: string;
}

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1460925895917-aae19e488e71?w=800&h=600&fit=crop";

function extractImageUrl(image: any): string {
  if (!image) return DEFAULT_IMAGE;
  if (typeof image === "string") return image;
  if (typeof image === "object" && image.url) return image.url;
  return DEFAULT_IMAGE;
}

function calculateReadingTime(html: string): number {
  if (!html) return 0;
  const textContent = html.replace(/<[^>]*>/g, "");
  const wordCount = textContent.trim().split(/\s+/).length;
  return Math.ceil(wordCount / 200);
}

function addIdsToHeadings(html: string): string {
  if (!html) return html;

  const idMap: { [key: string]: number } = {};

  let result = html;

  const h2Regex = /<h2([^>]*)>(.*?)<\/h2>/gi;
  result = result.replace(h2Regex, (match, attrs, content) => {
    if (attrs.includes('id="')) return match;

    const text = content.replace(/<[^>]*>/g, "").trim();
    let id = text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    if (idMap[id]) {
      idMap[id]++;
      id = `${id}-${idMap[id]}`;
    } else {
      idMap[id] = 1;
    }

    return `<h2 id="${id}"${attrs}>${content}</h2>`;
  });

  const h3Regex = /<h3([^>]*)>(.*?)<\/h3>/gi;
  result = result.replace(h3Regex, (match, attrs, content) => {
    if (attrs.includes('id="')) return match;

    const text = content.replace(/<[^>]*>/g, "").trim();
    let id = text
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    if (idMap[id]) {
      idMap[id]++;
      id = `${id}-${idMap[id]}`;
    } else {
      idMap[id] = 1;
    }

    return `<h3 id="${id}"${attrs}>${content}</h3>`;
  });

  return result;
}

function extractHeadings(html: string): { id: string; title: string; level: number }[] {
  const headings: { id: string; title: string; level: number }[] = [];

  if (!html) {
    return [{ id: "content", title: "Content", level: 2 }];
  }

  const h2Regex = /<h2[^>]*id="([^"]*)"[^>]*>(.*?)<\/h2>/gi;
  let match;

  while ((match = h2Regex.exec(html)) !== null) {
    const id = match[1];
    const text = match[2].replace(/<[^>]*>/g, "").trim();
    if (text && id) {
      headings.push({ id, title: text, level: 2 });
    }
  }

  return headings.length > 0 ? headings : [{ id: "content", title: "Content", level: 2 }];
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

function Author({
  name,
  role,
  image,
}: {
  name: string;
  role: string;
  image: string;
}) {
  return (
    <motion.div
      className="bg-gray-900 border border-gray-800 rounded-lg p-6"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.7 }}
    >
      <p className="text-xs font-mono text-gray-500 font-bold tracking-widest mb-4">
        AUTHOR
      </p>
      <div className="flex items-center gap-4">
        <img
          src={image}
          alt={name}
          className="w-12 h-12 rounded-full object-cover"
        />
        <div>
          <p className="font-heading font-bold text-white">{name}</p>
          <p className="text-xs text-gray-400">{role}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<ProcessedPost | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("content");
  const [scrollProgress, setScrollProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const scaleX = useSpring(0, { stiffness: 100, damping: 30 });

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) {
        setIsLoading(false);
        return;
      }

      try {
        const results = await builder.getAll("blog-post", {
          fields:
            "data.title,data.slug,data.body,data.publishedDate,data.coverImage,data.excerpt,data.tags",
          query: { "data.slug": slug },
          limit: 1,
        });

        if (results && results.length > 0) {
          const builderPost = results[0] as BlogPostDetail;
          const bodyContent = builderPost.data.body || "";
          const bodyWithIds = addIdsToHeadings(bodyContent);
          const headings = extractHeadings(bodyWithIds);

          const processedPost: ProcessedPost = {
            id: builderPost.id,
            title: builderPost.data.title || "Untitled",
            slug: builderPost.data.slug || slug,
            publishedDate: builderPost.data.publishedDate || new Date().toISOString(),
            body: bodyWithIds,
            coverImage: extractImageUrl(builderPost.data.coverImage),
            excerpt: builderPost.data.excerpt || "",
            tags: Array.isArray(builderPost.data.tags) ? builderPost.data.tags : [],
            category: "Blog Post",
            author: {
              name: "Kaizen",
              role: "Web Design & Agile",
              image:
                "https://cdn.builder.io/api/v1/image/assets%2Fe4ae46bbd81b4b95bef54d66dd9748cc%2Fbe9c606a991946d9b3a5d47d9cfbf290?format=webp&width=800",
            },
            readingTime: calculateReadingTime(bodyContent),
            tableOfContents: headings,
          };

          setPost(processedPost);

          // Fetch related posts
          const allPosts = await builder.getAll("blog-post", {
            fields: "data.title,data.slug,data.publishedDate",
            limit: 10,
          });

          const filtered = (allPosts as BlogPostDetail[])
            .filter((p) => p.data.slug !== slug)
            .slice(0, 2)
            .map((p) => ({
              id: p.id,
              title: p.data.title || "Untitled",
              slug: p.data.slug || "",
              publishedDate: p.data.publishedDate || new Date().toISOString(),
            }));

          setRelatedPosts(filtered);
        } else {
          setPost(null);
        }
      } catch (error) {
        console.error("Failed to fetch blog post:", error);
        setPost(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

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

    const headings = contentRef.current.querySelectorAll("h2[id]");
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
        <div className="flex items-center justify-center min-h-screen">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-12 h-12 border-4 border-gray-800 border-t-blue-400 rounded-full"
          />
        </div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4">
          <h1 className="text-4xl font-heading font-bold mb-4">Post Not Found</h1>
          <p className="text-gray-400 mb-8">The blog post you're looking for doesn't exist.</p>
          <Link
            to="/blog"
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-heading font-bold rounded-lg hover:opacity-90 transition flex items-center gap-2"
          >
            <ArrowLeft size={18} />
            Back to Blog
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 z-50"
        style={{ scaleX, transformOrigin: "left" }}
      />

      {/* Hero Image Section */}
      <motion.div
        className="relative h-96 overflow-hidden bg-gray-900"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <img
          src={post.coverImage}
          alt={post.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent" />

        <div className="absolute top-4 left-4">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900/80 hover:bg-gray-900 text-gray-300 rounded-lg transition font-mono text-sm"
          >
            <ArrowLeft size={16} />
            Back to Blog
          </Link>
        </div>
      </motion.div>

      {/* Content Section */}
      <section className="bg-gray-950 text-white py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-3">
              <motion.article
                className="max-w-3xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {/* Header */}
                <div className="mb-8">
                  <h1 className="text-5xl font-heading font-bold mb-4">{post.title}</h1>

                  <div className="flex items-center gap-6 text-gray-400 font-mono text-sm flex-wrap">
                    <span>{new Date(post.publishedDate).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{post.readingTime} min read</span>
                  </div>
                </div>

                {/* Body Content - with prose styling for HTML */}
                <div
                  ref={contentRef}
                  className="prose prose-invert prose-lg max-w-none mb-12 prose-h2:text-3xl prose-h2:font-heading prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-4 prose-p:text-gray-300 prose-a:text-blue-400 prose-a:hover:text-blue-300 prose-code:text-amber-300 prose-code:bg-gray-900 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800"
                  dangerouslySetInnerHTML={{ __html: post.body }}
                />

                {/* Tags */}
                {post.tags.length > 0 && (
                  <div className="flex gap-3 flex-wrap mb-12 pt-8 border-t border-gray-800">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-xs font-mono font-bold tracking-widest"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.article>

              {/* CTA Section */}
              <motion.section
                className="bg-gray-900 border border-gray-800 rounded-lg p-8 my-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
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
              </motion.section>

              {/* More from Blog */}
              {relatedPosts.length > 0 && (
                <motion.section
                  className="py-12"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  <h2 className="text-3xl font-heading font-bold mb-8">More from the Blog</h2>
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
                </motion.section>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                <TableOfContents items={post.tableOfContents} activeId={activeSection} />
                <Author
                  name={post.author.name}
                  role={post.author.role}
                  image={post.author.image}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
