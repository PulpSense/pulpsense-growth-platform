import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryFile = (path) =>
  fileURLToPath(new URL(`../../../${path}`, import.meta.url));

describe("production deployment isolation", () => {
  it("binds Pages to a production-only rate-limiter service", async () => {
    const config = await readFile(
      repositoryFile("apps/funnels/wrangler.production.toml"),
      "utf8",
    );

    expect(config).toContain('name = "pulpsense-funnels"');
    expect(config).toContain('service = "pulpsense-funnel-rate-limiter"');
    expect(config).toContain('environment = "production"');
    expect(config).not.toContain("rate-limiter-preview");
  });

  it("uses the production config only for the gated deployment", async () => {
    const workflow = await readFile(
      repositoryFile(".github/workflows/cloudflare-pages.yml"),
      "utf8",
    );

    expect(workflow).toContain(
      "pages deploy dist --config=wrangler.production.toml --project-name=${{ vars.CLOUDFLARE_PAGES_PROJECT }}",
    );

    const productionJob = workflow.split("  deploy-production:")[1];
    const gate = productionJob.split("    runs-on:")[0];
    expect(gate).toContain("github.ref == 'refs/heads/master'");
    expect(gate).toContain("github.event_name == 'workflow_dispatch'");
    expect(gate).not.toContain("github.event_name == 'push'");

    const validation = productionJob.split(
      "      - name: Validate Production Pages secrets",
    )[0];
    expect(validation).toContain(
      'test "$CLOUDFLARE_PAGES_PROJECT" = "pulpsense-funnels"',
    );
    expect(validation).toContain(
      'test "$CLOUDFLARE_PAGES_BRANCH" = "master"',
    );
    expect(validation).toContain(
      "PUBLIC_POSTHOG_HOST: ${{ vars.PUBLIC_POSTHOG_HOST }}",
    );
    expect(validation).toContain(
      "PUBLIC_CAL_NAMESPACE: ${{ vars.PUBLIC_CAL_NAMESPACE }}",
    );
  });
});
