'use client';

import { useState } from 'react';

import { GradientButton, PillBadge } from '@/components/ui';

import type { FAQProps } from './types';

const FAQ = ({ headerLabel, header, items, cta }: FAQProps) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4">
        {/* Stacked header with pill badge */}
        {headerLabel && (
          <div className="mb-4 flex justify-center">
            <PillBadge
              variant="light"
              icon={
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[12px] font-black leading-none text-white">
                  ?
                </span>
              }
            >
              {headerLabel}
            </PillBadge>
          </div>
        )}
        <h2 className="mb-12 text-center text-2xl font-bold text-white md:text-3xl">
          {header}
        </h2>

        {/* FAQ accordion */}
        <div className="space-y-4">
          {items.map((faq, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg bg-navy-700/50"
            >
              <button
                type="button"
                onClick={() => toggleFaq(index)}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-navy-700"
                aria-expanded={openIndex === index}
              >
                <span className="pr-4 font-semibold text-white">
                  {faq.question}
                </span>
                <svg
                  className={`size-5 shrink-0 text-gray-400 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {openIndex === index && (
                <div className="border-t border-navy-600 px-6 py-4">
                  <p className="text-gray-300">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA Button */}
        {cta && (
          <div className="mt-12 text-center">
            <GradientButton xl scrollTo={cta.scrollTo} href={cta.href}>
              {cta.text}
            </GradientButton>
          </div>
        )}
      </div>
    </section>
  );
};

export { FAQ };
