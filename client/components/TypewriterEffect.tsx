import { useEffect, useState } from "react";

interface TypewriterEffectProps {
  words: string[];
  speed?: number;
  delayBetweenWords?: number;
  className?: string;
  /** When false (default), the animation runs once and stops on the final word. */
  loop?: boolean;
}

export function TypewriterEffect({
  words,
  speed = 100,
  delayBetweenWords = 1500,
  className = "",
  loop = false,
}: TypewriterEffectProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    const currentWord = words[currentWordIndex] ?? "";

    // Done (non-looping): stop timers and keep the final word
    if (!loop && currentWordIndex === words.length - 1 && charIndex >= currentWord.length) {
      setDisplayedText(currentWord);
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;

    // Typing current word
    if (charIndex < currentWord.length) {
      timeout = setTimeout(() => {
        const nextIndex = charIndex + 1;
        setCharIndex(nextIndex);
        setDisplayedText(currentWord.slice(0, nextIndex));
      }, speed);
      return () => {
        if (timeout) clearTimeout(timeout);
      };
    }

    // Move to next word
    timeout = setTimeout(() => {
      const isLast = currentWordIndex >= words.length - 1;
      const nextWordIndex = isLast ? 0 : currentWordIndex + 1;

      if (!loop && isLast) {
        setDisplayedText(currentWord);
        return;
      }

      setCurrentWordIndex(nextWordIndex);
      setCharIndex(0);
      setDisplayedText("");
    }, delayBetweenWords);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [charIndex, currentWordIndex, delayBetweenWords, loop, speed, words]);

  return (
    <span className={className}>
      {displayedText}
      <span className="animate-pulse">|</span>
    </span>
  );
}
