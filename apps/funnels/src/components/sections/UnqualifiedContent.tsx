import type { UnqualifiedContentProps } from './types';

const UnqualifiedContent = ({
  followUpMessage,
  requirements,
  reapplyText,
  reapplyHref,
}: UnqualifiedContentProps) => {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-3xl px-4 md:px-12">
        <h2 className="mb-8 text-center text-xl font-bold text-black md:text-2xl">
          {followUpMessage}
        </h2>

        {/* Requirements checklist */}
        <ul className="mx-auto mb-8 max-w-lg space-y-4">
          {requirements.map((req) => (
            <li key={req} className="flex items-start gap-3">
              <svg
                className="mt-0.5 size-6 shrink-0 text-green-500"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-lg text-black">{req}</span>
            </li>
          ))}
        </ul>

        {/* Reapply link */}
        <p className="text-center text-sm text-gray-500">
          {reapplyText}{' '}
          <a
            href={reapplyHref}
            className="font-semibold text-orange-500 underline hover:text-orange-400"
          >
            Reapply here
          </a>
        </p>
      </div>
    </section>
  );
};

export { UnqualifiedContent };
