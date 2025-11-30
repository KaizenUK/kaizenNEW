import { FormEvent, useEffect, useState } from "react";
import { Search } from "lucide-react";

import { CMS_BASE, type WPPost } from "../../src/api/wordpress";
import { decodeHtmlEntities, stripHtmlTags } from "@/lib/html-utils";

export interface BlogSearchResult {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  image: string;
  publishedDate: string;
}

export interface BlogSearchState {
  term: string;
  loading: boolean;
  error: string | null;
  results: BlogSearchResult[];
  hasSearched: boolean;
}

interface BlogSearchProps {
  onStateChange?: (state: BlogSearchState) => void;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => {
      window.clearTimeout(handle);
    };
  }, [value, delay]);

  return debounced;
}

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1460925895917-aae19e488e71?w=800&h=600&fit=crop";

function mapPostToResult(post: WPPost): BlogSearchResult {
  const image =
    post._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? DEFAULT_IMAGE;

  const excerptText = post.excerpt?.rendered
    ? decodeHtmlEntities(stripHtmlTags(post.excerpt.rendered)).trim()
    : "";

  return {
    id: String(post.id),
    title: decodeHtmlEntities(post.title?.rendered || "Untitled"),
    slug: post.slug || "",
    excerpt: excerptText,
    image,
    publishedDate: post.date || new Date().toISOString(),
  };
}

const BlogSearch: React.FC<BlogSearchProps> = ({ onStateChange }) => {
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BlogSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const debouncedTerm = useDebouncedValue(term, 300);

  useEffect(() => {
    const trimmed = debouncedTerm.trim();

    if (!trimmed) {
      setLoading(false);
      setError(null);
      setResults([]);
      setHasSearched(false);

      if (onStateChange) {
        onStateChange({
          term: "",
          loading: false,
          error: null,
          results: [],
          hasSearched: false,
        });
      }

      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    let cancelled = false;

    async function runSearch() {
      setLoading(true);
      setError(null);
      setHasSearched(true);

      if (onStateChange) {
        onStateChange({
          term: trimmed,
          loading: true,
          error: null,
          results: [],
          hasSearched: true,
        });
      }

      try {
        const params = new URLSearchParams({
          search: trimmed,
          _embed: "true",
          per_page: "10",
        });

        const res = await fetch(
          `${CMS_BASE}/wp-json/wp/v2/posts?${params.toString()}`,
          { signal },
        );

        if (!res.ok) {
          if (cancelled) return;
          setError("Unable to search right now");
          setResults([]);

          if (onStateChange) {
            onStateChange({
              term: trimmed,
              loading: false,
              error: "Unable to search right now",
              results: [],
              hasSearched: true,
            });
          }

          return;
        }

        const data: WPPost[] = await res.json();
        if (cancelled) return;

        const mapped = data.map(mapPostToResult);
        setResults(mapped);

        if (onStateChange) {
          onStateChange({
            term: trimmed,
            loading: false,
            error: null,
            results: mapped,
            hasSearched: true,
          });
        }
      } catch (err: unknown) {
        if (cancelled) return;

        if (
          err &&
          typeof err === "object" &&
          "name" in err &&
          (err as { name?: string }).name === "AbortError"
        ) {
          return;
        }

        setError("Unable to search right now");
        setResults([]);

        if (onStateChange) {
          onStateChange({
            term: trimmed,
            loading: false,
            error: "Unable to search right now",
            results: [],
            hasSearched: true,
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    runSearch();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedTerm, onStateChange]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
  };

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={handleSubmit} role="search" aria-label="Search blog">
        <label htmlFor="blog-search" className="sr-only">
          Search articles
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
            <Search className="h-4 w-4" aria-hidden="true" />
          </span>
          <input
            id="blog-search"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search articles by topic, keyword, or phrase"
            className="block w-full rounded-xl border border-gray-300 bg-white/80 py-3 pl-10 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 dark:border-gray-700 dark:bg-gray-900/80 dark:text-white dark:placeholder:text-gray-500"
            aria-label="Search blog articles"
            autoComplete="off"
          />
        </div>
      </form>

      <div
        className="mt-2 min-h-[1.5rem]"
        aria-live="polite"
        aria-atomic="true"
      >
        {loading && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Searching articles...
          </p>
        )}
        {!loading && error && (
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
};

export default BlogSearch;
