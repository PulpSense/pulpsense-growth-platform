'use client';

import type { BonusSectionProps } from './types';

const BonusSection = ({ header, bonuses, cta }: BonusSectionProps) => {
  const handleClick = () => {
    const el = document.getElementById(cta.scrollTo ?? 'checkout');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="bg-zinc-950 py-16">
      <div className="mx-auto max-w-4xl px-4">
        {/* Section Header */}
        <h2 className="mb-12 text-center text-2xl font-extrabold text-white md:text-3xl">
          {header}
        </h2>

        {/* Bonus List */}
        <div className="space-y-12">
          {bonuses.map((bonus) => (
            <div key={bonus.number}>
              {/* Bonus Label */}
              <span className="mb-2 inline-block rounded bg-amber-500/20 px-3 py-1 text-sm font-bold uppercase tracking-wide text-amber-400">
                Bonus #{bonus.number}
              </span>

              {/* Bonus Title */}
              <h3 className="mb-1 text-xl font-bold text-white md:text-2xl">
                {bonus.title}
              </h3>

              {/* Subtitle */}
              {bonus.subtitle && (
                <p className="mb-3 text-lg font-semibold text-amber-400">
                  {bonus.subtitle}
                </p>
              )}

              {/* Paragraphs */}
              <div className="space-y-3">
                {bonus.paragraphs.map((p, i) => (
                  <p key={i} className="text-gray-300">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={handleClick}
            className="cursor-pointer rounded-lg bg-green-500 px-10 py-5 text-xl font-extrabold text-white transition-all duration-200 hover:scale-105 hover:bg-green-600"
          >
            {cta.text}
          </button>
        </div>
      </div>
    </section>
  );
};

export { BonusSection };
