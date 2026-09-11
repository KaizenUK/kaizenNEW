import React, { useMemo, useState } from "react";
import { Drawer, usePuck } from "@puckeditor/core";
import {
  BadgePercent,
  Box,
  ChevronDown,
  ChevronUp,
  Columns2,
  GripVertical,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LayoutTemplate,
  ListTree,
  Megaphone,
  Menu as MenuIcon,
  MessageSquareQuote,
  MousePointerClick,
  Navigation,
  Newspaper,
  PanelBottom,
  PanelTop,
  Pilcrow,
  Plus,
  Puzzle,
  Rows3,
  Search,
  Shapes,
  Star,
  TextCursorInput,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { Block, Theme } from "../../shared/visualBuilder";
import SectionLibrary from "./SectionLibrary";

/* The "Blocks" panel: every draggable component grouped by category, searchable, with
   ready-made sections shown as small previews in the page's own colours. */

const icons: Record<string, LucideIcon> = {
  Section: Rows3,
  Container: Box,
  Columns: Columns2,
  Grid: LayoutGrid,
  Text: Type,
  RichText: Pilcrow,
  Image: ImageIcon,
  Icon: Star,
  Button: MousePointerClick,
  Menu: MenuIcon,
  Accordion: ListTree,
  Tabs: PanelTop,
  Video: Video,
  ContactForm: TextCursorInput,
  ContentList: Newspaper,
  Navigation: Navigation,
  Hero: LayoutTemplate,
  Features: LayoutGrid,
  Gallery: Images,
  Testimonials: MessageSquareQuote,
  Pricing: BadgePercent,
  CallToAction: Megaphone,
  Footer: PanelBottom,
  Shared: Shapes,
  Registered: Puzzle,
};
const iconFor = (name: string) =>
  icons[name] ||
  (name.startsWith("Reviewed_")
    ? Puzzle
    : name.startsWith("Shared_")
      ? Shapes
      : Box);

type Rect = [number, number, number, number, boolean?, number?];
const wires: Record<string, Rect[]> = {
  Navigation: [
    [10, 10, 16, 5],
    [48, 11, 8, 3, true],
    [58, 11, 8, 3, true],
    [68, 11, 8, 3, true],
    [78, 9, 10, 7, true, 3],
    [10, 24, 76, 40, true, 4],
  ],
  Hero: [
    [10, 8, 20, 3],
    [64, 8, 22, 3, true],
    [10, 20, 34, 6],
    [10, 30, 30, 6],
    [10, 42, 22, 3, true],
    [10, 50, 16, 7, true, 3],
    [52, 20, 34, 38, true, 4],
  ],
  Features: [
    [10, 8, 26, 4],
    [10, 20, 22, 44, true, 3],
    [37, 20, 22, 44, true, 3],
    [64, 20, 22, 44, true, 3],
    [14, 26, 8, 8, false, 4],
    [41, 26, 8, 8, false, 4],
    [68, 26, 8, 8, false, 4],
  ],
  Gallery: [
    [10, 8, 24, 20, true, 3],
    [36, 8, 24, 20, true, 3],
    [62, 8, 24, 20, true, 3],
    [10, 30, 24, 20, true, 3],
    [36, 30, 24, 20, true, 3],
    [62, 30, 24, 20, true, 3],
    [10, 56, 30, 4],
  ],
  Testimonials: [
    [10, 12, 36, 48, true, 4],
    [50, 12, 36, 48, true, 4],
    [15, 18, 8, 8, false, 4],
    [55, 18, 8, 8, false, 4],
    [15, 32, 26, 3],
    [15, 38, 22, 3],
    [55, 32, 26, 3],
    [55, 38, 22, 3],
  ],
  Pricing: [
    [10, 8, 22, 56, true, 4],
    [37, 4, 22, 64, false, 4],
    [64, 8, 22, 56, true, 4],
    [41, 12, 14, 5, true],
    [41, 54, 14, 6, true, 3],
    [14, 16, 14, 5],
    [68, 16, 14, 5],
  ],
  CallToAction: [
    [10, 12, 76, 48, false, 6],
    [26, 24, 44, 6, true],
    [32, 34, 32, 3, true],
    [38, 44, 20, 7, true, 3],
  ],
  Footer: [
    [10, 10, 76, 52, false, 4],
    [16, 18, 18, 4, true],
    [16, 26, 14, 3, true],
    [16, 32, 14, 3, true],
    [44, 18, 14, 3, true],
    [44, 24, 14, 3, true],
    [66, 18, 14, 3, true],
    [16, 52, 40, 3, true],
  ],
};

function Wire({ name, theme }: { name: string; theme: Theme }) {
  const rects = wires[name] || wires.Hero;
  return (
    <svg viewBox="0 0 96 72" aria-hidden="true">
      <rect width="96" height="72" fill={theme.background} />
      {rects.map(([x, y, w, h, soft, rx], index) => (
        <rect
          key={index}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={rx ?? 2}
          fill={soft ? theme.accent : theme.color}
          opacity={soft ? 0.9 : 0.7}
        />
      ))}
    </svg>
  );
}

export default function BlockPalette({
  theme,
  onInsert,
}: {
  theme: Theme;
  onInsert: (block: Block) => void;
}) {
  const { config } = usePuck();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const categories = useMemo(
    () =>
      Object.entries(config.categories || {})
        .filter(
          ([, category]) =>
            category.visible !== false && (category.components || []).length,
        )
        .map(([id, category]) => ({
          id,
          title: category.title || id,
          components: (category.components || [])
            .filter((name) => config.components[name])
            .map((name) => ({
              name,
              label: config.components[name].label || name,
            })),
        }))
        // Ready-made sections are the fastest way to build, so they come first.
        .sort((a, b) =>
          a.id === "sections" ? -1 : b.id === "sections" ? 1 : 0,
        ),
    [config],
  );
  const needle = query.trim().toLowerCase();
  const matches = (label: string) =>
    !needle || label.toLowerCase().includes(needle);
  const anyMatch = categories.some((category) =>
    category.components.some((item) => matches(item.label)),
  );
  return (
    <div className="builder-palette">
      <label className="builder-search-field builder-palette-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search blocks"
          placeholder="Search blocks and sections"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {/* One Drawer for every group: Puck registers a single drop-back zone per drawer id. */}
      <Drawer>
        {categories.map((category) => {
          const items = category.components.filter((item) =>
            matches(item.label),
          );
          if (!items.length) return null;
          const open = needle ? true : !collapsed[category.id];
          const sections = category.id === "sections";
          return (
            <section className="builder-palette-group" key={category.id}>
              <header>
                <span>{category.title}</span>
                <button
                  type="button"
                  aria-label={`${open ? "Collapse" : "Expand"} ${category.title}`}
                  aria-expanded={open}
                  onClick={() =>
                    setCollapsed({ ...collapsed, [category.id]: open })
                  }
                >
                  {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </header>
              {open && sections && (
                <>
                  <div className="builder-block-grid">
                    {items.map((item) => (
                      <Drawer.Item
                        key={item.name}
                        name={item.name}
                        label={item.label}
                      >
                        {() => (
                          <div className="builder-block-card">
                            <div className="builder-block-card-thumb">
                              <Wire name={item.name} theme={theme} />
                            </div>
                            <span>{item.label}</span>
                          </div>
                        )}
                      </Drawer.Item>
                    ))}
                  </div>
                  <SectionLibrary theme={theme} onInsert={onInsert} />
                </>
              )}
              {open && !sections && (
                <div className="builder-block-list">
                  {items.map((item) => {
                    const Icon = iconFor(item.name);
                    return (
                      <Drawer.Item
                        key={item.name}
                        name={item.name}
                        label={item.label}
                      >
                        {() => (
                          <div className="builder-block-item">
                            <GripVertical size={16} aria-hidden="true" />
                            <Icon size={18} aria-hidden="true" />
                            <span>{item.label}</span>
                            <Plus size={14} aria-hidden="true" />
                          </div>
                        )}
                      </Drawer.Item>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </Drawer>
      {needle && !anyMatch && (
        <p className="builder-palette-empty">No blocks match “{query}”.</p>
      )}
    </div>
  );
}
