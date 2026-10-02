import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, ArrowRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "./untitled/base/buttons/button";

type GalleryImage = { src: string; alt: string; width: number; height: number };

/** Enhances full-image links while preserving their no-JavaScript destination. */
export default function ImageLightbox() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const isOpen = activeIndex !== null;
  const close = useCallback(() => setActiveIndex(null), []);

  useEffect(() => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[data-lightbox-link]"));
    const entries = links.flatMap((link) => {
      const image = link.querySelector<HTMLImageElement>("img[data-lightbox]");
      return image ? [{ link, image }] : [];
    });
    setImages(entries.map(({ link, image }) => ({
      src: link.href,
      alt: image.alt,
      width: Number(image.getAttribute("width")),
      height: Number(image.getAttribute("height")),
    })));
    const handlers = entries.map(({ link }, index) => {
      const handler = (event: MouseEvent) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (typeof dialogRef.current?.showModal !== "function") return;
        event.preventDefault();
        openerRef.current = link;
        setZoom(1);
        setActiveIndex(index);
      };
      link.addEventListener("click", handler);
      return { link, handler };
    });
    return () => handlers.forEach(({ link, handler }) => link.removeEventListener("click", handler));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[aria-label="Close image viewer"]')?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!isOpen || !viewport) return;
    const update = () => setBounds({ width: viewport.clientWidth, height: viewport.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => { viewportRef.current?.scrollTo(0, 0); }, [activeIndex]);

  // A control can lose focus when it becomes disabled at either end of the gallery.
  // Keep arrow navigation available throughout the native modal in that state.
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      setActiveIndex((index) => index === null ? null : Math.max(0, Math.min(images.length - 1, index + direction)));
      setZoom(1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, images.length]);

  const move = (direction: number) => {
    if (activeIndex === null) return;
    setActiveIndex(Math.max(0, Math.min(images.length - 1, activeIndex + direction)));
    setZoom(1);
  };
  const image = activeIndex === null ? undefined : images[activeIndex];
  const fit = image ? Math.min(bounds.width / image.width, bounds.height / image.height, 1) : 1;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="image-viewer-title"
      aria-describedby="image-viewer-caption"
      className="fixed m-auto w-[calc(100%-2rem)] max-w-6xl max-h-[94dvh] overflow-auto rounded-2xl border border-slate-600 bg-uui-dark p-4 text-white shadow-2xl backdrop:bg-slate-950/90 sm:p-6"
      onCancel={close}
      onClose={(event) => {
        // A queued close event from the previous image must not close a reopened dialog.
        if (!event.currentTarget.open) close();
      }}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="image-viewer-title" className="font-heading text-xl font-bold">Midland website images</h2>
        <Button color="secondary" size="lg" iconLeading={X} aria-label="Close image viewer" onPress={close} />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button color="secondary" size="lg" iconLeading={ZoomOut} aria-label="Zoom out" isDisabled={zoom <= 0.5} onPress={() => setZoom((value) => Math.max(0.5, value - 0.5))} />
          <output aria-label="Image zoom" className="w-12 text-center text-sm font-semibold">{Math.round(zoom * 100)}%</output>
          <Button color="secondary" size="lg" iconLeading={ZoomIn} aria-label="Zoom in" isDisabled={zoom >= 3} onPress={() => setZoom((value) => Math.min(3, value + 0.5))} />
        </div>
        <div className="flex items-center gap-2">
          <Button color="secondary" size="lg" iconLeading={ArrowLeft} aria-label="Previous image" isDisabled={activeIndex === null || activeIndex === 0} onPress={() => move(-1)} />
          <Button color="secondary" size="lg" iconLeading={ArrowRight} aria-label="Next image" isDisabled={activeIndex === null || activeIndex === images.length - 1} onPress={() => move(1)} />
        </div>
      </div>
      <div ref={viewportRef} className="h-[52dvh] overflow-auto rounded-lg bg-slate-950" tabIndex={0} role="region" aria-label="Full-size image. Scroll when zoomed in.">
        {image && <img src={image.src} alt={image.alt} width={image.width} height={image.height} className="mx-auto block max-w-none" style={{ width: image.width * fit * zoom, height: image.height * fit * zoom }} />}
      </div>
      <p id="image-viewer-caption" className="mt-4 text-sm leading-6 text-slate-200" aria-live="polite">
        {image?.alt}{activeIndex !== null && <span className="ml-2 whitespace-nowrap">({activeIndex + 1} of {images.length})</span>}
      </p>
    </dialog>
  );
}
