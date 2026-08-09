import type { Metadata } from 'next';

import { CreativeMultiplierPage } from './_components/CreativeMultiplierPage';

export const metadata: Metadata = {
  title: 'Creative Multiplier Sprint | 10 AI Avatar Videos in 2 Business Days',
  description:
    'Turn one proven paid-social ad into 10 ready-to-test AI avatar videos in 2 business days. Built for ecommerce brands with winning creatives.',
  openGraph: {
    title: 'Creative Multiplier Sprint | PulpSense',
    description:
      'Same winning ad. 10 new AI avatar videos. Delivered ready to test in 2 business days.',
    siteName: 'PulpSense',
    locale: 'en',
    type: 'website',
  },
};

export default function CreativeMultiplierSprintPage() {
  return <CreativeMultiplierPage />;
}
