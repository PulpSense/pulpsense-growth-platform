import type { DisclaimerFooterProps } from './types';

const DisclaimerFooter = ({
  disclaimerHeader,
  paragraphs,
  legalLinks,
  copyrightText,
  platformDisclaimer,
}: DisclaimerFooterProps) => {
  return (
    <footer className="py-12">
      <div className="mx-auto max-w-4xl px-4">
        {/* Earnings disclaimer */}
        <div className="mb-8 border-t border-navy-700 pt-8">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
            {disclaimerHeader}
          </h3>
          {paragraphs.map((paragraph, index) => (
            <p
              key={index}
              className={`text-xs leading-relaxed text-gray-500 ${index > 0 ? 'mt-4' : ''}`}
            >
              {paragraph}
            </p>
          ))}
        </div>

        {/* Legal links and copyright */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-navy-700 pt-8 text-center md:flex-row md:text-left">
          <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-500 md:justify-start">
            {legalLinks.map((link) => (
              <a key={link.text} href={link.href} className="hover:text-gray-400">
                {link.text}
              </a>
            ))}
          </div>
          <p className="text-xs text-gray-500">{copyrightText}</p>
        </div>

        {/* Platform disclaimer */}
        {platformDisclaimer && (
          <p className="mt-8 text-center text-xs text-gray-600">
            {platformDisclaimer}
          </p>
        )}
      </div>
    </footer>
  );
};

export { DisclaimerFooter };
