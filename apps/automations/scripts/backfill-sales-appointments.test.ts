import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";

import { describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL("./backfill-sales-appointments.mjs", import.meta.url),
);

const validRow = {
  calBookingUid: "cal-1",
  title: "Sales call",
  initialConfirmedAt: "2026-08-20T09:00:00.000Z",
  scheduledStartAt: "2026-08-22T09:00:00.000Z",
  scheduledEndAt: "2026-08-22T09:30:00.000Z",
  originatingLeadJourneyId: "b0a10d9a-68bb-4d73-95c3-3e03560f8550",
  funnelId: "ai-seo",
  environment: "production",
  personId: "person-1",
  opportunityId: "opportunity-1",
  sourceNoteId: "note-1",
  status: "SCHEDULED",
  isCommercial: true,
  isTest: false,
};

const runDryRun = async (rows: unknown[]) => {
  const directory = await mkdtemp(
    join(tmpdir(), "sales-appointment-backfill-"),
  );
  const mapping = join(directory, "mapping.json");
  await writeFile(mapping, JSON.stringify(rows));
  return spawnSync(process.execPath, [script, mapping], { encoding: "utf8" });
};

const runAgainstServer = async (
  rows: unknown[],
  flag: "--apply" | "--read-back",
  respond: (request: { method: string; path: string }) => {
    status?: number;
    body?: unknown;
  },
) => {
  const requests: Array<{ method: string; path: string }> = [];
  const server = createServer((request, response) => {
    const observed = {
      method: request.method ?? "GET",
      path: request.url ?? "/",
    };
    requests.push(observed);
    const result = respond(observed);
    response.writeHead(result.status ?? 200, {
      "Content-Type": "application/json",
    });
    response.end(
      result.body === undefined ? "{}" : JSON.stringify(result.body),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing port");

  const directory = await mkdtemp(
    join(tmpdir(), "sales-appointment-backfill-"),
  );
  const mapping = join(directory, "mapping.json");
  await writeFile(mapping, JSON.stringify(rows));
  const child = spawn(process.execPath, [script, mapping, flag], {
    env: {
      ...process.env,
      TWENTY_API_ORIGIN: `http://127.0.0.1:${address.port}`,
      TWENTY_API_KEY: "test-key",
    },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const [status] = (await once(child, "close")) as [number];
  server.close();
  await once(server, "close");
  return { status, stdout, stderr, requests };
};

describe("Sales Appointment backfill", () => {
  it("defaults to a non-mutating dry-run with deterministic identities", async () => {
    const result = await runDryRun([validRow]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      mode: "dry-run",
      mutations: false,
      ambiguous: [],
      ready: [
        {
          row: 1,
          calBookingUid: "cal-1",
          sourceNoteId: "note-1",
          salesAppointmentId: "d2f8156a-0111-5370-a2a9-026bc4c58893",
          bookingVersionId: "6b258d28-1f9d-510a-8780-ce69193b5059",
        },
      ],
    });
  });

  it("reports duplicates and unresolved classification without guessing", async () => {
    const result = await runDryRun([
      validRow,
      { ...validRow, sourceNoteId: "note-2" },
      {
        ...validRow,
        calBookingUid: "cal-3",
        status: "UNKNOWN",
        isTest: undefined,
      },
    ]);
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.ready).toEqual([]);
    expect(report.ambiguous).toHaveLength(3);
    expect(report.ambiguous[0].reasons).toContain(
      "duplicate Cal UID also appears at row 2",
    );
    expect(report.ambiguous[2].reasons).toEqual(
      expect.arrayContaining([
        "test classification is not explicitly false",
        "status is unresolved",
      ]),
    );
  });

  it("marks every row sharing one source Note as ambiguous", async () => {
    const result = await runDryRun([
      validRow,
      { ...validRow, calBookingUid: "cal-2" },
    ]);
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.ready).toEqual([]);
    expect(report.ambiguous).toHaveLength(2);
    expect(report.ambiguous[0].reasons).toContain(
      "duplicate source Note ID also appears at row 2",
    );
    expect(report.ambiguous[1].reasons).toContain(
      "duplicate source Note ID also appears at row 1",
    );
  });

  it("refuses a live Cal UID conflict before issuing any REST mutation", async () => {
    const result = await runAgainstServer([validRow], "--apply", (request) => {
      if (request.method === "GET") return { status: 404 };
      if (request.path === "/graphql") {
        return {
          body: {
            data: {
              salesAppointments: { edges: [] },
              bookingVersions: {
                edges: [
                  {
                    node: {
                      id: "different-live-id",
                      calBookingUid: validRow.calBookingUid,
                    },
                  },
                ],
              },
            },
          },
        };
      }
      return { status: 500 };
    });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      liveAmbiguous: [
        {
          row: 1,
          differences: [
            expect.objectContaining({ field: "bookingVersion.id" }),
          ],
        },
      ],
    });
    expect(result.requests).toHaveLength(3);
    expect(result.requests).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/rest/salesAppointments" }),
      ]),
    );
  });

  it("refuses a proposed BookingVersion ID collision before any mutation", async () => {
    const dryRun = JSON.parse((await runDryRun([validRow])).stdout);
    const ids = dryRun.ready[0];
    const result = await runAgainstServer([validRow], "--apply", (request) => {
      if (request.path.startsWith("/rest/salesAppointments/")) {
        return { status: 404 };
      }
      if (request.path.startsWith("/rest/bookingVersions/")) {
        return {
          body: {
            id: ids.bookingVersionId,
            name: "other-cal-uid",
            calBookingUid: "other-cal-uid",
            salesAppointmentId: "other-appointment",
            scheduledStartAt: validRow.scheduledStartAt,
            scheduledEndAt: validRow.scheduledEndAt,
            lifecycleOccurredAt: validRow.initialConfirmedAt,
            state: "ACTIVE",
          },
        };
      }
      if (request.path === "/graphql") {
        return {
          body: {
            data: {
              salesAppointments: { edges: [] },
              bookingVersions: { edges: [] },
            },
          },
        };
      }
      return { status: 500 };
    });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      liveAmbiguous: [
        {
          row: 1,
          differences: expect.arrayContaining([
            expect.objectContaining({ field: "bookingVersion.calBookingUid" }),
          ]),
        },
      ],
    });
    expect(result.requests).toHaveLength(3);
    expect(result.requests).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/rest/salesAppointments" }),
      ]),
    );
  });

  it("refuses unexpected optional Prospect and lineage fields before mutation", async () => {
    const dryRun = JSON.parse((await runDryRun([validRow])).stdout);
    const ids = dryRun.ready[0];
    const result = await runAgainstServer([validRow], "--apply", (request) => {
      if (request.path.startsWith("/rest/salesAppointments/")) {
        return {
          body: {
            id: ids.salesAppointmentId,
            name: validRow.title,
            rootCalBookingUid: validRow.calBookingUid,
            currentCalBookingUid: validRow.calBookingUid,
            currentBookingVersionId: ids.bookingVersionId,
            initialConfirmedAt: validRow.initialConfirmedAt,
            scheduledStartAt: validRow.scheduledStartAt,
            scheduledEndAt: validRow.scheduledEndAt,
            originatingLeadJourneyId: validRow.originatingLeadJourneyId,
            funnelId: validRow.funnelId,
            environment: validRow.environment,
            classification: "PRODUCTION_COMMERCIAL",
            isCommercial: true,
            isTest: false,
            status: validRow.status,
            personId: validRow.personId,
            opportunityId: validRow.opportunityId,
            prospectId: "unexpected-prospect",
          },
        };
      }
      if (request.path.startsWith("/rest/bookingVersions/")) {
        return {
          body: {
            id: ids.bookingVersionId,
            name: validRow.calBookingUid,
            calBookingUid: validRow.calBookingUid,
            salesAppointmentId: ids.salesAppointmentId,
            scheduledStartAt: validRow.scheduledStartAt,
            scheduledEndAt: validRow.scheduledEndAt,
            lifecycleOccurredAt: validRow.initialConfirmedAt,
            state: "ACTIVE",
            previousBookingVersionId: "unexpected-previous",
            replacementBookingVersionId: "unexpected-replacement",
          },
        };
      }
      if (request.path === "/graphql") {
        return {
          body: {
            data: {
              salesAppointments: { edges: [] },
              bookingVersions: { edges: [] },
            },
          },
        };
      }
      return { status: 500 };
    });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).liveAmbiguous[0].differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "salesAppointment.prospectId" }),
        expect.objectContaining({
          field: "bookingVersion.previousBookingVersionId",
        }),
        expect.objectContaining({
          field: "bookingVersion.replacementBookingVersionId",
        }),
      ]),
    );
    expect(result.requests).toHaveLength(3);
  });

  it("reports field-level read-back differences for every proposed field", async () => {
    const dryRun = JSON.parse((await runDryRun([validRow])).stdout);
    const ids = dryRun.ready[0];
    const result = await runAgainstServer(
      [validRow],
      "--read-back",
      (request) => {
        if (request.path.startsWith("/rest/salesAppointments/")) {
          return {
            body: {
              id: ids.salesAppointmentId,
              name: validRow.title,
              rootCalBookingUid: validRow.calBookingUid,
              currentCalBookingUid: validRow.calBookingUid,
              currentBookingVersionId: ids.bookingVersionId,
              initialConfirmedAt: validRow.initialConfirmedAt,
              scheduledStartAt: validRow.scheduledStartAt,
              scheduledEndAt: validRow.scheduledEndAt,
              originatingLeadJourneyId: validRow.originatingLeadJourneyId,
              funnelId: validRow.funnelId,
              environment: validRow.environment,
              classification: "PRODUCTION_COMMERCIAL",
              isCommercial: true,
              isTest: false,
              status: "COMPLETED",
              personId: validRow.personId,
              opportunityId: validRow.opportunityId,
              prospectId: "unexpected-prospect",
            },
          };
        }
        return {
          body: {
            id: ids.bookingVersionId,
            name: validRow.calBookingUid,
            calBookingUid: validRow.calBookingUid,
            salesAppointmentId: ids.salesAppointmentId,
            scheduledStartAt: validRow.scheduledStartAt,
            scheduledEndAt: validRow.scheduledEndAt,
            lifecycleOccurredAt: validRow.initialConfirmedAt,
            state: "ACTIVE",
            previousBookingVersionId: "unexpected-previous",
            replacementBookingVersionId: "unexpected-replacement",
          },
        };
      },
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).verified[0]).toMatchObject({
      matches: false,
      differences: expect.arrayContaining([
        {
          field: "salesAppointment.status",
          expected: "SCHEDULED",
          actual: "COMPLETED",
        },
        expect.objectContaining({ field: "salesAppointment.prospectId" }),
        expect.objectContaining({
          field: "bookingVersion.previousBookingVersionId",
        }),
        expect.objectContaining({
          field: "bookingVersion.replacementBookingVersionId",
        }),
      ]),
    });
  });
});
