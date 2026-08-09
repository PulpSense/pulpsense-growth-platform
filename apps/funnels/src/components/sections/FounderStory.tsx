'use client';

import { GradientButton, PillBadge } from '@/components/ui';

import type { FounderStoryImage, FounderStoryProps } from './types';

const ImageWithCaption = ({ image }: { image: FounderStoryImage }) => {
  return (
    <div className="flex flex-col">
      {image.src ? (
        <img
          src={image.src}
          alt={image.alt}
          className="aspect-square w-full rounded-lg object-cover"
        />
      ) : (
        <div
          className="flex aspect-square w-full items-center justify-center rounded-lg bg-gray-200"
          aria-label={image.alt}
        >
          <span className="text-xs text-gray-500">Image</span>
        </div>
      )}
      <p className="mt-2 text-center text-sm text-gray-600">{image.caption}</p>
    </div>
  );
};

const FounderStory = ({
  sectionLabel,
  name,
  namePrefix,
  paragraphs,
  featuredImage,
  galleryImages,
  additionalContent,
  quote,
  cta,
}: FounderStoryProps) => {
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-4xl px-4">
        {/* Section label as light pill badge with icon */}
        {sectionLabel && (
          <div className="mb-4 flex justify-center">
            <PillBadge
              variant="light"
              icon={
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[12px] font-black leading-none text-white">
                  ?
                </span>
              }
            >
              {sectionLabel}
            </PillBadge>
          </div>
        )}

        {/* Main headline with highlighted name */}
        <h2 className="mb-12 text-center text-2xl font-bold text-black md:text-3xl">
          {namePrefix && <span>{namePrefix} </span>}
          <span className="relative inline-block">
            <span className="relative z-10">{name}</span>
            <span
              className="absolute inset-x-0 bottom-1 z-0 h-3 rounded-sm bg-gradient-to-r from-orange-400 to-yellow-300"
              aria-hidden="true"
            />
          </span>
        </h2>

        {/* Two-column layout: paragraphs left, featured image right */}
        <div className="mb-12 grid gap-8 md:grid-cols-2">
          <div className="space-y-6 text-gray-700">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          {featuredImage && (
            <div className="flex items-start justify-center">
              {featuredImage.src ? (
                <img
                  src={featuredImage.src}
                  alt={featuredImage.alt}
                  className="w-full max-w-sm rounded-lg object-cover"
                />
              ) : (
                <div
                  className="flex aspect-[3/4] w-full max-w-sm items-center justify-center rounded-lg bg-gray-200"
                  aria-label={featuredImage.alt}
                >
                  <span className="text-sm text-gray-500">Featured Image</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Gallery images with captions */}
        {galleryImages && galleryImages.length > 0 && (
          <div className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {galleryImages.map((image, index) => (
              <ImageWithCaption key={index} image={image} />
            ))}
          </div>
        )}

        {/* Additional content block with image */}
        {additionalContent && (
          <div className="mb-12 grid gap-8 md:grid-cols-2">
            {additionalContent.image && (
              <div className="flex items-start justify-center">
                {additionalContent.image.src ? (
                  <img
                    src={additionalContent.image.src}
                    alt={additionalContent.image.alt}
                    className="w-full rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="flex aspect-video w-full items-center justify-center rounded-lg bg-gray-200"
                    aria-label={additionalContent.image.alt}
                  >
                    <span className="text-sm text-gray-500">Image</span>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-6 text-gray-700">
              {additionalContent.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        )}

        {/* Quote */}
        {quote && (
          <blockquote className="mb-12 border-l-4 border-orange-500 pl-6 text-xl italic text-black">
            &ldquo;{quote}&rdquo;
          </blockquote>
        )}

        {/* CTA Button */}
        {cta && (
          <div className="text-center">
            <GradientButton xl scrollTo={cta.scrollTo}>
              {cta.text}
            </GradientButton>
          </div>
        )}
      </div>
    </section>
  );
};

export { FounderStory };
