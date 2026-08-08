import type { ReactNode } from 'react';

type FunnelVideoGridItem = {
  id: string;
  title: string;
};

type FunnelVideoGridProps = {
  videos: FunnelVideoGridItem[];
  className?: string;
  cardClassName?: string;
  embedClassName?: string;
  titleClassName?: string;
  renderEmbed: (video: FunnelVideoGridItem) => ReactNode;
};

export function FunnelVideoGrid({
  videos,
  className,
  cardClassName,
  embedClassName,
  titleClassName,
  renderEmbed,
}: FunnelVideoGridProps) {
  return (
    <div className={className}>
      {videos.map((video) => (
        <div key={video.id} className={cardClassName}>
          <div className={embedClassName}>{renderEmbed(video)}</div>
          <h3 className={titleClassName}>{video.title}</h3>
        </div>
      ))}
    </div>
  );
}

