import type { ReactNode } from 'react';

type FunnelPageProps = {
  children: ReactNode;
  className?: string;
};

export function FunnelPage({ children, className }: FunnelPageProps) {
  return <main className={className}>{children}</main>;
}

