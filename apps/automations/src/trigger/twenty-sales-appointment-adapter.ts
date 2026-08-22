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

export type TwentySalesAppointmentCalendarAdapter =
  SalesAppointmentLedgerAdapter & {
    listSalesAppointments(): Promise<SalesAppointmentRecord[]>;
    getPersonDisplayName(personId: string): Promise<string | undefined>;
  };

const headers = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
});

const unwrap = <T>(result: unknown, key: string): T | undefined => {
  const data = (result as { data?: Record<string, unknown> })?.data;
  const root = result as Record<string, unknown> | undefined;
  return (data?.[key] ?? root?.[key] ?? result) as T | undefined;
};

const parseSalesAppointmentRecord = (value: unknown) => {
  if (!value || typeof value !== "object") {
    throw new Error("Twenty Sales Appointment response is invalid");
  }
  const record = value as Partial<SalesAppointmentRecord>;
  if (typeof record.id !== "string" || !record.id.trim()) {
    throw new Error("Twenty Sales Appointment omitted its ID");
  }
  if (typeof record.personId !== "string" || !record.personId.trim()) {
    throw new Error("Twenty Sales Appointment omitted its Person ID");
  }
  return record as SalesAppointmentRecord;
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
): TwentySalesAppointmentCalendarAdapter => ({
  async listSalesAppointments() {
    const appointments: SalesAppointmentRecord[] = [];
    let after: string | undefined;
    do {
      const result = await request(client, "/graphql", {
        method: "POST",
        body: JSON.stringify({
          query: `query ListSalesAppointments($after: String) {
            salesAppointments(first: 100, after: $after) {
              edges { node {
                id name rootCalBookingUid currentCalBookingUid
                currentBookingVersionId originatingLeadJourneyId
                initialConfirmedAt scheduledStartAt scheduledEndAt status
                funnelId environment prospectId personId opportunityId
                googleCalendarId googleEventId googleICalUid googleEventEtag
                googleEventSequence googleObservedStartAt synchronizationStatus
                acceptedGoogleRevision intendedStartAt automationGeneration
                reconciliationAlertRevision reconciliationAlertThreadTs
              } }
              pageInfo { hasNextPage endCursor }
            }
          }`,
          variables: { after },
        }),
      });
      const page = result as {
        data?: {
          salesAppointments?: {
            edges?: Array<{ node?: unknown }>;
            pageInfo?: { hasNextPage?: boolean; endCursor?: string };
          };
        };
        errors?: unknown[];
      };
      if (page.errors?.length) {
        throw new Error("Twenty Sales Appointment list failed");
      }
      appointments.push(
        ...(page.data?.salesAppointments?.edges?.flatMap(({ node }) =>
          node ? [parseSalesAppointmentRecord(node)] : [],
        ) ?? []),
      );
      const pageInfo = page.data?.salesAppointments?.pageInfo;
      after = pageInfo?.hasNextPage ? pageInfo.endCursor : undefined;
      if (pageInfo?.hasNextPage && !after) {
        throw new Error("Twenty Sales Appointment pagination omitted cursor");
      }
    } while (after);
    return appointments;
  },
  async getPersonDisplayName(personId) {
    const result = await request(
      client,
      `/rest/people/${encodeURIComponent(personId)}`,
      undefined,
      true,
    );
    if (!result || (result as { duplicate?: boolean }).duplicate) {
      return undefined;
    }
    const person = unwrap<{
      name?: { firstName?: string; lastName?: string };
    }>(result, "person");
    const displayName = [person?.name?.firstName, person?.name?.lastName]
      .filter(Boolean)
      .join(" ");
    return displayName || undefined;
  },
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
    const appointment = unwrap<unknown>(result, "salesAppointment");
    return appointment ? parseSalesAppointmentRecord(appointment) : undefined;
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
