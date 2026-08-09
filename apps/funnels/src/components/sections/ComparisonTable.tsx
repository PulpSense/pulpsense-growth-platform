'use client';

import { GradientButton } from '@/components/ui';
import type { SectionCTAConfig } from './types';

export type ComparisonRow = {
  feature: string;
  traditional: string | boolean;
  modern: string | boolean;
};

export type ComparisonTableProps = {
  header: string;
  headerHighlight?: string;
  subheader?: string;
  traditionalLabel: string;
  modernLabel: string;
  rows: ComparisonRow[];
  bottomNote?: {
    title: string;
    content: string;
  };
  cta?: SectionCTAConfig;
};

const ComparisonTable = ({
  header,
  headerHighlight,
  subheader,
  traditionalLabel,
  modernLabel,
  rows,
  bottomNote,
  cta,
}: ComparisonTableProps) => {
  const renderCellValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <span className="text-green-600">✓</span>
      ) : (
        <span className="text-red-500">✗</span>
      );
    }
    return value;
  };

  return (
    <section className="bg-gray-50 py-8">
      <div className="mx-auto max-w-screen-lg px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            {header}{' '}
            {headerHighlight && (
              <span className="text-blue-600">{headerHighlight}</span>
            )}
          </h2>
          {subheader && (
            <p className="mt-3 text-gray-600">{subheader}</p>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Table Header */}
          <div className="grid grid-cols-3 border-b border-gray-200 bg-gray-50">
            <div className="p-4 font-semibold text-gray-700">Feature</div>
            <div className="border-x border-gray-200 p-4 text-center font-semibold text-gray-700">
              {traditionalLabel}
            </div>
            <div className="p-4 text-center font-semibold text-blue-600">
              {modernLabel}
            </div>
          </div>

          {/* Table Rows */}
          {rows.map((row, index) => (
            <div
              key={index}
              className={`grid grid-cols-3 ${index !== rows.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div className="p-4 text-sm font-medium text-gray-900">{row.feature}</div>
              <div className="flex items-center justify-center border-x border-gray-100 p-4 text-center text-sm text-gray-700">
                {renderCellValue(row.traditional)}
              </div>
              <div className="flex items-center justify-center p-4 text-center text-sm font-medium text-gray-900">
                {renderCellValue(row.modern)}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        {bottomNote && (
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl bg-blue-600 px-8 py-8 text-center text-white">
            <h3 className="mb-3 text-xl font-bold italic">{bottomNote.title}</h3>
            <p className="text-base leading-relaxed text-blue-50">{bottomNote.content}</p>
          </div>
        )}

        {/* CTA */}
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

export { ComparisonTable };
