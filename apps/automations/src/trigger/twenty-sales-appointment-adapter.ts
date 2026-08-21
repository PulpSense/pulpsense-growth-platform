import type {
  BookingVersionRecord,
  SalesAppointmentLedgerAdapter,
  SalesAppointmentRecord,
} from "./sales-appointment-ledger.js";

export type TwentySalesAppointmentClient = {
  fetch: typeof fetch;
  origin: string;
  apiKey: string;
};

const headers = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
});

const unwrap = <T>(result: unknown, key: string): T | undefined => {
  const data = (result as { data?: Record<string, unknown> })?.data;
  return (data?.[key] ?? result) as T | undefined;
};

const request = async (
  client: TwentySalesAppointmentClient,
  path: string,
  init?: RequestInit,
  allowNotFound = false,
) => {
  const response = await client.fetch(`${client.origin}${path}`, {
    ...init,
    headers: { ...headers(client.apiKey), ...init?.headers },
  });
  if (!response.ok) {
    if (allowNotFound && response.status === 404) return undefined;
    const body = response.status === 400 ? await response.text() : "";
    const duplicate =
      response.status === 409 ||
      (response.status === 400 &&
        body.toLowerCase().includes("duplicate entry"));
    if (duplicate) return { duplicate: true } as const;
    throw new Error(
      `Twenty Sales Appointment ledger request failed (${response.status})`,
    );
  }
  return response.status === 204 ? {} : response.json();
};

export const createTwentySalesAppointmentAdapter = (
  client: TwentySalesAppointmentClient,
): SalesAppointmentLedgerAdapter => ({
  async findBookingVersion(calBookingUid) {
    const result = await request(client, "/graphql", {
      method: "POST",
      body: JSON.stringify({
        query: `query FindBookingVersion($uid: String!) {
          bookingVersions(filter: { calBookingUid: { eq: $uid } } first: 2) {
            edges { node { id calBookingUid salesAppointmentId state } }
          }
        }`,
        variables: { uid: calBookingUid },
      }),
    });
    const edges = result as {
      data?: {
        bookingVersions?: { edges?: Array<{ node?: BookingVersionRecord }> };
      };
      errors?: unknown[];
    };
    if (edges.errors?.length)
      throw new Error("Twenty BookingVersion lookup failed");
    const matches =
      edges.data?.bookingVersions?.edges?.flatMap(({ node }) =>
        node ? [node] : [],
      ) ?? [];
    if (matches.length > 1)
      throw new Error("Cal UID is duplicated across BookingVersions");
    return matches[0];
  },
  async getSalesAppointment(id) {
    const result = await request(
      client,
      `/rest/salesAppointments/${encodeURIComponent(id)}`,
      undefined,
      true,
    );
    if (!result || (result as { duplicate?: boolean }).duplicate)
      return undefined;
    return unwrap<SalesAppointmentRecord>(result, "salesAppointment");
  },
  async createSalesAppointment(input) {
    await request(client, "/rest/salesAppointments", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async updateSalesAppointment(id, input) {
    await request(client, `/rest/salesAppointments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  async createBookingVersion(input) {
    await request(client, "/rest/bookingVersions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  async updateBookingVersion(id, input) {
    await request(client, `/rest/bookingVersions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
});
