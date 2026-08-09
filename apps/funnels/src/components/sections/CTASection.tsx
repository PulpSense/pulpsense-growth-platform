import type { CTASectionProps } from './types';

const CTASection = ({
  id = 'apply-section',
  header,
  steps,
  cta,
  urgency,
  cardTitle = 'Save Your Slot for a Personalized Demo',
  cardSubtext = 'No long-term contracts. Cancel anytime.',
}: CTASectionProps) => {
  return (
    <section id={id} className="bg-white py-16">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <h2 className="mb-8 text-3xl font-bold text-gray-900 md:text-4xl">
          {header}
        </h2>

        <ul className="mb-8 space-y-4 text-left text-gray-700">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
                ✓
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8">
          <h3 className="mb-2 text-xl font-bold text-gray-900">{cardTitle}</h3>
          {urgency && <p className="mb-6 text-sm text-gray-600">{urgency}</p>}

          <a
            href={cta.href}
            className="inline-block w-full rounded-lg px-8 py-4 text-center text-lg font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
            style={{
              background: 'linear-gradient(90deg, #FF5B23, #F2BB06)',
            }}
          >
            {cta.text}
          </a>

          {cardSubtext && (
            <p className="mt-4 text-xs text-gray-500">{cardSubtext}</p>
          )}
        </div>
      </div>
    </section>
  );
};

export { CTASection };
