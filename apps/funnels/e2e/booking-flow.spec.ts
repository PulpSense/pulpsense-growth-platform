import { expect, test, type Page } from "@playwright/test";

const funnelPath = "/visibility-audit/law-firms/";
const metaRequestPattern =
  /(?:connect\.facebook\.net|facebook\.com\/tr|graph\.facebook\.com)/u;

const reachContactStep = async (page: Page) => {
  await page.goto(funnelPath);
  const ownerYes = page.getByRole("button", { name: "Yes", exact: true });
  await ownerYes.focus();
  await page.waitForTimeout(500);
  await ownerYes.click();
  await page.getByRole("button", { name: "$1,500+/month" }).click();
  await page
    .getByRole("button", { name: "Yes, if the numbers make sense" })
    .click();
  await page.getByLabel("First name").fill("E2E");
  await page.getByLabel("Last name (optional)").fill("Test");
  await page.getByLabel("Business email").fill("santi@pulpsense.com");
  await page.locator("#ai-seo-phone").fill("4155550123");
};

test("an internal test lead reaches the real Cal booking embed", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const metaRequests: string[] = [];
  const submissionResponses: Array<{ status: number; body: unknown }> = [];
  page.on("request", (request) => {
    if (metaRequestPattern.test(request.url()))
      metaRequests.push(request.url());
  });
  page.on("response", async (response) => {
    if (!response.url().includes("/api/funnel-events")) return;
    submissionResponses.push({
      status: response.status(),
      body: await response.json().catch(() => undefined),
    });
  });

  await reachContactStep(page);
  const submit = page.getByRole("button", { name: "See Available Times" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();

  await expect(page.getByText("Book Free Audit Call")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('iframe[src*="cal.com"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect.poll(() => submissionResponses.length).toBe(2);
  expect(submissionResponses.map(({ status }) => status)).toEqual([200, 200]);
  expect(submissionResponses[0]?.body).toMatchObject({ accepted: true });
  expect(submissionResponses[1]?.body).toMatchObject({
    accepted: true,
    nextStep: "booking",
  });
  expect(metaRequests).toEqual([]);
  await expect(page.locator('script[src*="connect.facebook.net"]')).toHaveCount(
    0,
  );
});

test("the always-fail Turnstile widget blocks submission", async ({ page }) => {
  test.setTimeout(45_000);
  test.skip(
    process.env.E2E_TURNSTILE_FAILURE !== "true",
    "Run only against the build configured with Cloudflare's always-fail key",
  );
  const funnelRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/funnel-events")) {
      funnelRequests.push(request.url());
    }
  });

  await reachContactStep(page);
  const submit = page.getByRole("button", { name: "See Available Times" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await submit.click();

  await expect(page.getByRole("alert")).toContainText(
    "We couldn't submit your details yet",
  );
  expect(funnelRequests).toEqual([]);
  await expect(page.getByText("Book Free Audit Call")).toHaveCount(0);
});
