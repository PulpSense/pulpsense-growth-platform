import { GradientButton, TrustBadge, VideoPlaceholder } from '@/components/ui';

import type { HeroSectionProps } from './types';

const HeroSection = ({
  trustBadge,
  banner,
  headline,
  highlightedText,
  headlineSuffix,
  subheadline,
  video,
  cta,
}: HeroSectionProps) => {
  return (
    <section className="pb-6 pt-6 md:pb-8 md:pt-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Trust badge */}
        <div className="mb-4 flex justify-center md:mb-6">
          <TrustBadge
            text={trustBadge.text}
            stars={trustBadge.stars}
            avatars={trustBadge.avatars}
          />
        </div>

        {/* Banner */}
        <div className="mb-6 overflow-hidden rounded-full md:mb-8">
          <div className="bg-[#FA6B18] px-4 py-1 text-center">
            <span className="text-sm font-bold text-white md:text-lg">
              {banner.text}
            </span>
          </div>
        </div>

        {/* Main headline */}
        <h1 className="mb-4 text-center text-xl font-extrabold leading-tight text-white md:mb-6 md:text-2xl lg:text-3xl">
          {headline}
          {highlightedText && (
            <>
              {' '}
              <span className="text-orange-500">
                {highlightedText.split('\n').map((line, i) => (
                  <span key={i}>{i > 0 && <br />}{line}</span>
                ))}
              </span>
            </>
          )}
          {headlineSuffix && <> {headlineSuffix}</>}
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mb-6 max-w-2xl text-center text-base text-gray-300 md:mb-8 md:text-lg">
          {subheadline}
        </p>

        {/* Video placeholder */}
        {video && (
          <div className="mb-6 md:mb-8">
            <VideoPlaceholder video={video} priority />
          </div>
        )}

        {/* CTA Button */}
        <div className="text-center">
          <GradientButton xl scrollTo={cta.scrollTo} href={cta.href}>
            {cta.text}
          </GradientButton>
          {cta.disclaimer && (
            <p className="mt-4 text-sm text-gray-400">{cta.disclaimer}</p>
          )}
        </div>
      </div>
    </section>
  );
};

export { HeroSection };
