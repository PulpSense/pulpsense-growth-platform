import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const argv = process.argv.slice(2);
const mode = argv.includes("--apply")
  ? "apply"
  : argv.includes("--read-back")
    ? "read-back"
    : "dry-run";
const mappingPath = argv.find((argument) => !argument.startsWith("--"));
if (!mappingPath) {
  throw new Error(
    "Usage: pnpm backfill:sales-appointments <ignored-mapping.json> [--apply|--read-back]",
  );
}

const deterministicUuid = (identity) => {
  const bytes = Buffer.from(
    createHash("sha256").update(identity).digest(),
  ).subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const input = JSON.parse(await readFile(mappingPath, "utf8"));
if (!Array.isArray(input)) throw new Error("Backfill mapping must be an array");

const requiredStrings = [
  "calBookingUid",
  "title",
  "initialConfirmedAt",
  "scheduledStartAt",
  "scheduledEndAt",
  "originatingLeadJourneyId",
  "funnelId",
  "environment",
  "personId",
  "opportunityId",
  "sourceNoteId",
  "status",
];
const seenUids = new Map();
const seenSourceNoteIds = new Map();
const rows = input.map((mapping, index) => {
  const reasons = [];
  for (const field of requiredStrings) {
    if (typeof mapping?.[field] !== "string" || !mapping[field].trim()) {
      reasons.push(`missing ${field}`);
    }
  }
  if (mapping?.isCommercial !== true)
    reasons.push("commercial classification is not proven");
  if (mapping?.isTest !== false)
    reasons.push("test classification is not explicitly false");
  if (mapping?.environment !== "production")
    reasons.push("environment is not production");
  for (const field of [
    "initialConfirmedAt",
    "scheduledStartAt",
    "scheduledEndAt",
  ]) {
    if (
      typeof mapping?.[field] === "string" &&
      !Number.isFinite(Date.parse(mapping[field]))
    ) {
      reasons.push(`${field} is not a valid timestamp`);
    }
  }
  if (
    Number.isFinite(Date.parse(mapping?.scheduledStartAt)) &&
    Number.isFinite(Date.parse(mapping?.scheduledEndAt)) &&
    Date.parse(mapping.scheduledEndAt) <= Date.parse(mapping.scheduledStartAt)
  ) {
    reasons.push("scheduled end must be after scheduled start");
  }
  if (
    typeof mapping?.originatingLeadJourneyId === "string" &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      mapping.originatingLeadJourneyId,
    )
  ) {
    reasons.push("originating Lead Journey ID is not a UUID");
  }
  if (
    mapping?.prospectId !== undefined &&
    !/^prospect_v1_[0-9a-f]{64}$/u.test(mapping.prospectId)
  ) {
    reasons.push("Prospect ID is invalid");
  }
  if (
    !["SCHEDULED", "NO_SHOW", "COMPLETED", "CANCELLED"].includes(
      mapping?.status,
    )
  ) {
    reasons.push("status is unresolved");
  }
  const uid = mapping?.calBookingUid;
  if (typeof uid === "string" && uid) {
    const previous = seenUids.get(uid);
    if (previous !== undefined) {
      reasons.push(`duplicate Cal UID also appears at row ${previous + 1}`);
    } else {
      seenUids.set(uid, index);
    }
  }
  const sourceNoteId = mapping?.sourceNoteId;
  if (typeof sourceNoteId === "string" && sourceNoteId) {
    const previous = seenSourceNoteIds.get(sourceNoteId);
    if (previous !== undefined) {
      reasons.push(
        `duplicate source Note ID also appears at row ${previous + 1}`,
      );
    } else {
      seenSourceNoteIds.set(sourceNoteId, index);
    }
  }
  const salesAppointmentId =
    typeof uid === "string"
      ? deterministicUuid(`sales-appointment:${uid}`)
      : undefined;
  const bookingVersionId =
    typeof uid === "string"
      ? deterministicUuid(`booking-version:${uid}`)
      : undefined;
  return {
    row: index + 1,
    mapping,
    salesAppointmentId,
    bookingVersionId,
    classification: reasons.length ? "ambiguous" : "ready",
    reasons,
  };
});

const markFirstDuplicate = (seen, field, label) => {
  for (const [value, firstIndex] of seen) {
    const duplicateIndexes = rows
      .filter((row) => row.mapping?.[field] === value)
      .map((row) => row.row - 1);
    if (duplicateIndexes.length <= 1) continue;
    const first = rows[firstIndex];
    if (first.reasons.some((reason) => reason.startsWith(`duplicate ${label}`)))
      continue;
    first.reasons.push(
      `duplicate ${label} also appears at row ${duplicateIndexes[1] + 1}`,
    );
    first.classification = "ambiguous";
  }
};

markFirstDuplicate(seenUids, "calBookingUid", "Cal UID");
markFirstDuplicate(seenSourceNoteIds, "sourceNoteId", "source Note ID");

const report = {
  mode,
  mutations: mode === "apply",
  ready: rows
    .filter((row) => row.classification === "ready")
    .map((row) => ({
      row: row.row,
      calBookingUid: row.mapping.calBookingUid,
      sourceNoteId: row.mapping.sourceNoteId,
      salesAppointmentId: row.salesAppointmentId,
      bookingVersionId: row.bookingVersionId,
    })),
  ambiguous: rows
    .filter((row) => row.classification === "ambiguous")
    .map((row) => ({
      row: row.row,
      calBookingUid: row.mapping?.calBookingUid,
      reasons: row.reasons,
    })),
};

if (mode === "dry-run") {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}
if (report.ambiguous.length) {
  console.log(JSON.stringify(report, null, 2));
  throw new Error("Backfill contains ambiguous rows; apply/read-back refused");
}

const proposedRecords = (row) => {
  const mapping = row.mapping;
  return {
    appointment: {
      id: row.salesAppointmentId,
      name: mapping.title,
      rootCalBookingUid: mapping.calBookingUid,
      currentCalBookingUid: mapping.calBookingUid,
      currentBookingVersionId: row.bookingVersionId,
      initialConfirmedAt: mapping.initialConfirmedAt,
      scheduledStartAt: mapping.scheduledStartAt,
      scheduledEndAt: mapping.scheduledEndAt,
      originatingLeadJourneyId: mapping.originatingLeadJourneyId,
      funnelId: mapping.funnelId,
      environment: mapping.environment,
      classification: "PRODUCTION_COMMERCIAL",
      isCommercial: true,
      isTest: false,
      status: mapping.status,
      personId: mapping.personId,
      opportunityId: mapping.opportunityId,
      prospectId: mapping.prospectId,
    },
    version: {
      id: row.bookingVersionId,
      name: mapping.calBookingUid,
      calBookingUid: mapping.calBookingUid,
      salesAppointmentId: row.salesAppointmentId,
      scheduledStartAt: mapping.scheduledStartAt,
      scheduledEndAt: mapping.scheduledEndAt,
      lifecycleOccurredAt: mapping.initialConfirmedAt,
      state: mapping.status === "CANCELLED" ? "CANCELLED" : "ACTIVE",
      previousBookingVersionId: undefined,
      replacementBookingVersionId: undefined,
    },
  };
};

const normalizedOptional = (value) => value ?? null;

const differences = (expected, actual, prefix, ignoredFields = []) =>
  Object.entries(expected)
    .filter(([field]) => !ignoredFields.includes(field))
    .filter(
      ([field, value]) =>
        normalizedOptional(actual?.[field]) !== normalizedOptional(value),
    )
    .map(([field, value]) => ({
      field: `${prefix}.${field}`,
      expected: normalizedOptional(value),
      actual: normalizedOptional(actual?.[field]),
    }));

const unwrapRecord = (result, field) => result?.data?.[field] ?? result;

const origin = process.env.TWENTY_API_ORIGIN?.replace(/\/+$/u, "");
const apiKey = process.env.TWENTY_API_KEY;
if (!origin || !apiKey)
  throw new Error("TWENTY_API_ORIGIN and TWENTY_API_KEY are required");
const request = async (path, init, { allowNotFound = false } = {}) => {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    if (allowNotFound && response.status === 404) return undefined;
    const body = await response.text();
    throw new Error(
      `Twenty backfill request failed (${response.status})${body ? `: ${body}` : ""}`,
    );
  }
  return response.status === 204 ? {} : response.json();
};

const findLiveUidRecords = async (uid) => {
  const result = await request("/graphql", {
    method: "POST",
    body: JSON.stringify({
      query: `
        query BackfillSalesAppointmentConflicts($uid: String!) {
          salesAppointments(
            first: 2
            filter: { rootCalBookingUid: { eq: $uid } }
          ) {
            edges { node {
              id name rootCalBookingUid currentCalBookingUid
              currentBookingVersionId initialConfirmedAt scheduledStartAt
              scheduledEndAt originatingLeadJourneyId funnelId environment
              classification isCommercial isTest status personId opportunityId
              prospectId
            } }
          }
          bookingVersions(
            first: 2
            filter: { calBookingUid: { eq: $uid } }
          ) {
            edges { node {
              id name calBookingUid salesAppointmentId scheduledStartAt
              scheduledEndAt lifecycleOccurredAt state
              previousBookingVersionId replacementBookingVersionId
            } }
          }
        }
      `,
      variables: { uid },
    }),
  });
  if (result.errors?.length) {
    throw new Error("Twenty backfill conflict query returned GraphQL errors");
  }
  return {
    appointments:
      result.data?.salesAppointments?.edges?.flatMap((edge) =>
        edge?.node ? [edge.node] : [],
      ) ?? [],
    versions:
      result.data?.bookingVersions?.edges?.flatMap((edge) =>
        edge?.node ? [edge.node] : [],
      ) ?? [],
  };
};

if (mode === "apply") {
  const preflight = [];
  const liveAmbiguous = [];
  for (const row of rows) {
    const proposed = proposedRecords(row);
    const [appointmentByIdResult, versionByIdResult, byUid] = await Promise.all(
      [
        request(
          `/rest/salesAppointments/${encodeURIComponent(row.salesAppointmentId)}`,
          undefined,
          { allowNotFound: true },
        ),
        request(
          `/rest/bookingVersions/${encodeURIComponent(row.bookingVersionId)}`,
          undefined,
          { allowNotFound: true },
        ),
        findLiveUidRecords(row.mapping.calBookingUid),
      ],
    );
    const appointmentById = appointmentByIdResult
      ? unwrapRecord(appointmentByIdResult, "salesAppointment")
      : undefined;
    const versionById = versionByIdResult
      ? unwrapRecord(versionByIdResult, "bookingVersion")
      : undefined;
    const appointments = new Map(
      [
        ...byUid.appointments,
        ...(appointmentById ? [appointmentById] : []),
      ].map((record) => [record.id, record]),
    );
    const versions = new Map(
      [...byUid.versions, ...(versionById ? [versionById] : [])].map(
        (record) => [record.id, record],
      ),
    );
    const appointment = appointments.get(row.salesAppointmentId);
    const version = versions.get(row.bookingVersionId);
    const rowDifferences = [];
    if (
      appointments.size > 1 ||
      [...appointments.keys()].some((id) => id !== row.salesAppointmentId)
    ) {
      rowDifferences.push({
        field: "salesAppointment.id",
        expected: row.salesAppointmentId,
        actual: [...appointments.keys()],
      });
    }
    if (
      versions.size > 1 ||
      [...versions.keys()].some((id) => id !== row.bookingVersionId)
    ) {
      rowDifferences.push({
        field: "bookingVersion.id",
        expected: row.bookingVersionId,
        actual: [...versions.keys()],
      });
    }
    if (appointment) {
      rowDifferences.push(
        ...differences(proposed.appointment, appointment, "salesAppointment", [
          "currentBookingVersionId",
        ]),
      );
      if (
        appointment.currentBookingVersionId &&
        appointment.currentBookingVersionId !== row.bookingVersionId
      ) {
        rowDifferences.push({
          field: "salesAppointment.currentBookingVersionId",
          expected: row.bookingVersionId,
          actual: appointment.currentBookingVersionId,
        });
      }
    }
    if (version) {
      rowDifferences.push(
        ...differences(proposed.version, version, "bookingVersion"),
      );
    }
    if (rowDifferences.length) {
      liveAmbiguous.push({ row: row.row, differences: rowDifferences });
    }
    preflight.push({ row, proposed, appointment, version });
  }
  if (liveAmbiguous.length) {
    console.log(JSON.stringify({ ...report, liveAmbiguous }, null, 2));
    throw new Error(
      "Backfill conflicts with live Twenty records; apply refused",
    );
  }

  for (const item of preflight) {
    if (!item.appointment) {
      const appointmentCreate = { ...item.proposed.appointment };
      delete appointmentCreate.currentBookingVersionId;
      await request("/rest/salesAppointments", {
        method: "POST",
        body: JSON.stringify(appointmentCreate),
      });
    }
    if (!item.version) {
      await request("/rest/bookingVersions", {
        method: "POST",
        body: JSON.stringify(item.proposed.version),
      });
    }
    if (
      item.appointment?.currentBookingVersionId !== item.row.bookingVersionId
    ) {
      await request(
        `/rest/salesAppointments/${encodeURIComponent(item.row.salesAppointmentId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            currentBookingVersionId: item.row.bookingVersionId,
          }),
        },
      );
    }
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const verified = [];
for (const row of rows) {
  const proposed = proposedRecords(row);
  const appointmentResult = await request(
    `/rest/salesAppointments/${encodeURIComponent(row.salesAppointmentId)}`,
  );
  const versionResult = await request(
    `/rest/bookingVersions/${encodeURIComponent(row.bookingVersionId)}`,
  );
  const appointment = unwrapRecord(appointmentResult, "salesAppointment");
  const version = unwrapRecord(versionResult, "bookingVersion");
  const rowDifferences = [
    ...differences(proposed.appointment, appointment, "salesAppointment"),
    ...differences(proposed.version, version, "bookingVersion"),
  ];
  verified.push({
    row: row.row,
    salesAppointmentId: row.salesAppointmentId,
    bookingVersionId: row.bookingVersionId,
    matches: rowDifferences.length === 0,
    differences: rowDifferences,
  });
}
console.log(JSON.stringify({ ...report, verified }, null, 2));
if (verified.some((row) => !row.matches)) {
  throw new Error(
    "Sales Appointment backfill read-back did not match the approved mappings",
  );
}
