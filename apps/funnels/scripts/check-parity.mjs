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

const publicRoutes = [
  {
    path: "/regional-visibility-audit/law-firms/",
    funnelId: "ai-seo",
    thankYouPath: "/regional-visibility-audit/law-firms/thank-you/",
    markers: ["45 New Calls", "Get Your Visibility Audit"],
  },
  {
    path: "/regional-visibility-audit/law-firms/thank-you/",
    markers: ["ONE LAST THING", "Step 2: Watch the videos below"],
  },
  {
    path: "/regional-visibility-audit/dental-practices/",
    funnelId: "ai-seo-dentists",
    thankYouPath: "/regional-visibility-audit/dental-practices/thank-you/",
    markers: ["45 New Calls", "Get Your Visibility Audit"],
  },
  {
    path: "/regional-visibility-audit/dental-practices/thank-you/",
    markers: ["ONE LAST THING", "Step 2: Watch the videos below"],
  },
  {
    path: "/regional-visibility-audit/dental-implants/",
    funnelId: "ai-seo-dental-implants",
    thankYouPath: "/regional-visibility-audit/dental-implants/thank-you/",
    markers: ["45 New Calls", "Get Your Visibility Audit"],
  },
  {
    path: "/regional-visibility-audit/dental-implants/thank-you/",
    markers: ["ONE LAST THING", "Step 2: Watch the videos below"],
  },
  {
    path: "/regional-visibility-audit/plastic-surgery/",
    funnelId: "ai-seo-plastic-surgery",
    thankYouPath: "/regional-visibility-audit/plastic-surgery/thank-you/",
    markers: ["45 New Calls", "Get Your Visibility Audit"],
  },
  {
    path: "/regional-visibility-audit/plastic-surgery/thank-you/",
    markers: ["ONE LAST THING", "Step 2: Watch the videos below"],
  },
  {
    path: "/regional-visibility-audit/hair-restoration/",
    funnelId: "ai-seo-hair-restoration",
    thankYouPath: "/regional-visibility-audit/hair-restoration/thank-you/",
    markers: ["45 New Calls", "Get Your Visibility Audit"],
  },
  {
    path: "/regional-visibility-audit/hair-restoration/thank-you/",
    markers: ["ONE LAST THING", "Step 2: Watch the videos below"],
  },
  {
    path: "/regional-visibility-audit/med-spas/",
    funnelId: "ai-seo-med-spas",
    thankYouPath: "/regional-visibility-audit/med-spas/thank-you/",
    markers: ["45 New Calls", "Get Your Visibility Audit"],
  },
  {
    path: "/regional-visibility-audit/med-spas/thank-you/",
    markers: ["ONE LAST THING", "Step 2: Watch the videos below"],
  },
];
const landerHtmlByFunnelId = new Map();

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
    if (route.funnelId) landerHtmlByFunnelId.set(route.funnelId, html);

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
    assert.match(
      html,
      /media-id="8py8vigtf1"/,
      `${route.path} should embed the configured Wistia media`,
    );
    assert.match(
      html,
      /autoPlay:\s*false/,
      `${route.path} should keep Wistia autoplay disabled`,
    );
    assert.doesNotMatch(
      html,
      /vidalytics/iu,
      `${route.path} should not load Vidalytics`,
    );

    for (const marker of route.markers) {
      assert.ok(
        html.includes(marker),
        `${route.path} should contain ${JSON.stringify(marker)}`,
      );
    }

    if (route.funnelId) {
      assert.ok(
        html.includes(route.funnelId),
        `${route.path} should use the ${route.funnelId} identity`,
      );
      assert.ok(
        html.includes(route.thankYouPath),
        `${route.path} should submit to its own thank-you route`,
      );
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

  const landerIslands = [
    "AiSeoQualificationForm",
    "FunnelAnalytics",
    "TrackingPixels",
  ];
  for (const [funnelId, landerHtml] of landerHtmlByFunnelId) {
    for (const island of landerIslands) {
      assert.ok(
        landerHtml.includes(`component-export="${island}"`),
        `${funnelId} lander should hydrate the ${island} island`,
      );
    }
    assert.ok(
      !landerHtml.includes("2262354061181522"),
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
      status: "invalid",
      result: "non_business_email",
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
    `Parity check passed for ${publicRoutes.length} public routes, ${landerIslands.length} React island exports, ${externalOrigin ? "non-mutating preview checks" : "two API fallbacks"}, and robots.txt.`,
  );
} finally {
  server?.kill("SIGTERM");
}
