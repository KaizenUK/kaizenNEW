import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, ZoomOut } from "lucide-react";

/**
 * Mount once on the page with `client:load`.
 * Any `<img data-lightbox>` on the page becomes clickable.
 * Images are grouped and navigable with arrow keys / buttons.
 */
export default function ImageLightbox() {
  const [images, setImages] = useState<Array<{ src: string; alt: string }>>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isOpen = activeIndex !== null;

  const close = useCallback(() => {
    setActiveIndex(null);
    setZoom(1);
  }, []);

  // Collect all lightbox images and attach click handlers
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLImageElement>("img[data-lightbox]")
    );
    const data = els.map((el) => ({
      src: el.src,
      alt: el.alt || "",
    }));
    setImages(data);

    const handlers = els.map((el, i) => {
      const handler = () => {
        setActiveIndex(i);
        setZoom(1);
      };
      el.style.cursor = "zoom-in";
      el.addEventListener("click", handler);
      return { el, handler };
    });

    return () => {
      handlers.forEach(({ el, handler }) =>
        el.removeEventListener("click", handler)
      );
    };
  }, []);

  // Lock scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isOpen || activeIndex === null) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" && activeIndex < images.length - 1) {
        setActiveIndex(activeIndex + 1);
        setZoom(1);
      }
      if (e.key === "ArrowLeft" && activeIndex > 0) {
        setActiveIndex(activeIndex - 1);
        setZoom(1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, activeIndex, images.length, close]);

  const zoomIn = () => {
    setZoom((z) => Math.min(z + 0.5, 3));
  };
  const zoomOut = () => {
    setZoom((z) => Math.max(z - 0.5, 0.5));
  };

  // Reset scroll position when changing images
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0, 0);
    }
  }, [activeIndex]);

  if (images.length === 0) return null;

  return (
    <AnimatePresence>
      {isOpen && activeIndex !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={close}
        >
          {/* Top-right controls */}
          <div
            className="absolute top-4 right-4 z-10 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={zoomOut}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="min-w-[3rem] text-center text-sm text-white/60">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <button
              onClick={close}
              className="ml-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Close lightbox"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Prev / Next arrows */}
          {images.length > 1 && activeIndex > 0 && (
            <button
              className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(activeIndex - 1);
                setZoom(1);
              }}
              aria-label="Previous image"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          )}
          {images.length > 1 && activeIndex < images.length - 1 && (
            <button
              className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(activeIndex + 1);
                setZoom(1);
              }}
              aria-label="Next image"
            >
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          )}

          {/* Image container */}
          <motion.div
            key={activeIndex}
            ref={scrollRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="max-h-[85vh] max-w-[90vw] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[activeIndex].src}
              alt={images[activeIndex].alt}
              className="block rounded-lg"
              style={
                zoom === 1
                  ? {
                      width: "100%",
                      maxHeight: "85vh",
                      objectFit: "contain",
                    }
                  : {
                      maxWidth: "none",
                      width: `${zoom * 100}%`,
                    }
              }
            />
          </motion.div>

          {/* Caption + counter */}
          <p className="absolute bottom-4 left-1/2 max-w-lg -translate-x-1/2 text-center text-sm text-white/50">
            {images[activeIndex].alt}
            {images.length > 1 && (
              <span className="ml-3 text-white/30">
                {activeIndex + 1} / {images.length}
              </span>
            )}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
