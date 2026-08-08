import type { ReactNode } from 'react';

type AlertBannerProps = {
  children: ReactNode;
  variant: 'orange' | 'red';
};

const AlertBanner = ({ children, variant }: AlertBannerProps) => {
  const bgClass =
    variant === 'orange'
      ? 'bg-gradient-to-r from-orange-500 to-orange-400'
      : 'bg-red-500';

  return (
    <div className={`w-full py-2 text-center ${bgClass}`}>
      <span className="text-sm font-semibold text-white">{children}</span>
    </div>
  );
};

export { AlertBanner };
