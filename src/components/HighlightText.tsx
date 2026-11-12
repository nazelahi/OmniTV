import React from 'react';
import { splitHighlightSegments } from '../utils/channelSearch';

interface HighlightTextProps {
  text: string;
  query: string;
  className?: string;
  highlightClassName?: string;
}

export const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  query,
  className,
  highlightClassName = 'bg-rose-500/25 text-rose-200 rounded-xs px-0.5',
}) => {
  if (!query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const segments = splitHighlightSegments(text, query);
  return (
    <span className={className}>
      {segments.map((seg, idx) =>
        seg.highlight ? (
          <mark key={idx} className={highlightClassName}>
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        )
      )}
    </span>
  );
};
