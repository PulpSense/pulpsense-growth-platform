'use client';

import type { ScrollerSummarySectionProps } from './types';

const ScrollerSummarySection = ({
  label,
  heading,
  intro,
  items,
  price,
  cta,
}: ScrollerSummarySectionProps) => {
  const handleClick = () => {
    const el = document.getElementById(cta.scrollTo ?? 'checkout');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="bg-zinc-900 py-16">
      <div className="mx-auto max-w-3xl px-4 text-center">
        {/* Label */}
        <p className="mb-2 text-sm font-bold uppercase tracking-widest text-amber-400">
          {label}
        </p>

        {/* Heading */}
        <h2 className="mb-4 text-2xl font-extrabold text-white md:text-3xl">
          {heading}
        </h2>

        {/* Intro */}
        <p className="mb-8 text-gray-300">{intro}</p>

        {/* Items List */}
        <ul className="mb-8 space-y-3 text-left">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <svg
                className="mt-1 size-5 shrink-0 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-gray-200">{item}</span>
            </li>
          ))}
        </ul>

        {/* Price Callout */}
        <p className="mb-8 text-2xl font-extrabold text-green-400">{price}</p>

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

export { ScrollerSummarySection };
