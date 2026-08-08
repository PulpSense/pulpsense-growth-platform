'use client';

import { useEffect } from 'react';

import { trackMetaEvent } from '@/utils/metaCapi';

type MetaPixelEventsProps = {
  events: string[];
};

export function MetaPixelEvents({ events }: MetaPixelEventsProps) {
  useEffect(() => {
    // Small delay to ensure the FB pixel SDK has loaded
    const timer = setTimeout(() => {
      events.forEach((eventName) => {
        trackMetaEvent(eventName);
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
