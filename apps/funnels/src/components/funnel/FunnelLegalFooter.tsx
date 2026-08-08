import type { ReactNode } from 'react';

export type FunnelLegalLink = {
  text: string;
  href: string;
};

type FunnelLegalFooterProps = {
  children: ReactNode;
  after?: ReactNode;
  links: FunnelLegalLink[];
  copyright: ReactNode;
  className?: string;
  linksClassName?: string;
  copyrightClassName?: string;
};

export function FunnelLegalFooter({
  after,
  children,
  links,
  copyright,
  className,
  linksClassName,
  copyrightClassName,
}: FunnelLegalFooterProps) {
  return (
    <footer className={className}>
      {children}
      <div className={linksClassName}>
        {links.map((link) => (
          <a key={link.text} href={link.href}>
            {link.text}
          </a>
        ))}
      </div>
      <p className={copyrightClassName}>{copyright}</p>
      {after}
    </footer>
  );
}
