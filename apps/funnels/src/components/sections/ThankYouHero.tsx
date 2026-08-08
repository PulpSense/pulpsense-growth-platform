import { VideoEmbed } from '@/components/ui/VideoEmbed';

import type { ThankYouHeroProps } from './types';

const ThankYouHero = ({
  title,
  subtitle,
  requiredLabel,
  alertMessage,
  videoPlaceholder,
}: ThankYouHeroProps) => {
  return (
    <section className="px-4 pb-12 pt-8 text-center">
      <h1 className="mb-3 text-3xl font-black text-white md:text-4xl">
        {title}
      </h1>

      {(requiredLabel || subtitle) && (
        <h2 className="mb-6 text-xl text-white md:text-2xl">
          {requiredLabel && (
            <span className="mr-1 rounded bg-gradient-to-r from-orange-500 to-orange-400 px-2 py-0.5 font-bold text-white">
              {requiredLabel}
            </span>
          )}
          {': '}
          {subtitle}
        </h2>
      )}

      {/* Red alert banner */}
      {alertMessage && (
        <div className="mx-auto max-w-2xl rounded-t-lg bg-red-500 px-4 py-3 text-sm font-medium text-white">
          {alertMessage}
        </div>
      )}

      {/* Video area */}
      {videoPlaceholder && (
        <div className={`mx-auto max-w-2xl overflow-hidden bg-black shadow-xl ${alertMessage ? 'rounded-b-lg' : 'rounded-lg'}`}>
          {videoPlaceholder.provider ? (
            <VideoEmbed video={videoPlaceholder} priority />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center bg-navy-800 text-white">
              {videoPlaceholder.title && (
                <p className="mb-2 text-lg font-bold md:text-xl">
                  {videoPlaceholder.title}
                </p>
              )}
              {/* Play button circle */}
              <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-white/20">
                <svg
                  className="ml-1 size-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              {videoPlaceholder.subtitle && (
                <p className="text-sm text-gray-300">
                  {videoPlaceholder.subtitle}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export { ThankYouHero };
