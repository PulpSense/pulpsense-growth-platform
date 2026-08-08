'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type SlideVariant =
  | 'pressure'
  | 'face'
  | 'delay'
  | 'risk'
  | 'method'
  | 'preserve'
  | 'matrix'
  | 'mechanism'
  | 'input'
  | 'output'
  | 'speed'
  | 'qa'
  | 'guarantee'
  | 'cta';

type Slide = {
  eyebrow: string;
  title: string;
  body: string;
  variant: SlideVariant;
};

const slides: Slide[] = [
  {
    eyebrow: '01 / Pressure',
    title: 'Your winner is dying before your team can replace it.',
    body: 'The sales argument still works. The visible wrapper is getting tired.',
    variant: 'pressure',
  },
  {
    eyebrow: '02 / Diagnosis',
    title: 'The ad is not dead. The face is tired.',
    body: 'Your offer can still be strong while the same creator, tone, and delivery stop earning attention.',
    variant: 'face',
  },
  {
    eyebrow: '03 / Delay',
    title: 'By the time the batch lands, CPA may already be moving.',
    body: 'Briefs, shipping, filming, editing, and revisions can take weeks. Your buyer needs fresh tests this week.',
    variant: 'delay',
  },
  {
    eyebrow: '04 / Risk',
    title: 'Random new concepts reset the learning.',
    body: 'If one ad already proved it can sell, changing everything turns the next test into a gamble.',
    variant: 'risk',
  },
  {
    eyebrow: '05 / Method',
    title: 'Preserve the winner. Change the avatar layer.',
    body: 'Keep the reason people buy. Change the visible delivery so the same winner gets more shots.',
    variant: 'method',
  },
  {
    eyebrow: '06 / Preserve',
    title: 'Do not rewrite the thing that made people buy.',
    body: 'Hook, offer, proof, objections, pacing, and CTA do not get lost in AI randomness.',
    variant: 'preserve',
  },
  {
    eyebrow: '07 / Change',
    title: 'Same argument. Different avatar profiles.',
    body: 'Test who the message lands through: different ethnicities, body types, ages, and delivery styles without rebuilding the strategy.',
    variant: 'matrix',
  },
  {
    eyebrow: '08 / Mechanism',
    title: 'That is the Winner Avatar Multiplier.',
    body: 'One proven ad becomes a controlled batch of avatar-led versions built for paid-social testing.',
    variant: 'mechanism',
  },
  {
    eyebrow: '09 / Input',
    title: 'You do not need a creative brief. You need one proven ad.',
    body: 'No full brief before booking. If the sprint is a fit, the winner gives us the structure to multiply.',
    variant: 'input',
  },
  {
    eyebrow: '10 / Output',
    title: 'You get 10 avatar videos, not a tool login.',
    body: 'Finished vertical files. Same core concept. New avatar-led delivery. Ready for Meta, TikTok, Reels, or Shorts.',
    variant: 'output',
  },
  {
    eyebrow: '11 / Speed',
    title: 'Fresh tests before the winner burns out.',
    body: 'The sprint is built for speed because winners do not stay fresh forever.',
    variant: 'speed',
  },
  {
    eyebrow: '12 / QA',
    title: 'Not raw AI exports. QA checked creative.',
    body: 'We review clarity, pacing, brand fit, and whether each file is usable as paid-social creative.',
    variant: 'qa',
  },
  {
    eyebrow: '13 / Guarantee',
    title: 'Usable creative after one revision pass or refund.',
    body: 'No ROAS promises. Just launch-ready creative after one revision pass, or your payment back.',
    variant: 'guarantee',
  },
  {
    eyebrow: '14 / Apply',
    title: 'Got one ad that already works?',
    body: 'Answer the fit questions. If your winner is a match, book the sprint call and bring the ad with you.',
    variant: 'cta',
  },
];

const CheckIcon = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="m3.2 8.4 2.7 2.7 6.9-6.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MiniCard = ({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'hot' | 'good' }) => {
  const toneClass =
    tone === 'hot'
      ? 'border-[#FF6B1A]/25 bg-[#FF6B1A]/10 text-[#ffb28a]'
      : tone === 'good'
        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
        : 'border-white/10 bg-white/[0.04] text-[#D0D6E0]';

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-sm font-medium leading-tight text-white">{value}</p>
    </div>
  );
};

const speedSteps = [
  ['Day 0', 'Intake'],
  ['Day 1', 'Build'],
  ['Day 2', 'Deliver'],
] as const;

const delaySteps = [
  ['Day 1', 'Brief'],
  ['Day 5', 'Ship'],
  ['Day 12', 'First cut'],
  ['Now', 'Need tests'],
] as const;

const SlideChrome = ({ index }: { slide: Slide; index: number }) => (
  <span className="absolute right-0 top-0 text-xs tabular-nums text-[#62666D]">{String(index + 1).padStart(2, '0')} / {slides.length}</span>
);

const SlideTitle = ({ children, size = 'normal' }: { children: ReactNode; size?: 'normal' | 'large' | 'small' }) => {
  const sizeClass =
    size === 'large'
      ? 'text-[2.35rem] sm:text-[3.2rem] md:text-[4rem]'
      : size === 'small'
        ? 'text-[1.18rem] sm:text-[1.9rem] md:text-[2.2rem]'
        : 'text-[1.38rem] sm:text-[2.1rem] md:text-[2.35rem]';

  return <h3 className={`font-medium leading-[0.98] tracking-[-0.055em] text-white ${sizeClass}`}>{children}</h3>;
};

const SlideBody = ({ children }: { children: ReactNode }) => (
  <p className="text-[0.88rem] leading-6 text-[#AEB6C2] sm:text-base sm:leading-7">{children}</p>
);

const MobileProofPill = ({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'hot' | 'good' }) => {
  const toneClass =
    tone === 'hot'
      ? 'border-[#FF6B1A]/25 bg-[#FF6B1A]/10 text-[#ffb28a]'
      : tone === 'good'
        ? 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300'
        : 'border-white/10 bg-white/[0.04] text-[#AEB6C2]';

  return (
    <div className={`rounded-lg border px-2.5 py-2 ${toneClass}`}>
      <p className="text-[0.58rem] font-medium uppercase leading-none tracking-[0.16em]">{label}</p>
      <p className="mt-1.5 text-xs font-semibold leading-tight text-white">{value}</p>
    </div>
  );
};

const renderSlideContent = (slide: Slide, index: number) => {
  switch (slide.variant) {
    case 'pressure':
      return (
        <div className="grid h-full gap-3 pr-14 md:grid-cols-[0.9fr_1fr] md:items-center md:gap-5 md:pr-12">
          <SlideChrome slide={slide} index={index} />
          <div className="space-y-4">
            <SlideTitle>{slide.title}</SlideTitle>
            <p className="max-w-md text-sm leading-6 text-[#AEB6C2]">{slide.body}</p>
            <div className="grid grid-cols-2 gap-2 md:hidden">
              <MobileProofPill label="Winner" value="still converts" tone="good" />
              <MobileProofPill label="Wrapper" value="aging fast" tone="hot" />
            </div>
          </div>
          <div className="hidden rounded-2xl border border-white/10 bg-black/25 p-4 md:block">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Winner signal</p>
                <span className="text-emerald-300">
                  <CheckIcon />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold leading-tight text-white">Still converts</p>
            </div>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="rounded-full border border-[#FF6B1A]/25 bg-[#FF6B1A]/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#ffb28a]">
                wrapper aging
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <div className="rounded-xl border border-[#FF6B1A]/25 bg-[#FF6B1A]/10 p-3">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#ffb28a]">
                <span>Same face</span>
                <span>Fatigue rising</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/35">
                <div className="h-full w-[78%] rounded-full bg-[#FF6B1A]" />
              </div>
              <p className="mt-3 text-lg font-semibold leading-tight text-white">The idea is working. The wrapper is wearing out.</p>
            </div>
          </div>
        </div>
      );
    case 'face':
      return (
        <div className="grid h-full gap-3 pr-14 md:grid-cols-[0.9fr_1fr] md:items-center md:gap-5 md:pr-12">
          <SlideChrome slide={slide} index={index} />
          <div className="space-y-4">
            <SlideTitle>{slide.title}</SlideTitle>
            <p className="max-w-md text-sm leading-6 text-[#AEB6C2]">{slide.body}</p>
          </div>
          <div className="hidden rounded-2xl border border-white/10 bg-black/25 p-4 md:block">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs uppercase tracking-[0.2em] text-[#8A8F98]">What still works</span>
              <span className="text-emerald-300">
                <CheckIcon />
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold leading-tight text-white">Offer + sales argument</p>
            <div className="my-5 h-px bg-white/10" />
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-[#ffb28a]">What fatigues first</span>
              <span className="rounded-full border border-[#FF6B1A]/25 bg-[#FF6B1A]/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#ffb28a]">
                replace
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold leading-tight text-white">Face + delivery wrapper</p>
          </div>
        </div>
      );
    case 'delay':
      return (
        <div className="grid h-full gap-3 pr-14 md:grid-cols-[0.85fr_1fr] md:items-center md:gap-5 md:pr-12">
          <SlideChrome slide={slide} index={index} />
          <div className="space-y-3 md:space-y-4">
            <SlideTitle>{slide.title}</SlideTitle>
            <p className="max-w-md text-sm leading-5 text-[#AEB6C2] md:leading-6">{slide.body}</p>
          </div>
          <div className="rounded-lg border border-[#FF6B1A]/25 bg-[#FF6B1A]/10 px-2.5 py-2 md:hidden">
            <p className="text-[0.58rem] font-medium uppercase leading-none tracking-[0.16em] text-[#ffb28a]">Meanwhile</p>
            <p className="mt-1.5 text-xs font-semibold leading-tight text-white">Account needs tests now.</p>
          </div>
          <div className="relative hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4 md:block">
            <div className="absolute left-[1.35rem] right-[1.35rem] top-[1.375rem] hidden h-px bg-gradient-to-r from-white/20 via-[#FF6B1A]/60 to-[#FF6B1A] md:block" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {delaySteps.map(([label, value], itemIndex) => (
                <div key={label} className="relative">
                  <div className={`relative z-10 mb-4 h-3 w-3 rounded-full ${itemIndex === 3 ? 'bg-[#FF6B1A]' : 'bg-white/25'}`} />
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#8A8F98]">{label}</p>
                  <p className="mt-2 text-sm font-medium leading-tight text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-7 rounded-xl border border-[#FF6B1A]/25 bg-[#FF6B1A]/10 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#ffb28a]">Meanwhile</p>
              <p className="mt-2 text-lg font-semibold leading-tight text-white">The account still needs tests now.</p>
            </div>
          </div>
        </div>
      );
    case 'risk':
      return (
        <div className="grid h-full gap-3 pr-14 md:grid-cols-[1fr_0.9fr] md:items-center md:gap-4 md:pr-0">
          <div className="space-y-4">
            <SlideChrome slide={slide} index={index} />
            <SlideTitle>{slide.title}</SlideTitle>
            <SlideBody>{slide.body}</SlideBody>
          </div>
          <div className="hidden gap-2 md:grid">
            {['New hook', 'New offer', 'New proof'].map((item) => (
              <div key={item} className="rounded-xl border border-red-400/20 bg-red-400/[0.045] p-3 text-sm font-medium text-white">
                ! {item}
              </div>
            ))}
          </div>
        </div>
      );
    case 'method':
      return (
        <div className="grid h-full gap-3 pr-14 md:grid-cols-[0.9fr_1fr] md:items-center md:gap-5 md:pr-12">
          <SlideChrome slide={slide} index={index} />
          <div className="space-y-4">
            <SlideTitle>{slide.title}</SlideTitle>
            <p className="max-w-md text-sm leading-6 text-[#AEB6C2]">{slide.body}</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:hidden">
              <MobileProofPill label="Keep" value="buying reason" tone="good" />
              <span className="text-xs font-semibold text-[#FF6B1A]">+</span>
              <MobileProofPill label="Swap" value="avatar layer" tone="hot" />
            </div>
          </div>
          <div className="hidden gap-2 md:grid">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Keep locked</p>
              <p className="mt-3 text-2xl font-semibold leading-tight text-white">The buying reason</p>
            </div>
            <div className="flex items-center justify-center">
              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#8A8F98]">
                change one layer
              </span>
            </div>
            <div className="rounded-2xl border border-[#FF6B1A]/25 bg-[#FF6B1A]/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#ffb28a]">Swap fast</p>
              <p className="mt-3 text-2xl font-semibold leading-tight text-white">The visible messenger</p>
            </div>
          </div>
        </div>
      );
    case 'preserve':
      return (
        <div className="grid h-full gap-3 pr-14 md:flex md:flex-col md:justify-between md:gap-4 md:pr-0">
          <SlideChrome slide={slide} index={index} />
          <div className="grid flex-1 gap-3 md:grid-cols-[0.95fr_1fr] md:items-center md:gap-4">
            <SlideTitle size="small">{slide.title}</SlideTitle>
            <div className="relative rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 md:rounded-2xl md:p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Locked core</p>
              <p className="mt-2 text-xl font-semibold leading-tight text-white md:mt-4 md:text-3xl">Winning argument</p>
              <div className="mt-3 grid grid-cols-2 gap-2 md:mt-5">
                {['Hook', 'Offer', 'Proof', 'CTA'].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-lg border border-emerald-400/15 bg-black/20 p-2 text-xs font-medium text-white">
                    <span className="text-emerald-300">
                      <CheckIcon />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    case 'matrix':
      return (
        <div className="flex h-full flex-col justify-between gap-3 pr-0 md:grid md:grid-cols-[0.9fr_1fr] md:items-center md:gap-5 md:pr-12">
          <SlideChrome slide={slide} index={index} />
          <div className="space-y-3 pr-14 md:space-y-4 md:pr-0">
            <SlideTitle>{slide.title}</SlideTitle>
            <p className="hidden max-w-md text-sm leading-5 text-[#AEB6C2] md:block md:leading-6">{slide.body}</p>
          </div>
          <div className="-mx-2 rounded-xl border border-white/10 bg-black/25 p-2 md:mx-0 md:rounded-2xl md:p-4">
            <div className="mb-2 hidden items-center justify-between border-b border-white/10 pb-2 md:mb-3 md:flex md:pb-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8A8F98]">Avatar layer</p>
              <p className="text-xs uppercase tracking-[0.18em] text-[#ffb28a]">same script</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5 md:grid-cols-2 md:gap-2">
              {[
                { label: 'Asian creator', mobileLabel: 'Asian', face: 'bg-[#d6aa78]', body: 'w-6 bg-[#2563EB]/25 md:w-8' },
                { label: 'Black creator', mobileLabel: 'Black', face: 'bg-[#6f3e27]', body: 'w-6 bg-[#FF6B1A]/25 md:w-8' },
                { label: 'Plus-size creator', mobileLabel: 'Plus', face: 'bg-[#b97852]', body: 'w-8 bg-emerald-400/20 md:w-12' },
                { label: 'Older expert', mobileLabel: 'Older', face: 'bg-[#c8a07b]', body: 'w-6 bg-white/15 md:w-8' },
              ].map((avatar) => (
                <div key={avatar.label} className="rounded-lg border border-white/10 bg-white/[0.035] p-1.5 md:rounded-xl md:p-3">
                  <div className="mx-auto flex h-7 w-7 flex-col items-center justify-end overflow-hidden rounded-full border border-white/10 bg-black/25 md:h-14 md:w-14">
                    <div className={`h-3.5 w-3.5 rounded-full md:h-6 md:w-6 ${avatar.face}`} />
                    <div className={`mt-0.5 h-2 rounded-t-full md:mt-1 md:h-5 ${avatar.body}`} />
                  </div>
                  <p className="mt-1 text-center text-[9px] font-medium leading-tight text-white md:mt-2 md:text-xs">
                    <span className="md:hidden">{avatar.mobileLabel}</span>
                    <span className="hidden md:inline">{avatar.label}</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-2 hidden rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] p-2 md:mt-3 md:block md:rounded-xl md:p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-white md:text-sm">
                <span className="text-emerald-300">
                  <CheckIcon />
                </span>
                Same sales argument underneath
              </div>
            </div>
          </div>
        </div>
      );
    case 'mechanism':
      return (
        <div className="grid h-full gap-3 pr-14 md:grid-cols-[0.75fr_1fr] md:items-center md:gap-4 md:pr-0">
          <div className="space-y-4">
            <SlideChrome slide={slide} index={index} />
            <SlideTitle size="small">{slide.title}</SlideTitle>
            <p className="max-w-md text-sm leading-6 text-[#AEB6C2] md:hidden">{slide.body}</p>
          </div>
          <div className="hidden rounded-2xl border border-[#FF6B1A]/25 bg-[#FF6B1A]/[0.075] p-4 text-center md:block">
            <p className="text-5xl font-semibold leading-none text-white">1</p>
            <p className="text-xs uppercase tracking-[0.2em] text-[#ffb28a]">winner</p>
            <p className="my-2 text-[#8A8F98]">x avatar layer</p>
            <p className="text-5xl font-semibold leading-none text-white">10</p>
            <p className="text-xs uppercase tracking-[0.2em] text-[#ffb28a]">variants</p>
          </div>
        </div>
      );
    case 'input':
      return (
        <div className="grid h-full gap-3 pr-14 md:grid-cols-[1fr_0.9fr] md:items-center md:gap-4 md:pr-0">
          <div className="space-y-4">
            <SlideChrome slide={slide} index={index} />
            <SlideTitle>{slide.title}</SlideTitle>
            <p className="max-w-md text-sm leading-6 text-[#AEB6C2]">{slide.body}</p>
          </div>
          <div className="hidden rounded-2xl border border-white/10 bg-black/25 p-4 md:block">
            <p className="text-xs uppercase tracking-[0.2em] text-[#8A8F98]">Intake receipt</p>
            <div className="mt-4 grid gap-2">
              {['Winning ad link', 'Brand URL', 'Claims to keep', 'Claims to avoid'].map((item) => (
                <div key={item} className="flex items-center justify-between border-b border-white/10 pb-2 text-sm text-[#D0D6E0] last:border-b-0 last:pb-0">
                  <span>{item}</span>
                  <span className="text-emerald-300">
                    <CheckIcon />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case 'output':
      return (
        <div className="grid h-full gap-3 pr-14 md:grid-cols-[0.9fr_1fr] md:items-center md:gap-5 md:pr-12">
          <SlideChrome slide={slide} index={index} />
          <div className="space-y-3 md:space-y-4">
            <SlideTitle>{slide.title}</SlideTitle>
            <p className="max-w-md text-sm leading-5 text-[#AEB6C2] md:leading-6">{slide.body}</p>
            <div className="rounded-lg border border-[#FF6B1A]/25 bg-[#FF6B1A]/10 px-2.5 py-2 md:hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-2xl font-semibold leading-none text-white">10</p>
                  <p className="mt-0.5 text-[0.58rem] font-medium uppercase tracking-[0.16em] text-[#ffb28a]">finished files</p>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 10 }).map((_, itemIndex) => (
                    <span key={itemIndex} className="h-5 w-2.5 rounded-sm border border-white/10 bg-white/[0.06]" />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="hidden rounded-2xl border border-white/10 bg-black/25 p-4 md:block">
            <div className="flex items-end justify-between border-b border-white/10 pb-3">
              <div>
                <p className="text-5xl font-semibold leading-none text-white">10</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#ffb28a]">finished videos</p>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1 text-xs font-medium text-emerald-300">
                ready to test
              </span>
            </div>
            <div className="mt-4 grid gap-2">
              {['Vertical files', 'Same winning argument', 'Different avatar delivery'].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm font-medium text-white">
                  <span className="text-[#FF6B1A]">
                    <CheckIcon />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case 'speed':
      return (
        <div className="grid h-full gap-3 pr-14 md:grid-cols-[0.9fr_1fr] md:items-center md:gap-5 md:pr-12">
          <SlideChrome slide={slide} index={index} />
          <div className="space-y-4">
            <SlideTitle>{slide.title}</SlideTitle>
            <p className="max-w-md text-sm leading-6 text-[#AEB6C2]">{slide.body}</p>
          </div>
          <div className="hidden rounded-2xl border border-white/10 bg-black/25 p-4 md:block">
            <div className="border-b border-white/10 pb-4">
              <p className="text-6xl font-semibold leading-none text-white">48h</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#ffb28a]">after intake</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {speedSteps.map(([label, value]) => (
                <MiniCard key={label} label={label} value={value} tone={label === 'Day 2' ? 'hot' : 'neutral'} />
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-[#AEB6C2]">So your buyer gets fresh tests before the existing winner fully burns out.</p>
          </div>
        </div>
      );
    case 'qa':
      return (
        <div className="grid h-full gap-3 pr-14 md:grid-cols-[0.9fr_1fr] md:items-center md:gap-5 md:pr-12">
          <SlideChrome slide={slide} index={index} />
          <div className="space-y-4">
            <SlideTitle>{slide.title}</SlideTitle>
            <p className="max-w-md text-sm leading-6 text-[#AEB6C2]">{slide.body}</p>
          </div>
          <div className="hidden rounded-2xl border border-white/10 bg-black/25 p-4 md:block">
            <div className="rounded-xl border border-red-400/20 bg-red-400/[0.045] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-red-300">Raw AI</p>
              <p className="mt-2 text-sm font-medium text-white">awkward / off-brand / unclear</p>
            </div>
            <div className="my-3 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="rounded-full border border-[#FF6B1A]/25 bg-[#FF6B1A]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#ffb28a]">
                QA pass
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Launch-ready</p>
              <div className="mt-3 grid gap-2">
                {['Clarity', 'Pacing', 'Brand fit'].map((item) => (
                  <div key={item} className="flex items-center justify-between text-sm text-white">
                    <span>{item}</span>
                    <span className="text-emerald-300">
                      <CheckIcon />
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-white">
                <span className="text-emerald-300">
                  <CheckIcon />
                </span>
                {slide.title}
              </div>
            </div>
          </div>
        </div>
      );
    case 'guarantee':
      return (
        <div className="grid h-full gap-3 pr-14 md:grid-cols-[1fr_0.85fr] md:items-center md:gap-4 md:pr-0">
          <div className="space-y-4">
            <SlideChrome slide={slide} index={index} />
            <SlideTitle>{slide.title}</SlideTitle>
            <p className="max-w-md text-sm leading-6 text-[#AEB6C2] md:hidden">{slide.body}</p>
          </div>
          <div className="hidden rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4 md:block">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Risk reversal</p>
            <p className="mt-3 text-4xl font-semibold leading-tight text-white">Refund.</p>
            <p className="mt-2 text-sm leading-6 text-[#AEB6C2]">After one revision pass.</p>
          </div>
        </div>
      );
    case 'cta':
      return (
        <div className="grid h-full gap-3 pr-14 md:grid-cols-[1fr_0.82fr] md:items-center md:gap-4 md:pr-0">
          <div className="space-y-4">
            <SlideChrome slide={slide} index={index} />
            <SlideTitle>{slide.title}</SlideTitle>
            <SlideBody>{slide.body}</SlideBody>
            <a
              href="#apply"
              onClick={(event) => event.stopPropagation()}
              className="relative z-20 inline-flex w-full items-center justify-center rounded-md border border-[#ff8752]/35 bg-[#B94100] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_40px_rgba(255,107,26,0.18)] transition hover:bg-[#A83B00] sm:w-auto sm:px-6"
            >
              Apply now
            </a>
          </div>
          <div className="hidden gap-2 md:grid">
            <MiniCard label="Best fit" value="$20k+/mo paid social" tone="good" />
            <MiniCard label="Required" value="One proven winner" tone="hot" />
          </div>
        </div>
      );
    default:
      return null;
  }
};

export function DslCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const centeredEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const index = centeredEntry?.target.getAttribute('data-slide-index');

        if (index !== null) {
          setActiveIndex(Number(index));
        }
      },
      {
        root: track,
        threshold: [0.55, 0.7, 0.85],
      },
    );

    Array.from(track.children).forEach((slide) => observer.observe(slide));

    return () => observer.disconnect();
  }, []);

  const goToSlide = (index: number, behavior: ScrollBehavior = 'smooth') => {
    const track = trackRef.current;
    if (!track) return;

    const clampedIndex = Math.max(0, Math.min(index, slides.length - 1));
    const slide = track.children.item(clampedIndex) as HTMLElement | null;
    const firstSlide = track.children.item(0) as HTMLElement | null;
    const secondSlide = track.children.item(1) as HTMLElement | null;
    const slideStep =
      firstSlide && secondSlide
        ? secondSlide.getBoundingClientRect().left - firstSlide.getBoundingClientRect().left
        : track.clientWidth;

    setActiveIndex(clampedIndex);
    if (slide) {
      track.scrollTo({ left: clampedIndex * slideStep, behavior });
    }
  };

  const showTapCue = activeIndex === 0 && !hasInteracted;

  return (
    <section className="relative mt-3 overflow-hidden bg-transparent px-4 pb-5 pt-0 select-none md:mt-5 md:px-8 md:pb-12 md:pt-0 lg:mt-2" aria-labelledby="dsl-heading">
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-2 flex items-end justify-between gap-4 md:mb-3">
          <h2 id="dsl-heading" className="text-sm font-medium leading-tight text-[#D0D6E0] sm:text-base md:text-lg">
            The sprint, explained fast.
          </h2>
          <p className="hidden text-xs font-medium uppercase tracking-[0.22em] text-[#62666D] sm:block">
            Use edges or swipe
          </p>
        </div>

        <div className="relative">
          <div
            ref={trackRef}
            onPointerDown={() => setHasInteracted(true)}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 md:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Creative Multiplier Sprint deck"
          >
            {slides.map((slide, index) => (
              <article
                key={slide.eyebrow}
                data-slide-index={index}
                className="relative flex h-[255px] w-full shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-[#0F1011]/95 px-7 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:h-auto sm:min-h-[360px] sm:rounded-[24px] sm:p-7 sm:shadow-[0_30px_90px_rgba(0,0,0,0.35)] md:min-h-[350px] md:p-8 lg:min-h-[360px]"
                aria-label={`Slide ${index + 1} of ${slides.length}`}
              >
                <div className="absolute inset-x-0 top-0 hidden h-px bg-gradient-to-r from-transparent via-[#FF6B1A]/70 to-transparent sm:block" />
                <div className="absolute -right-20 -top-20 hidden h-56 w-56 rounded-full bg-[#FF6B1A]/10 blur-3xl sm:block" />
                <div className="absolute -bottom-24 left-10 hidden h-56 w-56 rounded-full bg-[#7170FF]/10 blur-3xl sm:block" />
                <div className="relative h-full">{renderSlideContent(slide, index)}</div>
              </article>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setHasInteracted(true);
              goToSlide(activeIndex - 1);
            }}
            disabled={activeIndex === 0}
            className="group absolute left-0 top-0 z-10 flex h-[255px] w-16 cursor-pointer items-center justify-start rounded-l-xl bg-gradient-to-r from-transparent to-transparent transition hover:from-[#FF6B1A]/12 focus:outline-none disabled:pointer-events-none disabled:opacity-30 sm:h-[360px] sm:w-20 sm:rounded-l-[24px] md:inset-y-0 md:h-auto md:w-24 md:from-black/10 md:hover:from-[#FF6B1A]/14"
            aria-label="Previous slide"
          >
            <span className="pointer-events-none absolute inset-y-0 left-0 w-14 rounded-l-xl bg-gradient-to-r from-[#FF6B1A]/18 to-transparent opacity-0 transition group-hover:opacity-100 sm:rounded-l-[24px] md:w-full md:from-[#FF6B1A]/22" />
            <span className="flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-[#FF6B1A]/25 bg-black/60 text-white shadow-[0_0_22px_rgba(255,107,26,0.20),0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur transition group-hover:border-[#FF6B1A]/45 group-hover:bg-[#B94100]/85 group-hover:shadow-[0_0_30px_rgba(255,107,26,0.34),0_12px_32px_rgba(0,0,0,0.35)] group-focus-visible:ring-2 group-focus-visible:ring-[#FF6B1A]/60 md:h-11 md:w-11">
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12.5 4.5 7 10l5.5 5.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setHasInteracted(true);
              goToSlide(activeIndex + 1);
            }}
            disabled={activeIndex === slides.length - 1}
            className="group absolute right-0 top-0 z-10 flex h-[255px] w-16 cursor-pointer items-center justify-end rounded-r-xl bg-gradient-to-l from-transparent to-transparent transition hover:from-[#FF6B1A]/12 focus:outline-none disabled:pointer-events-none disabled:opacity-30 sm:h-[360px] sm:w-20 sm:rounded-r-[24px] md:inset-y-0 md:h-auto md:w-24 md:from-black/10 md:hover:from-[#FF6B1A]/14"
            aria-label="Next slide"
          >
            <span
              className={`pointer-events-none absolute inset-y-0 right-0 w-14 rounded-r-xl bg-gradient-to-l from-[#FF6B1A]/18 to-transparent opacity-0 transition group-hover:opacity-100 sm:rounded-r-[24px] md:w-full md:from-[#FF6B1A]/22 ${showTapCue ? 'click-cue-edge' : ''}`}
            />
            {showTapCue ? (
              <span className="click-cue-pill pointer-events-none absolute -right-4 top-1/2 h-9 w-9 rounded-full border border-[#FF6B1A]/35 bg-[#FF6B1A]/20 shadow-[0_0_30px_rgba(255,107,26,0.35)] md:h-11 md:w-11" />
            ) : null}
            <span className="flex h-9 w-9 translate-x-1/2 items-center justify-center rounded-full border border-[#FF6B1A]/25 bg-black/60 text-white shadow-[0_0_22px_rgba(255,107,26,0.20),0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur transition group-hover:border-[#FF6B1A]/45 group-hover:bg-[#B94100]/85 group-hover:shadow-[0_0_30px_rgba(255,107,26,0.34),0_12px_32px_rgba(0,0,0,0.35)] group-focus-visible:ring-2 group-focus-visible:ring-[#FF6B1A]/60 md:h-11 md:w-11">
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="m7.5 4.5 5.5 5.5-5.5 5.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>

        <div className="mt-2 flex w-full flex-nowrap items-center justify-center gap-1 overflow-hidden px-1 md:mt-3" aria-label="Slide progress">
          {slides.map((slide, index) => (
            <button
              key={slide.eyebrow}
              type="button"
              onClick={() => goToSlide(index, 'auto')}
              className={`h-1.5 min-w-0 flex-1 rounded-full transition md:max-w-7 ${
                activeIndex === index ? 'bg-[#FF6B1A]' : 'bg-white/15 hover:bg-white/30'
              }`}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={activeIndex === index ? 'step' : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
