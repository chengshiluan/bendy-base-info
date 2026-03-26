'use client';

import { useEffect, useState } from 'react';

interface TypewriterTextProps {
  phrases: string[];
}

const TYPING_DELAY = 72;
const DELETING_DELAY = 34;
const PAUSE_AT_END = 1600;
const PAUSE_AT_START = 220;

export function TypewriterText({ phrases }: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!phrases.length) {
      return;
    }

    const currentPhrase = phrases[phraseIndex] ?? '';
    const isAtPhraseEnd = displayText === currentPhrase;
    const isAtPhraseStart = displayText.length === 0;

    const timeout = window.setTimeout(
      () => {
        if (!isDeleting) {
          if (isAtPhraseEnd) {
            setIsDeleting(true);
            return;
          }

          setDisplayText(currentPhrase.slice(0, displayText.length + 1));
          return;
        }

        if (isAtPhraseStart) {
          setIsDeleting(false);
          setPhraseIndex((currentIndex) => (currentIndex + 1) % phrases.length);
          return;
        }

        setDisplayText(currentPhrase.slice(0, displayText.length - 1));
      },
      isDeleting
        ? isAtPhraseStart
          ? PAUSE_AT_START
          : DELETING_DELAY
        : isAtPhraseEnd
          ? PAUSE_AT_END
          : TYPING_DELAY
    );

    return () => window.clearTimeout(timeout);
  }, [displayText, isDeleting, phraseIndex, phrases]);

  return (
    <span className='inline whitespace-pre-wrap'>
      {displayText || '\u00A0'}
      <span
        aria-hidden='true'
        className='ml-1 inline-block h-[0.9em] w-px animate-[caret-blink_1s_steps(1)_infinite] bg-current align-[-0.08em]'
      />
    </span>
  );
}
