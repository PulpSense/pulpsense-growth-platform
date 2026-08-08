import type { ReactNode } from 'react';

type PageLayoutProps = {
  hero: ReactNode;
  children: ReactNode;
  footer: ReactNode;
};

const PageLayout = ({ hero, children, footer }: PageLayoutProps) => (
  <div className="flex min-h-screen flex-col antialiased">
    {hero}
    <main className="flex-1 bg-white">{children}</main>
    {footer}
  </div>
);

export { PageLayout };
export type { PageLayoutProps };
