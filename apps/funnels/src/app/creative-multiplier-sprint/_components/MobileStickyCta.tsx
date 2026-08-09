'use client';

import { useEffect, useState } from 'react';

export function MobileStickyCta() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('hero');
    const apply = document.getElementById('apply');

    const updateVisibility = () => {
      const heroBottom = hero?.getBoundingClientRect().bottom ?? 0;
      const applyTop = apply?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;

      setIsVisible(heroBottom <= 0 && applyTop > window.innerHeight * 0.7);
    };

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);

    return () => {
      window.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
    };
  }, []);

  return (
    <div
      className={`fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-white/10 bg-[#0F1011]/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur transition-[transform,opacity] duration-300 ease-out md:hidden ${
        isVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[calc(100%+1rem)] opacity-0'
      }`}
      aria-hidden={!isVisible}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">10 variations / 2 business days</p>
          <p className="truncate text-xs text-[#8A8F98]">No upload. Book if it fits.</p>
        </div>
        <a
          href="#apply"
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-[#ff8752]/35 bg-[#B94100] px-4 py-3 text-xs font-semibold text-white shadow-[0_0_40px_rgba(255,107,26,0.18)] transition hover:bg-[#A83B00]"
        >
          Apply now
        </a>
      </div>
    </div>
  );
}
