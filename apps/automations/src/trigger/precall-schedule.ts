export const PRECALL_SEQUENCE_VERSION = "precall-v1" as const;

const HOUR = 60 * 60_000;
const MINUTE = 60_000;
const MINIMUM_EMAILS = 4;
const MAXIMUM_EMAILS = 18;
const NORMAL_FINAL_LEAD = 2 * HOUR + 45 * MINUTE;
const SHORT_FINAL_LEAD = HOUR;
const REMINDER_BUFFER = 45 * MINUTE;

export const middleModuleDefinitions = [
  "what-we-will-inspect",
  "proof-twin-oaks",
  "measurement-and-attribution",
  "already-have-seo",
  "guarantee",
  "google-and-ai-mechanism",
  "no-ad-spend-or-shared-leads",
  "owner-time",
  "rebuild-risk",
  "proof-wesley-glen",
  "market-applicability",
  "call-quality",
  "economics",
  "multiple-locations",
  "market-exclusivity",
  "why-now",
] as const;

export type MiddleModuleId = (typeof middleModuleDefinitions)[number];
export type PrecallModuleId =
  | "confirmation"
  | MiddleModuleId
  | "final-preparation";

export type PrecallSlot = {
  moduleId: PrecallModuleId;
  sendAt: Date;
  sequenceVersion: typeof PRECALL_SEQUENCE_VERSION;
};

export type PrecallScheduleInput = {
  now: Date;
  meetingStart: Date;
  sentMask?: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const calculateEmailCount = (hoursUntilCall: number) =>
  clamp(Math.ceil(hoursUntilCall / 4), MINIMUM_EMAILS, MAXIMUM_EMAILS);

export const selectPrecallModules = (emailCount: number, sentMask = 0) => {
  const middleCount = Math.max(0, emailCount - 2);
  const middle = middleModuleDefinitions
    .filter((_, index) => (sentMask & (1 << index)) === 0)
    .slice(0, middleCount);
  return ["confirmation" as const, ...middle, "final-preparation" as const];
};

const reminderTimes = (meetingStart: number) => [
  meetingStart - 24 * HOUR,
  meetingStart - 2 * HOUR,
  meetingStart - 15 * MINUTE,
];

const isSafeFromReminder = (timestamp: number, meetingStart: number) =>
  reminderTimes(meetingStart).every(
    (reminderAt) =>
      reminderAt <= timestamp || reminderAt - timestamp >= REMINDER_BUFFER,
  );

const isSafeSpacing = (
  timestamp: number,
  previous: number | undefined,
  shortNotice: boolean,
) =>
  previous === undefined ||
  timestamp - previous >= (shortNotice ? 30 * MINUTE : HOUR);

const resolveSlot = (
  candidate: number,
  previous: number | undefined,
  finalAt: number,
  meetingStart: number,
  shortNotice: boolean,
) => {
  const candidates = [
    candidate,
    ...reminderTimes(meetingStart).flatMap((reminderAt) => [
      reminderAt - REMINDER_BUFFER,
      reminderAt + REMINDER_BUFFER,
    ]),
  ];
  return candidates.find(
    (timestamp) =>
      timestamp > (previous ?? Number.NEGATIVE_INFINITY) &&
      timestamp <= finalAt &&
      timestamp < meetingStart &&
      isSafeFromReminder(timestamp, meetingStart) &&
      isSafeSpacing(timestamp, previous, shortNotice),
  );
};

export const buildPrecallSchedule = ({
  now,
  meetingStart,
  sentMask = 0,
}: PrecallScheduleInput): PrecallSlot[] => {
  const nowMs = now.getTime();
  const meetingStartMs = meetingStart.getTime();
  const hoursUntilCall = (meetingStartMs - nowMs) / HOUR;
  if (hoursUntilCall <= 0) return [];

  const emailCount = calculateEmailCount(hoursUntilCall);
  const modules = selectPrecallModules(emailCount, sentMask);
  if (modules.length < 2) return [];

  const shortNotice = hoursUntilCall < 8;
  const finalAt = meetingStartMs -
    (shortNotice ? SHORT_FINAL_LEAD : NORMAL_FINAL_LEAD);
  const slots: PrecallSlot[] = [
    {
      moduleId: "confirmation",
      sendAt: new Date(nowMs),
      sequenceVersion: PRECALL_SEQUENCE_VERSION,
    },
  ];
  let previous = nowMs;
  const middle = modules.slice(1, -1);
  const interval = finalAt - nowMs;

  for (const [index, moduleId] of middle.entries()) {
    const ratio = shortNotice
      ? (index + 1) / (middle.length + 1) * 0.6
      : (index + 1) / (middle.length + 1);
    const candidate = nowMs + interval * ratio;
    const resolved = resolveSlot(
      candidate,
      previous,
      finalAt,
      meetingStartMs,
      shortNotice,
    );
    if (resolved === undefined) continue;
    if (resolved <= nowMs) continue;
    slots.push({
      moduleId,
      sendAt: new Date(resolved),
      sequenceVersion: PRECALL_SEQUENCE_VERSION,
    });
    previous = resolved;
  }

  const finalResolved = resolveSlot(
    finalAt,
    previous,
    finalAt,
    meetingStartMs,
    shortNotice,
  );
  if (finalResolved !== undefined && finalResolved > nowMs) {
    slots.push({
      moduleId: "final-preparation",
      sendAt: new Date(finalResolved),
      sequenceVersion: PRECALL_SEQUENCE_VERSION,
    });
  }
  return slots;
};

export const sequenceIdFor = (bookingUid: string, expectedStartTime: string) =>
  `precall:${bookingUid}:${expectedStartTime}:${PRECALL_SEQUENCE_VERSION}`;

export const middleModuleBit = (moduleId: MiddleModuleId) =>
  1 << middleModuleDefinitions.indexOf(moduleId);
