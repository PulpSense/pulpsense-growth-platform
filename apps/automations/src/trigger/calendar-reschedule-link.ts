export type RescheduleLinkReference = {
  type: string;
  eventUid: string;
  destinationCalendarId: string;
};

export type RescheduleLinkGoogleEvent = {
  id: string;
  etag: string;
  description?: string;
};

export type RefreshGoogleRescheduleLinkInput = {
  previousBookingUid: string;
  replacementBookingUid: string;
};

export type RescheduleLinkAdapters = {
  getCalBookingReferences(
    bookingUid: string,
  ): Promise<RescheduleLinkReference[]>;
  getGoogleEvent(
    calendarId: string,
    eventId: string,
  ): Promise<RescheduleLinkGoogleEvent | undefined>;
  patchGoogleEventDescription(input: {
    calendarId: string;
    eventId: string;
    etag: string;
    description: string;
  }): Promise<void>;
};

const escapeRegularExpression = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const recognizedCalUrl = /https:\/\/(?:[a-z0-9-]+\.)*cal\.com\/[^\s<>"']+/giu;

const rescheduleUidPattern = (bookingUid: string) =>
  new RegExp(
    `([?&](?:amp;)?rescheduleUid=)${escapeRegularExpression(bookingUid)}(?=(&(?:amp;)?|#|$))`,
    "gu",
  );

const countRecognizedUidLinks = (description: string, bookingUid: string) => {
  const pattern = rescheduleUidPattern(bookingUid);
  return [...description.matchAll(recognizedCalUrl)].reduce(
    (count, match) => count + [...match[0].matchAll(pattern)].length,
    0,
  );
};

export const replaceCalRescheduleUid = (
  description: string,
  previousBookingUid: string,
  replacementBookingUid: string,
) => {
  const previousMatches = countRecognizedUidLinks(
    description,
    previousBookingUid,
  );
  const replacementMatches = countRecognizedUidLinks(
    description,
    replacementBookingUid,
  );
  if (previousMatches === 0 && replacementMatches > 0) {
    return { outcome: "already_current" as const, description };
  }
  if (previousMatches !== 1) {
    throw new Error("google_reschedule_link_not_uniquely_recognized");
  }

  const pattern = rescheduleUidPattern(previousBookingUid);
  const updated = description.replace(recognizedCalUrl, (url) =>
    url.replace(
      pattern,
      (_match, prefix: string) => `${prefix}${replacementBookingUid}`,
    ),
  );
  if (
    countRecognizedUidLinks(updated, previousBookingUid) !== 0 ||
    countRecognizedUidLinks(updated, replacementBookingUid) === 0
  ) {
    throw new Error("google_reschedule_link_rewrite_failed");
  }
  return { outcome: "updated" as const, description: updated };
};

export const refreshGoogleRescheduleLink = async (
  input: RefreshGoogleRescheduleLinkInput,
  adapters: RescheduleLinkAdapters,
) => {
  const references = await adapters.getCalBookingReferences(
    input.replacementBookingUid,
  );
  const reference = references.find(
    (candidate) =>
      candidate.type === "google_calendar" &&
      candidate.eventUid &&
      candidate.destinationCalendarId,
  );
  if (!reference) throw new Error("replacement_google_reference_missing");

  const event = await adapters.getGoogleEvent(
    reference.destinationCalendarId,
    reference.eventUid,
  );
  if (!event) throw new Error("replacement_google_event_missing");
  if (!event.description) {
    throw new Error("google_event_description_missing");
  }

  const replacement = replaceCalRescheduleUid(
    event.description,
    input.previousBookingUid,
    input.replacementBookingUid,
  );
  if (replacement.outcome === "already_current") return replacement;

  await adapters.patchGoogleEventDescription({
    calendarId: reference.destinationCalendarId,
    eventId: reference.eventUid,
    etag: event.etag,
    description: replacement.description,
  });
  const readBack = await adapters.getGoogleEvent(
    reference.destinationCalendarId,
    reference.eventUid,
  );
  if (
    !readBack?.description ||
    countRecognizedUidLinks(readBack.description, input.previousBookingUid) !==
      0 ||
    countRecognizedUidLinks(
      readBack.description,
      input.replacementBookingUid,
    ) === 0
  ) {
    throw new Error("google_reschedule_link_readback_failed");
  }
  return replacement;
};
