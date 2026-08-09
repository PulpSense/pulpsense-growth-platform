import type { ReactNode } from 'react';

type HighlightBoxProps = {
  children: ReactNode;
};

const HighlightBox = ({ children }: HighlightBoxProps) => {
  return (
    <div className="rounded-lg bg-navy-900 px-6 py-4 text-white">{children}</div>
  );
};

export { HighlightBox };
