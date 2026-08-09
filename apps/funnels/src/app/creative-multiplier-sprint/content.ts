import type { MultiStepFormConfig } from '@/components/ui/MultiStepForm';

export const cta = {
  href: '#apply',
  text: 'Apply now',
};

export const secondaryCta = {
  href: '#proof',
  text: 'Watch examples',
};

export const formConfig: MultiStepFormConfig = {
  funnelId: 'creative-multiplier-sprint',
  qualifiedRedirect: '/creative-multiplier-sprint/thank-you',
  unqualifiedRedirect: '/creative-multiplier-sprint/unqualified',
  qualificationRules: [
    { field: 'paidSocialSpend', disqualifyValues: ['Less than $20k/month'] },
    { field: 'winnerStatus', disqualifyValues: ['No proven winner yet'] },
  ],
  steps: [
    {
      type: 'contact',
      fields: [
        {
          name: 'firstName',
          label: 'First name',
          inputType: 'text',
          placeholder: 'Maya',
          required: true,
        },
        {
          name: 'lastName',
          label: 'Last name',
          inputType: 'text',
          placeholder: 'Chen',
          required: true,
        },
        {
          name: 'email',
          label: 'Business email',
          inputType: 'email',
          placeholder: 'maya@brand.com',
          required: true,
        },
        {
          name: 'phone',
          label: 'Phone number',
          inputType: 'phone',
          required: true,
        },
      ],
    },
    {
      type: 'qualify',
      fields: [
        {
          name: 'brandUrl',
          label: 'Brand URL',
          inputType: 'url',
          placeholder: 'https://yourbrand.com',
          required: true,
        },
        {
          name: 'paidSocialSpend',
          label: 'Current monthly paid social spend',
          inputType: 'select',
          required: true,
          options: [
            'Less than $20k/month',
            '$20k - $50k/month',
            '$50k - $150k/month',
            '$150k+/month',
          ],
        },
        {
          name: 'winnerStatus',
          label: 'Do you have a proven winning ad to multiply?',
          inputType: 'select',
          required: true,
          options: [
            'Yes, one clear winner',
            'Yes, several winners',
            'Promising ad, not fully proven',
            'No proven winner yet',
          ],
        },
        {
          name: 'platforms',
          label: 'Where do you want to test the variants?',
          inputType: 'multi-select',
          required: true,
          options: ['Meta', 'TikTok', 'Reels', 'Shorts', 'TikTok Shop', 'Other paid social'],
        },
        {
          name: 'deliveryTimeline',
          label: 'How soon do you need fresh variants?',
          inputType: 'select',
          required: true,
          options: ['This week', 'Next 2 weeks', 'This month', 'Just researching'],
        },
      ],
    },
    {
      type: 'cal',
      calLink: 'santileoni/growth-mapping-funnel',
      namespace: 'growth-mapping-funnel',
      title: 'Pick a time for your Creative Multiplier Sprint call.',
      subtitle:
        "In 15 minutes we'll review fit, look at your winning ad, and map what the 10 avatar variations should preserve. No full brief needed before booking.",
    },
  ],
};

export const creativeMultiplierContent = {
  banner: 'Founder-led sprint capacity is limited. Price discussed on the fit call.',
  hero: {
    pill: 'For ecommerce brands with proven paid-social winners',
    headline: 'Turn one winning paid-social ad into 10 avatar videos in 2 business days.',
    subheadline:
      'Bring the winning ad. We handle the teardown, avatar map, production, QA, and delivery.',
    proofCaption: 'One winning concept -> multiple launch-ready avatar variations',
  },
  proofStats: [
    { value: '1', label: 'winning ad deconstructed' },
    { value: '10', label: 'avatar variations delivered' },
    { value: '2 days', label: 'business-day turnaround' },
  ],
  heroFrames: [
    {
      eyebrow: 'Original winner',
      title: 'Founder-style UGC',
      avatar: '/assets/images/avatars/avatar-1.avif',
      tag: 'Input',
    },
    {
      eyebrow: 'Variant 04',
      title: 'Creator testimonial',
      avatar: '/assets/images/avatars/avatar-4.avif',
      tag: 'New face',
    },
    {
      eyebrow: 'Variant 09',
      title: 'Expert explainer',
      avatar: '/assets/images/avatars/avatar-7.avif',
      tag: 'New delivery',
    },
  ],
  proof: {
    label: 'Proof gallery',
    title: 'The page sells through the grid: original ad to avatar variants.',
    subtitle:
      'Use this section for real demo assets as soon as they are ready. For now, the layout is built to showcase original inputs, generated avatar stills, timelines, and launch notes.',
    cases: [
      {
        title: 'Beauty DTC winner',
        input: 'One high-performing founder testimonial',
        output: '10 avatar-led testimonials with the same offer, claim, CTA, and pacing',
        timeline: 'Delivered in 2 business days',
        note: 'What changed: face, tone, delivery style. What stayed: the winning sales argument.',
        avatars: [
          '/assets/images/avatars/avatar-1.avif',
          '/assets/images/avatars/avatar-2.avif',
          '/assets/images/avatars/avatar-3.avif',
          '/assets/images/avatars/avatar-4.avif',
        ],
      },
      {
        title: 'Health product explainer',
        input: 'One problem-solution ad carrying the account',
        output: '10 persona variations for different audience segments',
        timeline: 'Delivered in 2 business days',
        note: 'Built for controlled avatar testing, not random new concept guessing.',
        avatars: [
          '/assets/images/avatars/avatar-5.avif',
          '/assets/images/avatars/avatar-6.avif',
          '/assets/images/avatars/avatar-7.avif',
          '/assets/images/avatars/avatar-8.avif',
        ],
      },
      {
        title: 'Home goods offer ad',
        input: 'One direct-response UGC script with proven hook and CTA',
        output: '10 new AI UGC versions for Meta, TikTok, Reels, and Shorts',
        timeline: 'Delivered in 2 business days',
        note: 'QA checks focus on clarity, pacing, brand fit, and whether the asset is usable for paid social.',
        avatars: [
          '/assets/images/avatars/avatar-3.avif',
          '/assets/images/avatars/avatar-6.avif',
          '/assets/images/avatars/avatar-2.avif',
          '/assets/images/avatars/avatar-8.avif',
        ],
      },
    ],
    gallery: [
      { avatar: '/assets/images/avatars/avatar-1.avif', title: 'Founder POV', niche: 'Beauty' },
      { avatar: '/assets/images/avatars/avatar-2.avif', title: 'Peer testimonial', niche: 'Supplements' },
      { avatar: '/assets/images/avatars/avatar-3.avif', title: 'Problem agitator', niche: 'Apparel' },
      { avatar: '/assets/images/avatars/avatar-4.avif', title: 'Product demo', niche: 'Home goods' },
      { avatar: '/assets/images/avatars/avatar-5.avif', title: 'Expert explainer', niche: 'Health' },
      { avatar: '/assets/images/avatars/avatar-6.avif', title: 'Lifestyle creator', niche: 'Fitness' },
      { avatar: '/assets/images/avatars/avatar-7.avif', title: 'Direct response', niche: 'Beauty' },
      { avatar: '/assets/images/avatars/avatar-8.avif', title: 'Offer breakdown', niche: 'DTC' },
    ],
  },
  problem: {
    label: 'The bottleneck',
    title: 'Your best ad is working, but the same face can fatigue fast.',
    body:
      'Creators take weeks. Editors can only remix old footage so much. Random new concepts are risky when the fastest path is usually more versions of what already works.',
    costs: [
      'Winning ad fatigues before backup creatives are ready',
      'CAC creeps up while the team waits on creator production',
      'Media buyers lack fresh variants to test into more scale',
      'The brand keeps gambling on new concepts instead of multiplying a winner',
    ],
  },
  mechanism: {
    label: 'Winner Avatar Multiplier',
    title: 'We preserve the concept that won and multiply the avatar layer.',
    steps: [
      {
        title: 'Deconstruct the winning ad',
        desc: 'We identify the script structure, offer, claim, pacing, CTA, visual flow, and creator delivery style that made the original work.',
      },
      {
        title: 'Generate avatar variations',
        desc: 'We recreate the ad using different AI avatars, personas, and delivery styles while keeping the proven sales argument intact.',
      },
      {
        title: 'QA for launch readiness',
        desc: 'We review quality, clarity, pacing, brand fit, and whether the creative is usable as a paid social asset.',
      },
      {
        title: 'Email the asset package',
        desc: 'You receive platform-ready video files with one revision pass included.',
      },
    ],
  },
  deliverables: {
    label: 'What you get',
    title: 'A focused sprint, not a creative retainer.',
    items: [
      'Deconstruction of one winning ad',
      '10 AI avatar creative variations',
      'Same core winning concept preserved',
      'Different avatars, personas, and delivery styles',
      'Platform-ready vertical video files',
      'Email delivery within 2 business days after assets are received',
      'One revision pass',
      'Creative satisfaction guarantee',
    ],
  },
  trust: {
    label: 'Why this is not another AI tool',
    title: 'You are buying judgment, speed, QA, and finished output.',
    body:
      'Built by PulpSense, an AI and automation agency with official n8n and Make partner experience. This is a founder-led sprint, not access to another dashboard where your team has to prompt, edit, decide, QA, and export.',
    cards: [
      'Done-for-you production, not DIY software access',
      'Starts from a proven ad, not a blank prompt',
      'Fixed scope so the sprint stays fast and focused',
      'Founder-led QA so output does not feel like amateur AI video',
    ],
  },
  fit: {
    label: 'Fit',
    title: 'Built for brands with winners, not brands guessing from scratch.',
    good: [
      'Ecommerce or DTC brand already running paid social',
      'Spending at least $20k/month on Meta, TikTok, or similar channels',
      'Has at least one proven winning ad',
      'Needs more creative variants quickly',
      'Wants finished assets, not another tool to manage',
    ],
    bad: [
      'No proven ad yet',
      'Needs full strategy from scratch',
      'Wants guaranteed ROAS',
      'Needs dozens of new concepts or scripts',
      'Is not open to QA-checked AI avatar variants',
    ],
  },
  process: {
    label: 'Process',
    title: 'From winning ad to new avatar variants by email.',
    steps: [
      'Book a short fit call',
      'Send your winning ad and brand context',
      'We deconstruct what made it work',
      'We produce 10 avatar variations',
      'You receive files in 2 business days',
      'Request one revision if needed',
    ],
  },
  guarantee: {
    label: 'Guarantee',
    title: 'Launch-ready creative or your money back.',
    body:
      'If you do not feel the final creatives are usable after one revision pass, we refund your payment. No ROAS promises. No performance claims. Just usable creative output or your money back.',
  },
  faq: {
    label: 'FAQ',
    title: 'Questions media buyers ask before the call',
    items: [
      {
        q: 'Why no price on the page?',
        a: 'Fit matters. We need to see the original ad, your brand, and whether AI avatar variants make sense before taking payment.',
      },
      {
        q: 'Will the avatars look fake?',
        a: 'Some AI videos do. That is why proof is the main asset and why every sprint includes launch-readiness QA plus one revision pass.',
      },
      {
        q: 'Are you changing my winning ad?',
        a: 'No. The point is to preserve the core concept and multiply the avatar and persona layer.',
      },
      {
        q: 'Do you guarantee performance?',
        a: 'No. Performance depends on media buying, offer, account history, audience, and budget. We guarantee usable creative output, not ROAS.',
      },
      {
        q: 'Can I use these on Meta, TikTok, Reels, or Shorts?',
        a: 'Yes, assuming your account and platform policies allow the creative. We export platform-ready vertical files.',
      },
    ],
  },
  application: {
    label: 'Apply now',
    title: 'Apply now',
    subtitle:
      'Answer a few quick questions about your paid-social spend, winning ad, platforms, and timeline. Good-fit brands get the booking step immediately.',
  },
  footer: {
    links: [
      { href: '#proof', text: 'Proof' },
      { href: '#process', text: 'Process' },
      { href: '#apply', text: 'Apply' },
    ],
    disclaimer:
      'PulpSense does not guarantee ad performance, revenue, ROAS, CAC reduction, or platform approval. Results depend on your offer, account history, media buying, audience, and budget.',
    platform: 'Creative Multiplier Sprint is a PulpSense offer.',
  },
};

export type CreativeMultiplierContent = typeof creativeMultiplierContent;
