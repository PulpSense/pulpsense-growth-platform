import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryFile = (path) =>
  fileURLToPath(new URL(`../../../${path}`, import.meta.url));

describe("softphone deployment workflow", () => {
  it("deploys the softphone project from pull requests and master", async () => {
    const workflow = await readFile(
      repositoryFile(".github/workflows/softphone-pages.yml"),
      "utf8",
    );

    expect(workflow).toContain("name: Softphone Pages");
    expect(workflow).toContain('- "apps/softphone/**"');
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain(
      "SOFTPHONE_PAGES_PROJECT: pulpsense-softphone-preview",
    );

    const previewJob = workflow.split("  deploy-preview:")[1];
    expect(previewJob).toContain("workingDirectory: apps/softphone");
    expect(previewJob).toContain(
      "--branch=pr-${{ github.event.pull_request.number }}",
    );

    const productionJob = workflow.split("  deploy-production:")[1];
    expect(productionJob).toContain("workingDirectory: apps/softphone");
    expect(productionJob).toContain(
      "pages deploy dist --project-name=${{ env.SOFTPHONE_PAGES_PROJECT }} --branch=master",
    );
    expect(productionJob).toContain("name: Production");

    const gate = productionJob.split("    runs-on:")[0];
    expect(gate).toContain("github.ref == 'refs/heads/master'");
    expect(gate).toContain("github.event_name == 'push'");
    expect(gate).toContain("github.event_name == 'workflow_dispatch'");
    expect(gate).toContain("inputs.deploy_production");
  });
});
