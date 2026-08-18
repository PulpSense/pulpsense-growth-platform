import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryFile = (path) =>
  fileURLToPath(new URL(`../../../${path}`, import.meta.url));

describe("production deployment isolation", () => {
  it("loads Turnstile from the document head before the contact step mounts", async () => {
    const [layout, landingPage, form] = await Promise.all([
      readFile(
        repositoryFile("apps/funnels/src/layouts/BaseLayout.astro"),
        "utf8",
      ),
      readFile(
        repositoryFile("apps/funnels/src/pages/[...campaign]/index.astro"),
        "utf8",
      ),
      readFile(
        repositoryFile(
          "apps/funnels/src/funnels/ai-seo/components/AiSeoQualificationForm.tsx",
        ),
        "utf8",
      ),
    ]);

    expect(landingPage).toContain("loadTurnstile");
    expect(layout).toContain(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    );
    expect(layout).toContain("data-pulpsense-turnstile");
    expect(layout).toContain("defer");
    expect(layout).toContain('data-status="loading"');
    expect(layout).toContain("pulpsense:turnstile-script-state");
    expect(form).not.toContain('document.createElement("script")');
  });

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

  it("starts the gated production deployment on a master push", async () => {
    const workflow = await readFile(
      repositoryFile(".github/workflows/cloudflare-pages.yml"),
      "utf8",
    );

    const productionJob = workflow.split("  deploy-production:")[1];
    expect(productionJob).toContain(
      "cp apps/funnels/wrangler.production.toml apps/funnels/wrangler.toml",
    );
    expect(productionJob).toContain(
      "pages deploy dist --project-name=${{ vars.CLOUDFLARE_PAGES_PROJECT }}",
    );
    expect(productionJob).not.toContain("--config=");
    const gate = productionJob.split("    runs-on:")[0];
    expect(gate).toContain("github.ref == 'refs/heads/master'");
    expect(gate).toContain("github.event_name == 'push'");
    expect(gate).toContain("github.event_name == 'workflow_dispatch'");
    expect(gate).toContain("inputs.deploy_production");

    const validation = productionJob.split(
      "      - name: Validate Production Pages secrets",
    )[0];
    expect(validation).toContain(
      'test "$CLOUDFLARE_PAGES_PROJECT" = "pulpsense-funnels"',
    );
    expect(validation).toContain('test "$CLOUDFLARE_PAGES_BRANCH" = "master"');
    expect(validation).toContain("PUBLIC_POSTHOG_HOST: /e");
    expect(validation).toContain('test "$PUBLIC_POSTHOG_HOST" = "/e"');
    expect(validation).toContain(
      "PUBLIC_CAL_NAMESPACE: ${{ vars.PUBLIC_CAL_NAMESPACE }}",
    );
    expect(validation).toContain(
      "PUBLIC_META_PIXEL_ID_AI_SEO_L: ${{ vars.PUBLIC_META_PIXEL_ID_AI_SEO_L }}",
    );
    expect(validation).toContain(
      "PUBLIC_META_PIXEL_ID_AI_SEO_D: ${{ vars.PUBLIC_META_PIXEL_ID_AI_SEO_D }}",
    );
    for (const suffix of ["DI", "PS", "HR", "MS"]) {
      const variableName = `PUBLIC_META_PIXEL_ID_AI_SEO_${suffix}`;
      expect(validation).toContain(
        variableName + ": ${{ vars." + variableName + " }}",
      );
    }
    expect(validation).not.toContain("PUBLIC_AI_SEO_VERTICAL");
    expect(validation).not.toContain(
      "PUBLIC_META_PIXEL_ID: ${{ vars.PUBLIC_META_PIXEL_ID }}",
    );
    expect(productionJob).toContain("META_PIXEL_ID_AI_SEO_L");
    expect(productionJob).toContain("META_CAPI_ACCESS_TOKEN_AI_SEO_L");
    expect(productionJob).toContain("META_PIXEL_ID_AI_SEO_D");
    expect(productionJob).toContain("META_CAPI_ACCESS_TOKEN_AI_SEO_D");
    for (const suffix of ["DI", "PS", "HR", "MS"]) {
      expect(productionJob).toContain(`META_PIXEL_ID_AI_SEO_${suffix}`);
      expect(productionJob).toContain(
        `META_CAPI_ACCESS_TOKEN_AI_SEO_${suffix}`,
      );
    }
  });
});
