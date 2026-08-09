import type { ResultsSectionProps } from './types';

const ResultsSection = ({ header, stats }: ResultsSectionProps) => {
  return (
    <section className="bg-gray-50 py-8">
      <div className="mx-auto max-w-screen-lg px-4">
        <h2 className="mb-10 text-center text-3xl font-bold text-gray-900 md:text-4xl">
          {header}
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-xl bg-white p-6 shadow-sm"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                ✓
              </span>
              <span className="font-medium text-gray-900">{stat}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export { ResultsSection };
