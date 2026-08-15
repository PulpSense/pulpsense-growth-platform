export type AttributionTouch = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  ttclid?: string;
  liFatId?: string;
  landingPage?: string;
  referrer?: string;
};

export type FunnelAttribution = {
  firstTouch: AttributionTouch;
  lastTouch: AttributionTouch;
};

type AttributionStorage = Pick<Storage, "getItem" | "setItem">;

type CaptureFunnelAttributionInput = {
  funnelId: string;
  href: string;
  referrer: string;
  storage: AttributionStorage;
};

const campaignParameters = {
  utm_source: ["utmSource", 200],
  utm_medium: ["utmMedium", 200],
  utm_campaign: ["utmCampaign", 200],
  utm_content: ["utmContent", 200],
  utm_term: ["utmTerm", 200],
  gclid: ["gclid", 500],
  fbclid: ["fbclid", 500],
  msclkid: ["msclkid", 500],
  ttclid: ["ttclid", 500],
  li_fat_id: ["liFatId", 500],
} as const;

const safePageUrl = (value: string) => {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return undefined;
    }
    url.search = "";
    url.hash = "";
    const normalized = url.toString();
    return normalized.length <= 2048 ? normalized : undefined;
  } catch {
    return undefined;
  }
};

const touchFrom = (href: string, referrer: string): AttributionTouch => {
  const url = new URL(href);
  const touch: AttributionTouch = {};

  for (const [parameter, [property, maxLength]] of Object.entries(
    campaignParameters,
  )) {
    const value = url.searchParams.get(parameter)?.trim();
    if (value) touch[property] = value.slice(0, maxLength);
  }

  const landingPage = safePageUrl(href);
  const safeReferrer = safePageUrl(referrer);
  if (landingPage) touch.landingPage = landingPage;
  if (safeReferrer) touch.referrer = safeReferrer;

  return touch;
};

const readStoredTouch = (
  storage: AttributionStorage,
  key: string,
): AttributionTouch | undefined => {
  const stored = storage.getItem(key);
  if (!stored) return undefined;

  const parsed = JSON.parse(stored) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }

  const touch: AttributionTouch = {};
  for (const [property, value] of Object.entries(parsed)) {
    if (
      typeof value === "string" &&
      Object.values(campaignParameters).some(([key]) => key === property)
    ) {
      touch[property as keyof AttributionTouch] = value;
    }
  }

  const storedTouch = parsed as Record<string, unknown>;
  const landingPage =
    typeof storedTouch.landingPage === "string"
      ? safePageUrl(storedTouch.landingPage)
      : undefined;
  const referrer =
    typeof storedTouch.referrer === "string"
      ? safePageUrl(storedTouch.referrer)
      : undefined;
  if (landingPage) touch.landingPage = landingPage;
  if (referrer) touch.referrer = referrer;

  return touch;
};

export function captureFunnelAttribution({
  funnelId,
  href,
  referrer,
  storage,
}: CaptureFunnelAttributionInput): {
  attribution: FunnelAttribution;
} {
  const touch = touchFrom(href, referrer);
  const firstTouchKey = `pulpsense:first-touch:${funnelId}`;
  let firstTouch = touch;

  try {
    const storedFirstTouch = readStoredTouch(storage, firstTouchKey);
    if (storedFirstTouch) {
      firstTouch = storedFirstTouch;
    } else {
      storage.setItem(firstTouchKey, JSON.stringify(touch));
    }
  } catch {
    // Attribution is best effort and must never interrupt the funnel.
  }

  return {
    attribution: { firstTouch, lastTouch: touch },
  };
}
