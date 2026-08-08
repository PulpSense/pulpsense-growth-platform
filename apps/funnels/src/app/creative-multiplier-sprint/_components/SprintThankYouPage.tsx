import { FunnelCta, FunnelLegalFooter } from '@/components/funnel';
import { creativeMultiplierContent } from '../content';

import s from './CreativeMultiplier.module.css';
import { ProofVideoPlayer } from './ProofVideoPlayer';

type SprintThankYouPageProps = {
  qualified: boolean;
};

const thankYouProofVideos = [
  {
    id: 'ugc-example-01',
    title: 'Studio interview hook',
    tone: 'Podcast-style authority angle',
  },
  {
    id: 'ugc-example-03',
    title: 'Lifestyle walk-through',
    tone: 'Polished vertical b-roll',
  },
  {
    id: 'ugc-example-04',
    title: 'Car POV testimonial',
    tone: 'Casual creator delivery',
  },
];

export function SprintThankYouPage({ qualified }: SprintThankYouPageProps) {
  const title = qualified
    ? 'Your Creative Multiplier Sprint call is booked.'
    : 'Thanks for applying.';
  const subtitle = qualified
    ? 'For the call, just have your winning ad and brand URL nearby. If you have creative guidelines or claims we should avoid, bring those too.'
    : 'This sprint is built for brands with a proven paid-social winner and at least $20k/month in ad spend. If that changes, come back with your winning ad and we can review fit.';
  const steps = qualified
    ? [
        'Have the winning ad link or file nearby.',
        'Bring your brand URL and any must-avoid claims if you have them.',
        'We handle the teardown, variation map, avatar direction, and production plan.',
      ]
    : [
        'Keep testing until you have one clear winning ad.',
        'Track which hook, offer, claim, and creator delivery style carried performance.',
        'Reapply when you are ready to multiply a validated creative.',
      ];

  return (
    <main className={s.page}>
      <section className={s.thankYouHero}>
        <span className={s.kicker}>{qualified ? 'Call confirmed' : 'Application received'}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {qualified && (
          <FunnelCta href="/creative-multiplier-sprint#proof" className={s.secondaryCta}>
            Review the proof examples
          </FunnelCta>
        )}
      </section>

      <section className={s.thankYouSteps}>
        {steps.map((step, index) => (
          <article key={step} className={s.stepCard}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>{step}</p>
          </article>
        ))}
      </section>

      {qualified && (
        <section className={s.thankYouProof} aria-labelledby="pre-call-proof-title">
          <div className={s.thankYouProofHeader}>
            <span className={s.kicker}>Pre-call reference</span>
            <h2 id="pre-call-proof-title">Review a few examples before the call.</h2>
            <p>
              These are the kinds of vertical clips we can use as reference when mapping your
              10 avatar variations.
            </p>
          </div>

          <div className={s.thankYouProofGrid}>
            {thankYouProofVideos.map((video) => (
              <article key={video.id} className={s.thankYouProofCard}>
                <div className={s.thankYouProofMedia}>
                  <ProofVideoPlayer
                    src={`/creative-multiplier-sprint/videos/${video.id}.mp4`}
                    poster={`/creative-multiplier-sprint/images/${video.id}.jpg`}
                    label={video.title}
                  />
                </div>
                <div className={s.thankYouProofMeta}>
                  <h3>{video.title}</h3>
                  <p>{video.tone}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <FunnelLegalFooter
        links={creativeMultiplierContent.footer.links}
        copyright={<> &copy; {new Date().getFullYear()} pulpsense.com. All Rights Reserved.</>}
        className={s.footer}
        linksClassName={s.footerLinks}
        copyrightClassName={s.footerCopy}
        after={<p>{creativeMultiplierContent.footer.platform}</p>}
      >
        <p>
          <strong>Performance Disclaimer:</strong>{' '}
          {creativeMultiplierContent.footer.disclaimer}
        </p>
      </FunnelLegalFooter>
    </main>
  );
}
