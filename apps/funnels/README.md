# PulpSense Funnels

A Next.js 16 funnel app. Creative Multiplier Sprint is the current live funnel, and future funnels can reuse the shared funnel primitives without inheriting offer-specific styling.

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **Tailwind CSS v4** (PostCSS)
- **TypeScript**
- **pnpm**

## Getting Started

From the monorepo root:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000/creative-multiplier-sprint](http://localhost:3000/creative-multiplier-sprint) to view the live funnel.

## Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `pnpm dev`         | Start dev server with Turbopack      |
| `pnpm build`       | Production build                     |
| `pnpm start`       | Run production build locally         |
| `pnpm lint`        | Run ESLint                           |
| `pnpm format`      | Fix lint + format JSON/YAML          |
| `pnpm check-types` | TypeScript type checking             |
| `pnpm build-prod`  | Clean + production build             |

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                 # Root layout
│   └── creative-multiplier-sprint/ # Current live funnel
│       ├── content.ts             # Typed copy/config for the funnel
│       ├── page.tsx               # Lander route entry
│       ├── _components/           # Funnel-specific sections and CSS Modules
│       ├── thank-you/page.tsx     # Qualified thank-you page
│       └── thank-you-u/page.tsx   # Unqualified thank-you page
├── components/
│   ├── funnel/                    # Future-funnel primitives
│   ├── sections/                  # Legacy/shared page sections
│   └── ui/                        # Reusable UI primitives
└── utils/
    └── AppConfig.ts               # Global site config

public/
└── assets/                        # Shared assets
```

## Adding a New Funnel

1. Create a folder in `src/app/[your-funnel-name]/`
2. Add a typed `content.ts` file for copy, media, form config, and section data
3. Compose `page.tsx` from reusable primitives in `src/components/funnel`
4. Keep offer-specific visual sections and CSS Modules in `src/app/[your-funnel-name]/_components`
5. Add `thank-you/page.tsx` and `thank-you-u/page.tsx` only when the funnel needs those outcomes
6. Put shared media in `public/assets`; create a funnel-specific public folder only when assets are truly unique to that funnel

Future funnels should reuse `src/components/funnel` for page shells, sections, CTAs, checklists, logo marquees, video grids, and legal footers. Keep one-off offer styling out of shared primitives.

## Trigger.dev Events

Form lifecycle events are sent from the server route `src/app/api/form-submit/route.ts` to Trigger.dev tasks. The browser posts to `/api/form-submit`; the server route calls Trigger's task interface with `PULPSENSE_TRIGGER_SECRET_KEY`.

Current Creative Multiplier Sprint events:

| Funnel event | Task ID env var | Default task ID |
|---|---|---|
| `contact_submitted` | `CREATIVE_MULTIPLIER_SPRINT_CONTACT_TASK_ID` | `funnels.contact-submitted` |
| `application_submitted` | `CREATIVE_MULTIPLIER_SPRINT_APPLICATION_TASK_ID` | `funnels.application-submitted` |
| `booking_completed` | `CREATIVE_MULTIPLIER_SPRINT_BOOKING_TASK_ID` | `funnels.booking-completed` |

The Trigger payload is:

```ts
{
  event: 'contact_submitted' | 'application_submitted' | 'booking_completed';
  funnelId: string;
  data: Record<string, unknown>;
  submittedAt: string;
}
```

If the Trigger secret or task ID is not configured, local/dev submissions are skipped without blocking the user.

## Deployment

This transitional Next.js application has no active deployment target in the checkpoint. Its routes and behavior are the baseline for the separate Astro and Cloudflare Pages migration.

## License

ISC
