"use client";

import { useEffect, useRef, useState } from "react";

import {
  scheduleAfterPageLoad,
  scheduleNonCriticalMedia,
  type DeferredMediaRuntime,
} from "@/utils/deferredMedia";

type DeferredLoopVideoProps = {
  src: string;
  poster: string;
  label: string;
  className?: string;
  interactionReady?: boolean;
};

export function DeferredLoopVideo({
  src,
  poster,
  label,
  className,
  interactionReady = false,
}: DeferredLoopVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const runtime: DeferredMediaRuntime = {
      isPageLoaded: () => document.readyState === "complete",
      addLoadListener: (listener) => {
        window.addEventListener("load", listener, { once: true });
        return () => window.removeEventListener("load", listener);
      },
      addInteractionListener: (listener) => {
        const events = [
          "pointerdown",
          "keydown",
          "scroll",
          "touchstart",
        ] as const;
        for (const eventName of events) {
          window.addEventListener(eventName, listener, {
            once: true,
            passive: true,
          });
        }
        return () => {
          for (const eventName of events) {
            window.removeEventListener(eventName, listener);
          }
        };
      },
      requestIdle: (listener) =>
        window.requestIdleCallback
          ? window.requestIdleCallback(listener, { timeout: 2_000 })
          : window.setTimeout(listener, 1),
      cancelIdle: (id) =>
        window.cancelIdleCallback
          ? window.cancelIdleCallback(id)
          : window.clearTimeout(id),
    };
    const cancelDeferredLoad = interactionReady
      ? scheduleAfterPageLoad(() => setShouldLoad(true), runtime)
      : scheduleNonCriticalMedia(() => setShouldLoad(true), runtime);

    return cancelDeferredLoad;
  }, [interactionReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad) return;

    video.src = src;
    video.load();
    void video.play().catch(() => undefined);

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [shouldLoad, src]);

  return (
    <video
      ref={videoRef}
      poster={shouldLoad ? poster : undefined}
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
