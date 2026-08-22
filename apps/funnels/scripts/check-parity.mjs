import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const externalOrigin = process.env.PARITY_CHECK_ORIGIN?.replace(/\/$/, "");
const findAvailablePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, host, () => {
      const address = probe.address();
      probe.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Could not allocate a parity-check port"));
          return;
        }
        resolve(address.port);
      });
    });
  });
const configuredPort = process.env.PARITY_CHECK_PORT
  ? Number(process.env.PARITY_CHECK_PORT)
  : undefined;
if (
  configuredPort !== undefined &&
  (!Number.isInteger(configuredPort) ||
    configuredPort < 1 ||
    configuredPort > 65535)
) {
  throw new Error("PARITY_CHECK_PORT must be an integer from 1 to 65535");
}
const port = configuredPort ?? (await findAvailablePort());
const origin = externalOrigin ?? `http://${host}:${port}`;
const wranglerBin = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);
const isolatedFallbackBindings = [
  "META_CAPI_ACCESS_TOKEN=",
  "META_PIXEL_ID=",
  "MILLION_VERIFIER_API_KEY=",
  "PULPSENSE_TRIGGER_SECRET_KEY=",
];
const campaignRoutes = [
  {
    slug: "visibility-audit/law-firms",
    funnelId: "ai-seo",
    lawFirmPilot: true,
  },
  {
    slug: "visibility-audit/dental-practices",
    funnelId: "ai-seo-dentists",
  },
  {
    slug: "visibility-audit/dental-implants",
    funnelId: "ai-seo-dental-implants",
  },
  {
    slug: "visibility-audit/plastic-surgery",
    funnelId: "ai-seo-plastic-surgery",
  },
  {
    slug: "visibility-audit/hair-restoration",
    funnelId: "ai-seo-hair-restoration",
  },
  {
    slug: "visibility-audit/med-spas",
    funnelId: "ai-seo-med-spas",
  },
];

const campaignPublicRoutes = campaignRoutes.flatMap(
  ({ slug, funnelId, lawFirmPilot = false }) => {
    const landingPath = `/${slug}/`;
    const applicationPath = `${landingPath}apply/`;
    const thankYouPath = `${landingPath}thank-you/`;
    return [
      {
        kind: "landing",
        path: landingPath,
        funnelId,
        deck: "VisibilityDeckCarousel",
        markers: lawFirmPilot
          ? ["45 Qualified New-Client Inquiries", "Get Your Visibility Audit"]
          : ["45 New Calls", "Get Your Visibility Audit"],
        lawFirmPilot,
      },
      {
        kind: "application",
        path: applicationPath,
        funnelId,
        thankYouPath,
        markers: lawFirmPilot
          ? [
              "45 Qualified New-Client Inquiries",
              "What to expect on our call",
              "Guarantee terms",
            ]
          : ["45 New Calls", "What to expect on our call"],
        lawFirmPilot,
      },
      {
        kind: "thank-you",
        path: thankYouPath,
        deck: "ThankYouDeckCarousel",
        markers: lawFirmPilot
          ? ["ONE LAST THING", "Review this quick briefing"]
          : ["ONE LAST THING", "Review this quick briefing"],
        lawFirmPilot,
      },
    ];
  },
);
const personalizationPreviewRoutes = [
  {
    kind: "reference",
    path: "/personalization-preview/",
    markers: [
      "PERSONALIZATION",
      "Traditional Paid Ads vs. AI Search",
      "Get Your Visibility Audit",
    ],
  },
  {
    kind: "reference",
    path: "/personalization-preview/apply/",
    markers: [
      "PERSONALIZATION",
      "Step 2 of 4",
      "Step 3 of 4",
      "No additional qualification question is introduced",
    ],
  },
];
const publicRoutes = [...campaignPublicRoutes, ...personalizationPreviewRoutes];
const applicationHtmlByFunnelId = new Map();

function assertGuaranteeTermsInsideDisclosureFooter(html, path) {
  const disclosureFooter = html.match(
    /<section class="pr-footer">([\s\S]*?)<\/section>/,
  )?.[1];

  assert.ok(disclosureFooter, `${path} should render the disclosure footer`);
  assert.ok(
    disclosureFooter.indexOf("Guarantee terms") >
      disclosureFooter.indexOf("Important Disclosures"),
    `${path} should include shared guarantee terms inside Important Disclosures`,
  );
}

async function postJson(path, body) {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

const server = externalOrigin
  ? undefined
  : spawn(
      process.execPath,
      [
        wranglerBin,
        "pages",
        "dev",
        "dist",
        "-c",
        "wrangler.toml",
        "-c",
        "../rate-limiter/wrangler.toml",
        "--ip",
        host,
        "--port",
        String(port),
        "--compatibility-date",
        "2026-08-08",
        ...isolatedFallbackBindings.flatMap((binding) => [
          "--binding",
          binding,
        ]),
      ],
      {
        env: {
          ...process.env,
          CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
          WRANGLER_SEND_METRICS: "false",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

let serverOutput = "";
server?.stdout.on("data", (chunk) => {
  serverOutput += chunk;
});
server?.stderr.on("data", (chunk) => {
  serverOutput += chunk;
});

async function waitUntilReady() {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (server && server.exitCode !== null) {
      throw new Error(
        `Cloudflare Pages exited before becoming ready.\n${serverOutput}`,
      );
    }

    try {
      const response = await fetch(`${origin}/robots.txt`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for Cloudflare Pages.\n${serverOutput}`);
}

try {
  await waitUntilReady();

  for (const route of publicRoutes) {
    const response = await fetch(`${origin}${route.path}`);
    const html = await response.text();
    if (route.kind === "application") {
      applicationHtmlByFunnelId.set(route.funnelId, html);
    }

    assert.equal(response.status, 200, `${route.path} should return 200`);
    assert.ok(
      response.url.endsWith(route.path),
      `${route.path} should retain its trailing-slash URL`,
    );
    assert.equal(
      response.headers.get("x-robots-tag"),
      "noindex, nofollow, noarchive, noimageindex",
      `${route.path} should retain the crawler-blocking response header`,
    );
    assert.match(
      html,
      /<meta name="robots" content="noindex, nofollow"/,
      `${route.path} should retain noindex metadata`,
    );
    if (route.deck) {
      assert.ok(
        html.includes(`component-export="${route.deck}"`),
        `${route.path} should embed its native deck carousel`,
      );
    }
    if (route.lawFirmPilot) {
      assert.match(
        html,
        /4\.9\/5|What (?:Service Business Owners|Local Businesses) Say About Us|What Clients Say About Working With Us/,
        `${route.path} should preserve the standard proof presentation`,
      );
      assert.doesNotMatch(html, /legal inquiries/i);
      assert.doesNotMatch(html, /45 calls or free/i);
      assert.doesNotMatch(html, /refund/i);
    }
    assert.doesNotMatch(
      html,
      /media-id="8py8vigtf1"|vidalytics/iu,
      `${route.path} should not embed a retired video provider`,
    );

    for (const marker of route.markers) {
      assert.ok(
        html.includes(marker),
        `${route.path} should contain ${JSON.stringify(marker)}`,
      );
    }

    assertGuaranteeTermsInsideDisclosureFooter(html, route.path);

    if (route.funnelId) {
      assert.ok(
        html.includes(route.funnelId),
        `${route.path} should use the ${route.funnelId} identity`,
      );
      if (route.kind === "application") {
        assert.ok(
          html.includes(route.thankYouPath),
          `${route.path} should submit to its own thank-you route`,
        );
      }
    }
  }

  const robotsResponse = await fetch(`${origin}/robots.txt`);
  const robots = await robotsResponse.text();
  assert.equal(robotsResponse.status, 200, "/robots.txt should return 200");
  assert.match(
    robots,
    /User-Agent: \*\s+Disallow: \//,
    "/robots.txt should disallow every crawler",
  );

  const applicationIslands = [
    "AiSeoQualificationForm",
    "FunnelAnalytics",
    "TrackingPixels",
  ];
  for (const [funnelId, applicationHtml] of applicationHtmlByFunnelId) {
    for (const island of applicationIslands) {
      assert.ok(
        applicationHtml.includes(`component-export="${island}"`),
        `${funnelId} application should hydrate the ${island} island`,
      );
    }
    assert.ok(
      !applicationHtml.includes("2262354061181522"),
      `${funnelId} preview output should not include the production Pixel ID`,
    );
  }

  if (!externalOrigin) {
    const personalEmailResponse = await postJson("/api/verify-email", {
      email: "person@gmail.com",
    });
    assert.equal(personalEmailResponse.status, 200);
    assert.deepEqual(await personalEmailResponse.json(), {
      valid: false,
      status: "unverified",
      result: "provider_error",
    });

    const sandboxEmailResponse = await postJson("/api/verify-email", {
      email: "person@example.org",
    });
    assert.equal(sandboxEmailResponse.status, 200);
    const sandboxEmail = await sandboxEmailResponse.json();
    assert.equal(typeof sandboxEmail.valid, "boolean");
    assert.equal(sandboxEmail.status, "unverified");
    assert.equal(sandboxEmail.result, "provider_error");

    const sandboxMetaResponse = await postJson("/api/meta-capi", {});
    assert.equal(sandboxMetaResponse.status, 500);
    assert.deepEqual(await sandboxMetaResponse.json(), {
      error: "Meta CAPI not configured",
    });
  }

  console.log(
    `Parity check passed for ${publicRoutes.length} public routes, ${applicationIslands.length} React island exports, ${externalOrigin ? "non-mutating preview checks" : "two API fallbacks"}, and robots.txt.`,
  );
} finally {
  server?.kill("SIGTERM");
}
