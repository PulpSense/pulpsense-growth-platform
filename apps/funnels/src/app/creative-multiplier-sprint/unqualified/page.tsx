import type { Metadata } from 'next';

import { SprintThankYouPage } from '../_components/SprintThankYouPage';

export const metadata: Metadata = {
  title: 'Application Received | Creative Multiplier Sprint',
  description: 'Your Creative Multiplier Sprint application has been received.',
};

export default function CreativeMultiplierUnqualifiedPage() {
  return <SprintThankYouPage qualified={false} />;
}
