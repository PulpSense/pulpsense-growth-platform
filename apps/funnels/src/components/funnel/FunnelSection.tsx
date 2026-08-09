import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type FunnelSectionProps = ComponentPropsWithoutRef<'section'> & {
  children: ReactNode;
};

export const FunnelSection = forwardRef<HTMLElement, FunnelSectionProps>(
  ({ children, className, ...props }, ref) => (
    <section ref={ref} className={className} {...props}>
      {children}
    </section>
  ),
);

FunnelSection.displayName = 'FunnelSection';
