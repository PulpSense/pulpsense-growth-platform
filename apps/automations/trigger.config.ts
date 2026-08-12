import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_hynamgahugenjrtxzpcd",
  runtime: "node-22",
  dirs: ["./src/trigger"],
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      factor: 2,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      randomize: true,
    },
  },
});
