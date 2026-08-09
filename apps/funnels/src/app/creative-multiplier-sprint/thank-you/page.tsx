import type { Metadata } from 'next';

import { SprintThankYouPage } from '../_components/SprintThankYouPage';

export const metadata: Metadata = {
  title: 'Call Booked | Creative Multiplier Sprint',
  description: 'What to prepare before your Creative Multiplier Sprint fit call.',
};

export default function CreativeMultiplierThankYouPage() {
  return <SprintThankYouPage qualified />;
}
