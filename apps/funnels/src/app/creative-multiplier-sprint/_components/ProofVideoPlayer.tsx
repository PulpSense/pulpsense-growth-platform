'use client';

import { useEffect, useRef, useState } from 'react';

type ProofVideoPlayerProps = {
  src: string;
  poster: string;
  label: string;
};

export function ProofVideoPlayer({ src, poster, label }: ProofVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wantsPlayRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;

    if (!container || !video || !('IntersectionObserver' in window)) {
      return;
    }

    video.muted = true;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          wantsPlayRef.current = true;
          setShouldLoad(true);

          if (!video.currentSrc) {
            return;
          }

          void video.play().catch(() => {
            setIsPlaying(false);
          });
          return;
        }

        video.pause();
      },
      {
        rootMargin: '120px 0px',
        threshold: 0.45,
      },
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!shouldLoad || !video || !wantsPlayRef.current) {
      return;
    }

    void video.play().catch(() => {
      setIsPlaying(false);
    });
  }, [shouldLoad]);

  const togglePlay = async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (!shouldLoad) {
      wantsPlayRef.current = true;
      setShouldLoad(true);
      return;
    }

    if (video.paused) {
      wantsPlayRef.current = true;
      await video.play();
      setIsPlaying(true);
      return;
    }

    wantsPlayRef.current = false;
    video.pause();
    setIsPlaying(false);
  };

  const toggleMute = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const updateProgress = () => {
    const video = videoRef.current;

    if (!video?.duration) {
      setProgress(0);
      return;
    }

    setProgress((video.currentTime / video.duration) * 100);
  };

  const seek = (value: string) => {
    const video = videoRef.current;

    if (!video?.duration) {
      return;
    }

    const nextProgress = Number(value);
    video.currentTime = (nextProgress / 100) * video.duration;
    setProgress(nextProgress);
  };

  return (
    <div ref={containerRef} className="group relative h-full w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={shouldLoad ? src : undefined}
        poster={poster}
        className="h-full w-full object-cover"
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
        aria-label={label}
        onClick={togglePlay}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={updateProgress}
      />

      {!isPlaying && (
        <button
          type="button"
          aria-label={`Play ${label}`}
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur transition hover:bg-black/75"
        >
          <span className="ml-1 h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-white" />
        </button>
      )}

      {isPlaying && isMuted && (
        <button
          type="button"
          aria-label={`Unmute ${label}`}
          onClick={toggleMute}
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/55 text-white shadow-[0_18px_44px_rgba(0,0,0,0.38)] backdrop-blur transition hover:scale-105 hover:bg-black/70"
        >
          <svg
            aria-hidden="true"
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M11 5 6 9H3v6h3l5 4V5Z"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <path
              d="M15.5 8.5a5 5 0 0 1 0 7"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
            <path
              d="M18.5 5.5a9 9 0 0 1 0 13"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-3 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progress}
          aria-label={`Seek ${label}`}
          onChange={(event) => seek(event.currentTarget.value)}
          className="mb-3 h-1 w-full cursor-pointer accent-[#FF6B1A]"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/18"
          >
            {isPlaying ? (
              <span className="flex gap-1">
                <span className="h-3.5 w-1.5 rounded-sm bg-white" />
                <span className="h-3.5 w-1.5 rounded-sm bg-white" />
              </span>
            ) : (
              <span className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-white" />
            )}
          </button>
          <button
            type="button"
            aria-label={isMuted ? `Unmute ${label}` : `Mute ${label}`}
            onClick={toggleMute}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/18"
          >
            {isMuted ? (
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M11 5 6 9H3v6h3l5 4V5Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
                <path
                  d="m18 9-6 6m0-6 6 6"
                  stroke="#FF6B1A"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M11 5 6 9H3v6h3l5 4V5Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
                <path
                  d="M15.5 8.5a5 5 0 0 1 0 7"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
                <path
                  d="M18.5 5.5a9 9 0 0 1 0 13"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
