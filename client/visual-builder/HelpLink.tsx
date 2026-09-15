import guideUrl from "../../docs/visual-builder.md?url";
import React, { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, X } from "lucide-react";
import {
  helpTopics,
  helpLinkTarget,
  readHelpSection,
  type HelpTopic,
  type HelpBlock,
} from "./helpContent";

function Inline({
  text,
  onTopic,
}: {
  text: string;
  onTopic: (topic: HelpTopic) => void;
}) {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^\s)]+\))/g)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={index}>{part.slice(1, -1)}</code>;
      const match = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(part);
      const target = match && helpLinkTarget(match[2]);
      if (match && target)
        return "topic" in target ? (
          <a
            key={index}
            href={`#help-${target.topic}`}
            className="builder-help-link"
            onClick={(event) => {
              event.preventDefault();
              onTopic(target.topic);
            }}
          >
            {match[1]}
          </a>
        ) : (
          <a
            key={index}
            href={target.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {match[1]}
          </a>
        );
      return (
        <React.Fragment key={index}>{match ? match[1] : part}</React.Fragment>
      );
    });
}

export default function HelpLink({
  topic,
  children = "Learn more",
}: {
  topic: HelpTopic;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(topic);
  const [history, setHistory] = useState<HelpTopic[]>([]);
  const [content, setContent] = useState<HelpBlock[]>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [theme, setTheme] = useState("light");
  const trigger = useRef<HTMLButtonElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!open) return;
    let current = true;
    const controller = new AbortController();
    setContent(undefined);
    setError("");
    void fetch(guideUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Help unavailable");
        const markdown = await response.text();
        if (markdown.length > 1_000_000) throw new Error("Help unavailable");
        const blocks = readHelpSection(markdown, selected);
        if (current)
          setContent(
            blocks[0]?.kind === "heading" &&
              blocks[0].text === helpTopics[selected].title
              ? blocks.slice(1)
              : blocks,
          );
      })
      .catch(() => {
        if (current)
          setError(
            "This help could not be loaded. Try again; your work is still here.",
          );
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [open, selected, attempt]);
  const changeTopic = (next: HelpTopic) => {
    setHistory((old) => [...old, selected]);
    setSelected(next);
    requestAnimationFrame(() => heading.current?.focus());
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (value) {
          setSelected(topic);
          setHistory([]);
          setTheme(
            trigger.current
              ?.closest("[data-theme]")
              ?.getAttribute("data-theme") || "light",
          );
        }
        setOpen(value);
      }}
    >
      <Dialog.Trigger asChild>
        <button
          ref={trigger}
          type="button"
          className="builder-help-link"
          aria-label={`Learn more about ${helpTopics[topic].title}`}
        >
          {children}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="builder-help-overlay" />
        <Dialog.Content
          className="builder-app builder-help-drawer"
          data-theme={theme}
        >
          <div className="builder-help-header">
            <div>
              <Dialog.Title ref={heading} tabIndex={-1}>
                {helpTopics[selected].title}
              </Dialog.Title>
              <Dialog.Description>
                Guidance for your next step.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close help">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              className="builder-help-back"
              onClick={() => {
                setSelected(history[history.length - 1]);
                setHistory((old) => old.slice(0, -1));
                requestAnimationFrame(() => heading.current?.focus());
              }}
            >
              <ArrowLeft size={16} />
              Back to {helpTopics[history[history.length - 1]].title}
            </button>
          )}
          <div className="builder-help-content">
            {!content && !error && <p role="status">Loading help…</p>}
            {error && (
              <>
                <p role="alert">{error}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Try loading help again
                </button>
              </>
            )}
            {content?.map((block, index) =>
              block.kind === "heading" ? (
                <h3 key={index}>{block.text}</h3>
              ) : block.kind === "paragraph" ? (
                <p key={index}>
                  <Inline text={block.text} onTopic={changeTopic} />
                </p>
              ) : block.ordered ? (
                <ol key={index}>
                  {block.items.map((item, i) => (
                    <li key={i}>
                      <Inline text={item} onTopic={changeTopic} />
                    </li>
                  ))}
                </ol>
              ) : (
                <ul key={index}>
                  {block.items.map((item, i) => (
                    <li key={i}>
                      <Inline text={item} onTopic={changeTopic} />
                    </li>
                  ))}
                </ul>
              ),
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
