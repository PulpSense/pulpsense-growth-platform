import Image from 'next/image';

const DEFAULT_AVATARS = [
  '/assets/images/avatars/avatar-1.avif',
  '/assets/images/avatars/avatar-2.avif',
  '/assets/images/avatars/avatar-3.avif',
  '/assets/images/avatars/avatar-4.avif',
];

type TrustBadgeProps = {
  text: string;
  stars?: number;
  avatars?: string[];
};

const TrustBadge = ({
  text,
  stars = 5,
  avatars = DEFAULT_AVATARS,
}: TrustBadgeProps) => {
  return (
    <div className="flex items-center gap-3">
      {/* Overlapping profile images - hidden on mobile */}
      <div className="hidden -space-x-2 md:flex">
        {avatars.map((src, i) => (
          <Image
            key={i}
            src={src}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full border-2 border-navy-900 object-cover"
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Star rating */}
      <div className="flex items-center gap-1">
        {Array.from({ length: stars }).map((_, i) => (
          <svg
            key={i}
            className="size-4 text-orange-400"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        <span className="ml-1 text-sm text-gray-300">{text}</span>
      </div>
    </div>
  );
};

export { TrustBadge };
