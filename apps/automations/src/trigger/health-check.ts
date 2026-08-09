import { logger, task } from "@trigger.dev/sdk";

export const healthCheck = task({
  id: "health-check",
  run: async (payload: { message?: string }) => {
    const message = payload.message ?? "PulpSense automations are online";

    logger.info("Health check completed", { message });

    return {
      ok: true,
      message,
      checkedAt: new Date().toISOString(),
    };
  },
});
