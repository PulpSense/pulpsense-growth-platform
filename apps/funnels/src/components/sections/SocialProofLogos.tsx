import { Marquee } from "@/components/ui";

export type SocialProofLogosProps = {
  title?: string;
  logos: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }>;
  /** Use true for white logos that need to be darkened */
  invertLogos?: boolean;
};

const SocialProofLogos = ({
  title,
  logos,
  invertLogos = false,
}: SocialProofLogosProps) => {
  return (
    <div className="bg-gray-50 py-4">
      <div className="mx-auto max-w-5xl px-4">
        <Marquee pauseOnHover className="[--duration:20s] [--gap:3rem]">
          {logos.map((logo, index) => (
            <img
              key={index}
              src={logo.src}
              alt={logo.alt}
              width={logo.width || 120}
              height={logo.height || 40}
              loading="lazy"
              decoding="async"
              className={`h-8 w-auto object-contain transition-all ${
                invertLogos
                  ? "opacity-60 brightness-0 hover:opacity-80"
                  : "opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
              }`}
            />
          ))}
        </Marquee>
        {title && (
          <p className="mt-3 text-center text-sm font-medium tracking-wide text-gray-500 uppercase">
            {title}
          </p>
        )}
      </div>
    </div>
  );
};

export { SocialProofLogos };
