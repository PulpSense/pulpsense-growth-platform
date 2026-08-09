import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type FunnelCtaProps = ComponentPropsWithoutRef<'a'> & {
  children: ReactNode;
};

export function FunnelCta({ children, className, ...props }: FunnelCtaProps) {
  return (
    <a className={className} {...props}>
      {children}
    </a>
  );
}

