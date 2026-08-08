import { ContentCard, GradientButton } from '@/components/ui';

import type { ProblemSectionProps } from './types';

const ProblemSection = ({
  headline,
  paragraphs,
  emphasizedText,
  highlight,
  conclusion,
  cta,
}: ProblemSectionProps) => {
  return (
    <section className="bg-gray-100">
      <ContentCard>
        <h2 className="mb-8 text-center text-2xl font-bold text-gray-900 md:text-3xl">
          {headline.split('\n').map((line, i) => (
            <span key={i}>{line}{i < headline.split('\n').length - 1 && <br />}</span>
          ))}
        </h2>
        <div className="mx-auto max-w-3xl space-y-4 text-gray-700 leading-relaxed">
          {paragraphs.map((paragraph, index) => (
            <p
              key={index}
              className={
                emphasizedText && paragraph === emphasizedText
                  ? 'text-xl font-bold text-gray-900'
                  : ''
              }
            >
              {paragraph}
            </p>
          ))}
        </div>
        <div className="mx-auto my-8 max-w-3xl rounded-xl border-l-4 border-orange-500 bg-orange-50 p-6">
          <p className="font-semibold text-gray-900">{highlight}</p>
        </div>
        <p className="mx-auto max-w-3xl text-gray-700 leading-relaxed">
          {conclusion}
        </p>
        {cta && (
          <div className="mt-10 text-center">
            <GradientButton xl scrollTo={cta.scrollTo} href={cta.href}>
              {cta.text}
            </GradientButton>
          </div>
        )}
      </ContentCard>
    </section>
  );
};

export { ProblemSection };
