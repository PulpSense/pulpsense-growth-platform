import { describe, expect, it } from "vitest";

import { getLeadMagnetStaticPaths, resolveLeadMagnet } from "./registry";

describe("lead magnet registry", () => {
  it("discovers config files and derives their static routes", () => {
    const config = resolveLeadMagnet("meta-offer-intelligence-skill");

    expect(config?.slug).toBe("meta-offer-intelligence-skill");
    expect(getLeadMagnetStaticPaths()).toContainEqual({
      params: { leadMagnet: "meta-offer-intelligence-skill" },
      props: { config },
    });
  });

  it("keeps page and delivery copy in the same config", () => {
    const config = resolveLeadMagnet("meta-offer-intelligence-skill");
    const email = config?.renderEmail("Maya");

    expect(config?.page.accent).toBe("worth studying.");
    expect(email?.subject).toBe("Your Meta Offer Intelligence agent skill");
    expect(email?.html).toContain(
      "https://github.com/PulpSense/meta-offer-intelligence-skill",
    );
    expect(email?.text).toContain("Hermes Agent");
  });
});
