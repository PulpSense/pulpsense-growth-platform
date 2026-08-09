import { TrustBadge } from '@/components/ui';

import type { UnqualifiedHeroProps } from './types';

const UnqualifiedHero = ({
  trustBadge,
  banner,
  title,
  subtitle,
  cta,
}: UnqualifiedHeroProps) => {
  return (
    <section className="px-4 pb-16 pt-8 text-center">
      <div className="mx-auto max-w-3xl">
        {/* Trust badge */}
        {trustBadge && (
          <div className="mb-6 flex justify-center">
            <TrustBadge
              text={trustBadge.text}
              stars={trustBadge.stars}
              avatars={trustBadge.avatars}
            />
          </div>
        )}

        {/* Banner */}
        {banner && (
          <div className="mb-8 overflow-hidden rounded-full">
            <div className="bg-[#FA6B18] px-4 py-1 text-center">
              <span className="text-lg font-bold text-white md:text-xl">
                {banner.text}
              </span>
            </div>
          </div>
        )}

        {/* Heading */}
        <h1 className="mb-4 text-4xl font-black text-white md:text-5xl">
          {title}
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-300">
          {subtitle}
        </p>

        {/* CTA button */}
        <a
          href={cta.href}
          className="inline-block rounded-lg px-10 py-5 text-xl font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
          style={{
            background: 'linear-gradient(90deg, #FF5B23, #F2BB06)',
          }}
        >
          {cta.text}
        </a>
      </div>
    </section>
  );
};

export { UnqualifiedHero };
