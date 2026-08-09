'use client';

import { useEffect, useRef } from 'react';

type DeferredLoopVideoProps = {
  src: string;
  poster: string;
  label: string;
  className?: string;
};

export function DeferredLoopVideo({
  src,
  poster,
  label,
  className,
}: DeferredLoopVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.src = src;
    video.load();
    void video.play().catch(() => undefined);

    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      poster={poster}
      className={className}
      autoPlay
      loop
      muted
      playsInline
      preload="none"
      aria-label={label}
    />
  );
}
