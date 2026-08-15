import { readFile } from "node:fs/promises";

const args = new Set(process.argv.slice(2));
const mode = args.has("--apply")
  ? "apply"
  : args.has("--read-back")
    ? "read-back"
    : "dry-run";
const mappingPath = process.argv
  .slice(2)
  .find((argument) => !argument.startsWith("--"));
if (!mappingPath) {
  throw new Error(
    "Usage: pnpm backfill:twenty-sales <ignored-mapping.json> [--apply|--read-back]",
  );
}

const mappings = JSON.parse(await readFile(mappingPath, "utf8"));
if (!Array.isArray(mappings) || mappings.length !== 4) {
  throw new Error("The approved backfill must contain exactly four mappings");
}
for (const [index, mapping] of mappings.entries()) {
  for (const field of [
    "personId",
    "prospectId",
    "opportunityId",
    "originatingLeadJourneyId",
  ]) {
    if (typeof mapping?.[field] !== "string" || !mapping[field]) {
      throw new Error(`Mapping ${index + 1} is missing ${field}`);
    }
  }
  if (!/^prospect_v1_[0-9a-f]{64}$/u.test(mapping.prospectId)) {
    throw new Error(`Mapping ${index + 1} has an invalid Prospect ID`);
  }
}

const report = mappings.map((mapping) => ({
  person: { id: mapping.personId, prospectId: mapping.prospectId },
  opportunity: {
    id: mapping.opportunityId,
    originatingLeadJourneyId: mapping.originatingLeadJourneyId,
  },
}));
if (mode === "dry-run") {
  console.log(
    JSON.stringify({ mode, mutations: false, mappings: report }, null, 2),
  );
  process.exit(0);
}

const origin = process.env.TWENTY_API_ORIGIN?.replace(/\/+$/u, "");
const apiKey = process.env.TWENTY_API_KEY;
if (!origin || !apiKey)
  throw new Error("TWENTY_API_ORIGIN and TWENTY_API_KEY are required");
const request = async (path, init) => {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok)
    throw new Error(`Twenty request failed (${response.status})`);
  return response.json();
};

if (mode === "apply") {
  for (const mapping of mappings) {
    await request(`/rest/people/${encodeURIComponent(mapping.personId)}`, {
      method: "PATCH",
      body: JSON.stringify({ prospectId: mapping.prospectId }),
    });
    await request(
      `/rest/opportunities/${encodeURIComponent(mapping.opportunityId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          originatingLeadJourneyId: mapping.originatingLeadJourneyId,
        }),
      },
    );
  }
  console.log(
    JSON.stringify({ mode, mutations: true, mappings: report }, null, 2),
  );
  process.exit(0);
}

const verified = [];
for (const mapping of mappings) {
  const [personResult, opportunityResult] = await Promise.all([
    request(`/rest/people/${encodeURIComponent(mapping.personId)}`),
    request(`/rest/opportunities/${encodeURIComponent(mapping.opportunityId)}`),
  ]);
  const person = personResult.data?.person ?? personResult;
  const opportunity = opportunityResult.data?.opportunity ?? opportunityResult;
  verified.push({
    personId: mapping.personId,
    prospectId: person.prospectId,
    prospectMatches: person.prospectId === mapping.prospectId,
    opportunityId: mapping.opportunityId,
    originatingLeadJourneyId: opportunity.originatingLeadJourneyId,
    journeyMatches:
      opportunity.originatingLeadJourneyId === mapping.originatingLeadJourneyId,
  });
}
console.log(JSON.stringify({ mode, verified }, null, 2));
if (verified.some((item) => !item.prospectMatches || !item.journeyMatches)) {
  throw new Error(
    "Twenty backfill read-back did not match the approved mappings",
  );
}
