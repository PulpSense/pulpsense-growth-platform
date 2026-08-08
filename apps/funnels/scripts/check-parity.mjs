import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = Number(process.env.PARITY_CHECK_PORT ?? 43180);
const origin = `http://${host}:${port}`;
const nextBin = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);

const publicRoutes = [
  {
    path: "/creative-multiplier-sprint/",
    markers: ["Turn one winning ad into", "Apply now"],
  },
  {
    path: "/creative-multiplier-sprint/thank-you/",
    markers: [
      "Your Creative Multiplier Sprint call is booked.",
      "Call confirmed",
    ],
  },
  {
    path: "/creative-multiplier-sprint/unqualified/",
    markers: ["Thanks for applying.", "Application received"],
  },
];

const server = spawn(
  process.execPath,
  [nextBin, "start", "--hostname", host, "--port", String(port)],
  {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk;
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk;
});

async function waitUntilReady() {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready.\n${serverOutput}`);
    }

    try {
      const response = await fetch(`${origin}/robots.txt`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for Next.js.\n${serverOutput}`);
}

try {
  await waitUntilReady();

  for (const route of publicRoutes) {
    const response = await fetch(`${origin}${route.path}`);
    const html = await response.text();

    assert.equal(response.status, 200, `${route.path} should return 200`);
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

    for (const marker of route.markers) {
      assert.ok(
        html.includes(marker),
        `${route.path} should contain ${JSON.stringify(marker)}`,
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

  console.log(
    `Parity check passed for ${publicRoutes.length} public funnel routes and robots.txt.`,
  );
} finally {
  server.kill("SIGTERM");
}
