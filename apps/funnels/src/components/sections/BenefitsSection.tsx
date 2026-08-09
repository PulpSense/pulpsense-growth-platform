import { GradientButton } from '@/components/ui';

import type { BenefitsSectionProps } from './types';

const BenefitsSection = ({
  headline,
  benefits,
  cta,
}: BenefitsSectionProps) => {
  return (
    <section className="bg-navy-900 py-16">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="mb-8 text-center text-2xl font-bold text-white md:text-3xl">
          {headline.split('\n').map((line, i) => (
            <span key={i}>{i > 0 && <br />}{line}</span>
          ))}
        </h2>
        <ul className="mx-auto max-w-2xl space-y-4">
          {benefits.map((benefit, index) => (
            <li key={index} className="flex items-start gap-3 text-gray-300">
              <span className="mt-1 text-green-400">✓</span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
        {cta && (
          <div className="mt-10 text-center">
            <GradientButton xl scrollTo={cta.scrollTo} href={cta.href}>
              {cta.text}
            </GradientButton>
          </div>
        )}
      </div>
    </section>
  );
};

export { BenefitsSection };
