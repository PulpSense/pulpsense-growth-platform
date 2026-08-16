import { describe, expect, it } from "vitest";

import { getLeadMagnetStaticPaths, resolveLeadMagnet } from "./index.js";

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
    expect(email?.html).toContain("Hey Maya,");
    expect(email?.html).not.toContain(
      '<a href="https://github.com/PulpSense/meta-offer-intelligence-skill">https://github.com/PulpSense/meta-offer-intelligence-skill</a>',
    );
    expect(email?.html).toContain(
      `what you need to run it.<div style="margin-top:12px;color:#1769e0;word-break:break-all;">https://github.com/PulpSense/meta-offer-intelligence-skill</div>`,
    );
    expect(email?.html).not.toContain("→");
    expect(email?.html).not.toContain("Get the Meta Offer Intelligence skill");
    expect(email?.html).not.toContain(
      "Researching large collections of Meta ads",
    );
    expect(email?.text).toContain("Hermes Agent");
    expect(email?.text).toContain("Hey Maya,");
  });
});
