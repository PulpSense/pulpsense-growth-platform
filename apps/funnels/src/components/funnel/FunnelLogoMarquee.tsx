export type FunnelLogo = {
  src: string;
  alt: string;
};

type FunnelLogoMarqueeProps = {
  logos: FunnelLogo[];
  imageClassName?: string;
};

export function FunnelLogoMarquee({
  logos,
  imageClassName,
}: FunnelLogoMarqueeProps) {
  return (
    <>
      {[...logos, ...logos].map((logo, index) => (
        <img
          key={`${logo.src}-${index}`}
          src={logo.src}
          alt={logo.alt}
          width={120}
          height={44}
          loading="lazy"
          decoding="async"
          className={imageClassName}
        />
      ))}
    </>
  );
}
