'use client';

import { GradientButton, WistiaPlayer, YouTubePlayer } from '@/components/ui';
import type { SectionCTAConfig, VideoConfig } from './types';

export type VideoTestimonial = {
  video: VideoConfig;
  title?: string;
  subtitle?: string;
};

export type VideoTestimonialsProps = {
  headerLabel?: string;
  header: string;
  subheader?: string;
  videos: VideoTestimonial[];
  cta?: SectionCTAConfig;
};

const VideoTestimonials = ({
  headerLabel,
  header,
  subheader,
  videos,
  cta,
}: VideoTestimonialsProps) => {
  const renderVideo = (video: VideoConfig) => {
    if (video.provider === 'wistia') {
      return <WistiaPlayer mediaId={video.videoId} />;
    }
    if (video.provider === 'youtube') {
      return <YouTubePlayer videoId={video.videoId} />;
    }
    // Placeholder
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-gray-200">
        <span className="text-gray-500">Video Coming Soon</span>
      </div>
    );
  };

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-screen-lg px-4">
        {/* Header */}
        <div className="mb-12 text-center">
          {headerLabel && (
            <span className="mb-2 inline-block text-sm font-semibold text-blue-600 uppercase tracking-wider">
              {headerLabel}
            </span>
          )}
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            {header}
          </h2>
          {subheader && (
            <p className="mt-3 text-gray-600">{subheader}</p>
          )}
        </div>

        {/* Videos Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {videos.map((testimonial, index) => (
            <div key={index} className="overflow-hidden rounded-xl shadow-md">
              <div className="aspect-video">
                {renderVideo(testimonial.video)}
              </div>
              {(testimonial.title || testimonial.subtitle) && (
                <div className="bg-white p-4">
                  {testimonial.title && (
                    <h3 className="font-semibold text-gray-900">
                      {testimonial.title}
                    </h3>
                  )}
                  {testimonial.subtitle && (
                    <p className="mt-1 text-sm text-gray-600">
                      {testimonial.subtitle}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        {cta && (
          <div className="mt-12 text-center">
            <GradientButton xl href={cta.href} scrollTo={cta.scrollTo}>
              {cta.text}
            </GradientButton>
          </div>
        )}
      </div>
    </section>
  );
};

export { VideoTestimonials };
