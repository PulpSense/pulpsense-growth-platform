import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

type BriefingSlide = {
  eyebrow: string;
  title: string;
  body: string;
  points?: readonly string[];
  accent?: string;
};

const briefingSlides: readonly BriefingSlide[] = [
  {
    eyebrow: "You’re booked",
    title: "Your Regional Visibility Audit is reserved",
    body: "Take two minutes to review the next steps and arrive knowing exactly what we will examine together.",
    accent: "45 new calls in 90 days. Or we work free until you get them.",
  },
  {
    eyebrow: "Step 1",
    title: "Confirm your calendar invitation",
    body: "Find the invitation in your inbox or spam folder and click “Yes.” That tells us the time is locked into your calendar.",
    points: [
      "Open the calendar invitation",
      "Click “Yes”",
      "Keep the meeting link handy",
    ],
  },
  {
    eyebrow: "If plans change",
    title: "Reschedule instead of missing the call",
    body: "Emergencies happen. Reschedule from the link in your invitation so the time can be released and you can choose another slot.",
  },
  {
    eyebrow: "What happens next",
    title: "We will diagnose the visibility gap live",
    body: "You will see where your business appears today, which competitors are recommended first, and what is most likely costing you calls.",
    points: [
      "Google Maps and organic search",
      "AI Overviews and ChatGPT",
      "Competitor authority signals",
    ],
  },
  {
    eyebrow: "How recommendations work",
    title: "Google and AI look for clear, consistent authority",
    body: "Your website is only one source. Search and AI systems cross-check maps, directories, reviews, citations, structured data, and trusted third-party references.",
  },
  {
    eyebrow: "Our process · 1",
    title: "We benchmark your market",
    body: "We audit your current position across Google Maps, organic search, AI Overviews, and ChatGPT, then identify the competitors being recommended ahead of you.",
  },
  {
    eyebrow: "Our process · 2",
    title: "We build your authority foundation",
    body: "We strengthen the business information, technical structure, regional coverage, service content, citations, profiles, and reputation signals those systems rely on.",
  },
  {
    eyebrow: "Authority ecosystem",
    title: "Every signal should tell the same story",
    body: "Consistent information makes it easier for Google and AI to understand what you do, where you operate, and why your business should be trusted.",
    points: [
      "Business profiles",
      "Website and structured data",
      "Directories and citations",
      "Reviews and third-party proof",
    ],
  },
  {
    eyebrow: "Reputation",
    title: "We make genuine customer trust easier to see",
    body: "We help build a compliant reputation system that consistently requests honest feedback and strengthens the proof surrounding your business.",
  },
  {
    eyebrow: "Our process · 3",
    title: "We expand and maintain visibility",
    body: "We strengthen weak markets and service lines, monitor movement, and keep improving your presence as the competitive landscape changes.",
  },
  {
    eyebrow: "Clear reporting",
    title: "You will know what changed and what comes next",
    body: "We establish the baseline and reporting process during onboarding, then review visibility, completed work, priorities, and call growth against that baseline.",
  },
  {
    eyebrow: "Your involvement",
    title: "We handle the implementation",
    body: "Your team provides the access and business context we need. We build and manage the system, then align with you during focused review calls.",
  },
  {
    eyebrow: "Already working with an agency?",
    title: "The audit still gives you a useful benchmark",
    body: "We can complement existing SEO work by examining AI recommendations, business profiles, citations, reputation signals, and regional authority gaps.",
  },
  {
    eyebrow: "The guarantee",
    title: "45 additional calls in 90 days",
    body: "If you do not receive the agreed result, we continue working at no management fee until you do. We will explain qualification, baseline, and measurement on the call.",
  },
  {
    eyebrow: "Come prepared",
    title: "Bring the markets and services that matter most",
    body: "Know your priority locations, highest-value services, current marketing partners, and any visibility or call-tracking questions you want us to investigate.",
  },
  {
    eyebrow: "That’s it",
    title: "We’ll see you on the call",
    body: "Confirm the invitation, keep the meeting link handy, and arrive ready to see how your business is represented across Google and AI.",
    accent: "One business per service category, per market.",
  },
] as const;

export function ThankYouDeckCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) return;
    const updateIndex = () => setActiveIndex(api.selectedScrollSnap());
    updateIndex();
    api.on("select", updateIndex);
    return () => {
      api.off("select", updateIndex);
    };
  }, [api]);

  const handleSlideTap = (event: MouseEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const tapPosition = (event.clientX - left) / width;
    api?.[tapPosition <= 0.25 ? "scrollPrev" : "scrollNext"]();
  };

  return (
    <section
      className="pr-ty-deck"
      aria-label="Regional Visibility Audit briefing"
    >
      <Carousel
        className="pr-ty-deck-carousel"
        aria-roledescription="carousel"
        opts={{ loop: false }}
        setApi={setApi}
      >
        <CarouselContent className="pr-ty-deck-content">
          {briefingSlides.map((briefingSlide, index) => (
            <CarouselItem key={briefingSlide.title} className="pr-ty-deck-item">
              <div className="pr-ty-deck-stage" onClick={handleSlideTap}>
                <span className="pr-ty-deck-count">
                  {index + 1} / {briefingSlides.length}
                </span>
                <div
                  className="pr-ty-deck-grid"
                  aria-live={index === activeIndex ? "polite" : undefined}
                >
                  <div className="pr-ty-deck-copy">
                    <p className="pr-ty-deck-eyebrow">
                      {briefingSlide.eyebrow}
                    </p>
                    <h2>{briefingSlide.title}</h2>
                    <p className="pr-ty-deck-body">{briefingSlide.body}</p>
                    {briefingSlide.points ? (
                      <ul className="pr-ty-deck-points">
                        {briefingSlide.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    ) : null}
                    {briefingSlide.accent ? (
                      <p className="pr-ty-deck-accent">
                        {briefingSlide.accent}
                      </p>
                    ) : null}
                  </div>
                  <div className="pr-ty-deck-mark" aria-hidden="true">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <small>PULPSENSE</small>
                  </div>
                </div>
                {index === 0 ? (
                  <span className="pr-ty-deck-tap-hint" aria-hidden="true">
                    <img src="/ai-seo/images/tap-mouse.svg" alt="" />
                  </span>
                ) : null}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="pr-ty-deck-arrow" />
        <CarouselNext className="pr-ty-deck-arrow" />
      </Carousel>

      <p className="pr-ty-deck-hint">Swipe or tap to continue</p>
    </section>
  );
}
