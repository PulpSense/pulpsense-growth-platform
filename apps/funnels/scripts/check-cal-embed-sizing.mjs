import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const component = fs.readFileSync(
  path.join(appDirectory, "src/components/ui/CalBookingStep.tsx"),
  "utf8",
);
const stylesheet = ["funnel.css", "application.css"]
  .map((fileName) =>
    fs.readFileSync(
      path.join(appDirectory, "src/funnels/ai-seo/styles", fileName),
      "utf8",
    ),
  )
  .join("\n");

assert.match(component, /style=\{\{ width: "100%" \}\}/);
assert.doesNotMatch(component, /height:\s*"100%"|overflow:\s*"scroll"/);

assert.doesNotMatch(
  stylesheet,
  /\.pr-form-embed--booking\s+iframe\s*\{/,
  "The host must not pin the Cal iframe height; Cal's inline embed resizes it per view.",
);

console.log("Cal booking embed can use its content-driven height.");
