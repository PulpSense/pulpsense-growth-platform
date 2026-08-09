'use client';

import { MultiStepForm } from '@/components/ui/MultiStepForm';
import type { MultiStepFormConfig } from '@/components/ui/MultiStepForm';

import s from './CreativeMultiplier.module.css';

type ApplicationFormIslandProps = {
  config: MultiStepFormConfig;
};

export function ApplicationFormIsland({ config }: ApplicationFormIslandProps) {
  return (
    <div className={s.formEmbed}>
      <MultiStepForm config={config} />
    </div>
  );
}
