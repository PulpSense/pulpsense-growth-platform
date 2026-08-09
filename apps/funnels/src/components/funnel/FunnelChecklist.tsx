import type { ReactNode } from 'react';

type FunnelChecklistProps = {
  items: string[];
  className?: string;
  itemClassName?: string;
  markerClassName?: string;
  marker?: ReactNode;
};

export function FunnelChecklist({
  items,
  className,
  itemClassName,
  markerClassName,
  marker = '✓',
}: FunnelChecklistProps) {
  return (
    <ul className={className}>
      {items.map((item) => (
        <li key={item} className={itemClassName}>
          {marker !== null && <span className={markerClassName}>{marker}</span>}
          {item}
        </li>
      ))}
    </ul>
  );
}
