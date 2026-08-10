import type { ReactNode } from "react";

type HighlightBoxProps = {
  children: ReactNode;
};

const HighlightBox = ({ children }: HighlightBoxProps) => {
  return (
    <div className="bg-navy-900 rounded-lg px-6 py-4 text-white">
      {children}
    </div>
  );
};

export { HighlightBox };
