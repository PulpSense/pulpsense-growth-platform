import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const releasePerformanceBudgets = Object.freeze({
  cls: 0.1,
  lcpMs: 2_500,
});

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const metric = (report, auditName) => {
  const value = report?.audits?.[auditName]?.numericValue;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Lighthouse report omitted ${auditName}`);
  }
  return value;
};

export function evaluatePerformanceRuns(reports) {
  if (!Array.isArray(reports) || reports.length === 0) {
    throw new Error("At least one Lighthouse report is required");
  }

  const lcpMs = median(
    reports.map((report) => metric(report, "largest-contentful-paint")),
  );
  const cls = median(
    reports.map((report) => metric(report, "cumulative-layout-shift")),
  );

  if (lcpMs >= releasePerformanceBudgets.lcpMs) {
    throw new Error(
      `LCP ${lcpMs}ms does not meet the <${releasePerformanceBudgets.lcpMs}ms release budget`,
    );
  }
  if (cls >= releasePerformanceBudgets.cls) {
    throw new Error(
      `CLS ${cls} does not meet the <${releasePerformanceBudgets.cls} release budget`,
    );
  }

  return { cls, lcpMs };
}

const releaseOrigin = () => {
  const rawOrigin =
    process.env.RELEASE_ORIGIN ?? process.env.PARITY_CHECK_ORIGIN;
  if (!rawOrigin) {
    throw new Error("RELEASE_ORIGIN is required");
  }

  const origin = new URL(rawOrigin);
  if (origin.protocol !== "https:") {
    throw new Error("RELEASE_ORIGIN must use HTTPS");
  }
  return origin.origin;
};

const releaseRunCount = () => {
  const count = Number(process.env.RELEASE_PERFORMANCE_RUNS ?? "3");
  if (!Number.isInteger(count) || count < 1 || count % 2 === 0) {
    throw new Error("RELEASE_PERFORMANCE_RUNS must be a positive odd integer");
  }
  return count;
};

async function run() {
  const origin = releaseOrigin();
  const runCount = releaseRunCount();
  const target = new URL("/local-growth-6732ef498c/", origin).href;
  const lighthouseBin = fileURLToPath(
    new URL("../node_modules/lighthouse/cli/index.js", import.meta.url),
  );
  const reportDirectory = await mkdtemp(
    `${tmpdir()}/pulpsense-release-lighthouse-`,
  );

  try {
    const reports = [];
    for (let index = 0; index < runCount; index += 1) {
      const reportPath = `${reportDirectory}/mobile-${index + 1}.json`;
      await execFileAsync(
        process.execPath,
        [
          lighthouseBin,
          target,
          "--only-categories=performance",
          "--form-factor=mobile",
          "--screenEmulation.mobile=true",
          "--screenEmulation.width=390",
          "--screenEmulation.height=844",
          "--screenEmulation.deviceScaleFactor=3",
          "--throttling-method=simulate",
          "--output=json",
          `--output-path=${reportPath}`,
          "--quiet",
          "--chrome-flags=--headless=new --no-sandbox",
        ],
        { maxBuffer: 10 * 1024 * 1024 },
      );
      reports.push(JSON.parse(await readFile(reportPath, "utf8")));
    }

    const result = evaluatePerformanceRuns(reports);
    console.log(
      `Mobile performance passed (${runCount}-run median): LCP ${result.lcpMs}ms, CLS ${result.cls}.`,
    );
  } finally {
    await rm(reportDirectory, { force: true, recursive: true });
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await run();
}
