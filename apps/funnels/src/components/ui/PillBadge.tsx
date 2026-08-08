import type { ReactNode } from 'react';

type PillBadgeProps = {
  children: ReactNode;
  variant?: 'blue' | 'orange' | 'light';
  icon?: ReactNode;
};

const PillBadge = ({
  children,
  variant = 'blue',
  icon,
}: PillBadgeProps) => {
  const variantClasses = {
    blue: 'bg-navy-700 text-white px-4',
    orange: 'bg-orange-500 text-white px-4',
    light: 'bg-blue-100 text-black font-bold px-6',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full py-1.5 text-xs font-semibold uppercase tracking-wider ${variantClasses}`}
    >
      {icon}
      {children}
    </span>
  );
};

export { PillBadge };
