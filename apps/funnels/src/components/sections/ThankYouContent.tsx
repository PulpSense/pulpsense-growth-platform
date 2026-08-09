import Image from 'next/image';

import { ContentCard } from '@/components/ui/ContentCard';
import { VideoEmbed } from '@/components/ui/VideoEmbed';

import type { ThankYouContentProps } from './types';

const ThankYouContent = ({ steps, bottomVideos }: ThankYouContentProps) => {
  return (
    <section className="py-16">
      <ContentCard>
        {steps.map((step) => (
          <div key={step.number} className="mb-10 text-center last:mb-0">
            {/* Step heading with orange gradient badge */}
            <h3 className="mb-3 text-2xl font-black uppercase text-black md:text-3xl">
              <span className="mr-2 inline-block rounded bg-gradient-to-r from-orange-500 to-orange-400 px-2.5 py-0.5 text-xl font-black text-white md:text-2xl">
                STEP {step.number}:
              </span>
              {step.heading}
            </h3>

            {/* Optional description */}
            {step.description && (
              <p className="mb-4 text-lg font-semibold text-black">
                {step.highlightedText ? (
                  <>
                    {step.description.split(step.highlightedText)[0]}
                    <span className="underline">{step.highlightedText}</span>
                    {step.description.split(step.highlightedText)[1]}
                  </>
                ) : (
                  step.description
                )}
              </p>
            )}

            {/* Optional email screenshot image */}
            {step.imageSrc && (
              <div className="mx-auto mb-4 max-w-xl overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                <Image
                  src={step.imageSrc}
                  alt={step.imageAlt || 'Step illustration'}
                  width={754}
                  height={360}
                  className="h-auto w-full"
                />
              </div>
            )}

            {/* Optional CTA button with orange gradient */}
            {step.cta && (
              <a
                href={step.cta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-col items-center rounded-md bg-gradient-to-r from-orange-500 to-orange-400 px-6 py-3 text-center font-bold text-white transition-opacity hover:opacity-90"
              >
                <span>{step.cta.text}</span>
                {step.cta.subtext && (
                  <span className="text-xs font-normal opacity-90">
                    {step.cta.subtext}
                  </span>
                )}
              </a>
            )}
          </div>
        ))}
      </ContentCard>

      {/* Video thumbnails grid */}
      {bottomVideos && bottomVideos.length > 0 && (
        <div className="mx-auto mt-16 grid max-w-3xl gap-6 px-4 sm:grid-cols-2 lg:grid-cols-3">
          {bottomVideos.map((video) => (
            <div key={video.title} className="text-center">
              <h4 className="mb-3 text-sm font-bold text-black">
                {video.title}
              </h4>
              {video.provider ? (
                <div className="overflow-hidden rounded-lg">
                  <VideoEmbed video={video} />
                </div>
              ) : (
                <a
                  href={video.href || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block aspect-video overflow-hidden rounded-lg bg-navy-800"
                >
                  {video.thumbnailSrc ? (
                    <Image
                      src={video.thumbnailSrc}
                      alt={video.title}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-navy-800" />
                  )}
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-black/60 transition-colors group-hover:bg-black/80">
                      <svg
                        className="ml-0.5 size-5 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export { ThankYouContent };
