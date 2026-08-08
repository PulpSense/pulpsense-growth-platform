import type { ReactNode } from 'react';

type ContentCardProps = {
  children: ReactNode;
  className?: string;
};

const ContentCard = ({ children, className = '' }: ContentCardProps) => (
  <div
    className={`mx-4 my-12 max-w-5xl rounded-2xl bg-white px-8 py-10 shadow-[0_8px_60px_rgba(0,0,0,0.16)] md:mx-auto md:px-12 ${className}`.trim()}
  >
    {children}
  </div>
);

export { ContentCard };
export type { ContentCardProps };
