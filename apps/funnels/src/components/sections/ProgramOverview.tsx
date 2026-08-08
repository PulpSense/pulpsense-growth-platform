'use client';

import { GradientButton } from '@/components/ui';

import type { ProgramOverviewProps } from './types';

const ProgramOverview = ({
  header,
  paragraphs,
  highlightBox,
  features,
  cta,
}: ProgramOverviewProps) => {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-4xl px-4">
        {/* Content card with subtle shadow */}
        <div className="rounded-2xl bg-white px-8 py-10 shadow-[0_4px_40px_rgba(0,0,0,0.08)] md:px-12">
          {/* Section header */}
          <h2 className="mb-8 text-center text-2xl font-bold text-navy-900 md:text-3xl">
            {header}
          </h2>

          {/* Body paragraphs */}
          <div className="mb-8 space-y-4 text-gray-700">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          {/* Highlight box */}
          {highlightBox && (
            <div className="mb-8 border-l-4 border-orange-500 bg-gray-50 px-6 py-4">
              <p className="font-bold text-navy-900 underline decoration-orange-400 decoration-2 underline-offset-2">
                {highlightBox.title}
              </p>
              <p className="mt-2 text-gray-700">{highlightBox.content}</p>
            </div>
          )}

          {/* Checkmark feature list */}
          <div className="mb-12 space-y-4">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3">
                {/* Green checkmark icon */}
                <div className="flex size-6 shrink-0 items-center justify-center rounded bg-green-500">
                  <svg
                    className="size-4 text-white"
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
                </div>
                <div>
                  <span className="font-bold text-navy-900">{feature.title}</span>
                  {feature.text && (
                    <span className="text-gray-700"> — {feature.text}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA Button */}
          {cta && (
            <div className="text-center">
              <GradientButton xl scrollTo={cta.scrollTo}>
                {cta.text}
              </GradientButton>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export { ProgramOverview };
