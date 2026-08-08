'use client';

import { VideoPlaceholder } from '@/components/ui';

import type { VSLHeroSectionProps } from './types';

const VSLHeroSection = ({
  announcementBar,
  forLabel,
  headline,
  highlightedPrice,
  subheadline,
  video,
  checkout,
}: VSLHeroSectionProps) => {
  const savings = checkout.originalPrice - checkout.currentPrice;

  const handleScrollToCheckout = () => {
    const el = document.getElementById('checkout');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="bg-zinc-950 py-8 md:py-12">
      {/* Announcement Bar */}
      {announcementBar && (
        <div className="mb-6 bg-amber-500 px-4 py-2 text-center">
          <span className="text-sm font-bold text-black md:text-base">
            {announcementBar}
          </span>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4">
        {/* For Label */}
        <p className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-amber-400 md:text-base">
          {forLabel}
        </p>

        {/* Headline */}
        <h1 className="mb-2 text-center text-2xl font-extrabold leading-tight text-white md:text-3xl lg:text-4xl">
          {headline}
          {highlightedPrice && (
            <>
              {' '}
              <span className="text-green-400">{highlightedPrice}</span>
            </>
          )}
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mb-8 max-w-3xl text-center text-sm text-gray-300 md:text-base">
          {subheadline}
        </p>

        {/* Two-column layout: Video + Checkout */}
        <div
          id="checkout"
          className="grid items-start gap-8 lg:grid-cols-[1fr_400px]"
        >
          {/* Video */}
          <div>
            <VideoPlaceholder video={video} priority />
          </div>

          {/* Checkout Box */}
          <div className="rounded-xl bg-zinc-900 p-6">
            {/* Product Image Placeholder */}
            <div className="mb-4 flex h-40 items-center justify-center rounded-lg bg-zinc-800">
              <span className="text-sm text-zinc-500">Product Image</span>
            </div>

            {/* Product Labels */}
            <div className="mb-4 flex flex-wrap gap-2">
              {checkout.productLabels.map((label) => (
                <span
                  key={label}
                  className="rounded bg-zinc-800 px-2 py-1 text-xs text-gray-300"
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Price Display */}
            <div className="mb-5 flex items-center gap-3">
              <span className="text-lg text-gray-500 line-through">
                ${checkout.originalPrice}
              </span>
              <span className="text-3xl font-extrabold text-white">
                ${checkout.currentPrice}
              </span>
              <span className="rounded bg-red-600 px-2 py-1 text-xs font-bold text-white">
                SAVE ${savings}
              </span>
            </div>

            {/* Email Input */}
            <input
              type="email"
              placeholder="Your email address..."
              className="mb-3 w-full rounded-lg bg-zinc-800 px-4 py-3 text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />

            {/* Phone Input */}
            <div className="mb-4 flex gap-2">
              <span className="flex items-center rounded-lg bg-zinc-800 px-3 text-sm text-zinc-400">
                +1
              </span>
              <input
                type="tel"
                placeholder="Your phone number..."
                className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>

            {/* CTA Button */}
            <button
              type="button"
              onClick={handleScrollToCheckout}
              className="w-full cursor-pointer rounded-lg bg-green-500 px-6 py-4 text-lg font-extrabold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-green-600"
            >
              {checkout.ctaText}
            </button>

            {/* Trust Text */}
            <p className="mt-3 text-center text-xs text-zinc-500">
              🔒 100% Secure 256-Bit Encrypted Checkout
            </p>

            {/* Payment Logos Placeholder */}
            <div className="mt-3 flex items-center justify-center gap-3">
              {['Visa', 'MC', 'Amex', 'PayPal'].map((name) => (
                <span
                  key={name}
                  className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-500"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { VSLHeroSection };
