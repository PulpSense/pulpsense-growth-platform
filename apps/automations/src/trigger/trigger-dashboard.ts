const dashboardProjectUrl =
  "https://cloud.trigger.dev/orgs/pulpsense-55f9/projects/internal-automations--Y9w";

export const triggerRunUrl = (environmentSlug: string, runId: string) =>
  `${dashboardProjectUrl}/env/${encodeURIComponent(environmentSlug)}/runs/${encodeURIComponent(runId)}`;
