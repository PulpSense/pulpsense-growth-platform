"use client";

import { MultiStepForm } from "@/components/ui/MultiStepForm";
import type { MultiStepFormConfig } from "@/components/ui/MultiStepForm";

import s from "./CreativeMultiplier.module.css";

type ApplicationFormIslandProps = {
  config: MultiStepFormConfig;
  turnstileSiteKey?: string;
};

export function ApplicationFormIsland({
  config,
  turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
}: ApplicationFormIslandProps) {
  return (
    <div className={s.formEmbed}>
      <MultiStepForm
        config={{
          ...config,
          ...(turnstileSiteKey ? { turnstileSiteKey } : {}),
        }}
      />
    </div>
  );
}
