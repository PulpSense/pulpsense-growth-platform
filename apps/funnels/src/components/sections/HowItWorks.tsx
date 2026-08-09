'use client';

import { GradientButton } from '@/components/ui';
import type { SectionCTAConfig } from './types';

export type HowItWorksStep = {
  number: number;
  title: string;
  description: string;
};

export type HowItWorksProps = {
  headerLabel?: string;
  header: string;
  steps: HowItWorksStep[];
  cta?: SectionCTAConfig;
};

const HowItWorks = ({ headerLabel, header, steps, cta }: HowItWorksProps) => {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-screen-lg px-4">
        {/* Header */}
        <div className="mb-12 text-center">
          {headerLabel && (
            <span className="mb-2 inline-block text-sm font-semibold text-blue-600 uppercase tracking-wider">
              {headerLabel}
            </span>
          )}
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            {header}
          </h2>
        </div>

        {/* Steps */}
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex justify-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-600">
                  {step.number}
                </span>
              </div>
              <h3 className="mb-3 text-lg font-bold text-gray-900">
                {step.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
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

export { HowItWorks };
