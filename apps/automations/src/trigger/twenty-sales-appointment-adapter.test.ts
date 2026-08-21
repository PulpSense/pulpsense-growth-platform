import { describe, expect, it, vi } from "vitest";

import { createTwentySalesAppointmentAdapter } from "./twenty-sales-appointment-adapter.js";

const client = (fetcher: typeof fetch) => ({
  fetch: fetcher,
  origin: "https://twenty.test",
  apiKey: "secret",
});

describe("Twenty Sales Appointment adapter", () => {
  it("paginates the canonical records used by the five-minute selector", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: {
            salesAppointments: {
              edges: [{ node: { id: "appointment-1" } }],
              pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            salesAppointments: {
              edges: [{ node: { id: "appointment-2" } }],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        }),
      );
    await expect(
      createTwentySalesAppointmentAdapter(
        client(fetcher),
      ).listSalesAppointments(),
    ).resolves.toEqual([{ id: "appointment-1" }, { id: "appointment-2" }]);
    expect(
      JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)).variables,
    ).toEqual({ after: "cursor-1" });
  });

  it("resolves a Cal UID through the generated custom-object GraphQL API", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: {
          bookingVersions: {
            edges: [
              {
                node: {
                  id: "version-1",
                  calBookingUid: "cal-1",
                  salesAppointmentId: "appointment-1",
                  state: "ACTIVE",
                },
              },
            ],
          },
        },
      }),
    );
    await expect(
      createTwentySalesAppointmentAdapter(client(fetcher)).findBookingVersion(
        "cal-1",
      ),
    ).resolves.toMatchObject({
      id: "version-1",
      salesAppointmentId: "appointment-1",
    });
    const request = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(request.variables).toEqual({ uid: "cal-1" });
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      "https://twenty.test/graphql",
    );
  });

  it("fails closed if the workspace violates Cal UID uniqueness", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: {
          bookingVersions: {
            edges: [{ node: { id: "one" } }, { node: { id: "two" } }],
          },
        },
      }),
    );
    await expect(
      createTwentySalesAppointmentAdapter(client(fetcher)).findBookingVersion(
        "cal-1",
      ),
    ).rejects.toThrow("duplicated across BookingVersions");
  });

  it("treats a missing deterministic appointment as absent", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 404 }));
    await expect(
      createTwentySalesAppointmentAdapter(client(fetcher)).getSalesAppointment(
        "appointment-1",
      ),
    ).resolves.toBeUndefined();
  });
});
