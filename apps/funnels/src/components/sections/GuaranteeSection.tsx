'use client';

import type { GuaranteeSectionProps } from './types';

const GuaranteeSection = ({
  headline,
  paragraphs,
  days,
  cta,
}: GuaranteeSectionProps) => {
  const handleClick = () => {
    const el = document.getElementById(cta.scrollTo ?? 'checkout');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="bg-zinc-950 py-16">
      <div className="mx-auto max-w-3xl px-4 text-center">
        {/* Days Badge */}
        <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full border-4 border-green-500 bg-zinc-900">
          <div>
            <span className="block text-3xl font-extrabold text-green-400">
              {days}
            </span>
            <span className="text-xs font-bold uppercase tracking-wide text-green-400">
              Days
            </span>
          </div>
        </div>

        {/* Headline */}
        <h2 className="mb-6 text-2xl font-extrabold text-white md:text-3xl">
          {headline}
        </h2>

        {/* Paragraphs */}
        <div className="mb-8 space-y-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-gray-300">
              {p}
            </p>
          ))}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleClick}
          className="cursor-pointer rounded-lg bg-green-500 px-10 py-5 text-xl font-extrabold text-white transition-all duration-200 hover:scale-105 hover:bg-green-600"
        >
          {cta.text}
        </button>
      </div>
    </section>
  );
};

export { GuaranteeSection };
