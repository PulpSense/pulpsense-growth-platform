import { expect, test, type Page } from "@playwright/test";

const applicationPath = "/visibility-audit/law-firms/apply/";
const metaRequestPattern =
  /(?:connect\.facebook\.net|facebook\.com\/tr|graph\.facebook\.com)/u;

const enterContactDetails = async (page: Page) => {
  await page.goto(applicationPath);
  await page.locator("#pr-funnel-form").scrollIntoViewIfNeeded();
  const submit = page.getByRole("button", { name: "Continue" });
  await expect(submit).toBeEnabled({ timeout: 30_000 });
  await page.getByLabel("First name").fill("E2E");
  await page.getByLabel("Last name (optional)").fill("Test");
  await page.getByLabel("Email").fill("santi@pulpsense.com");
  await page.locator("#ai-seo-phone").fill("4155550123");
  return submit;
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

  const submit = await enterContactDetails(page);
  await submit.click();

  await expect.poll(() => submissionResponses.length).toBeGreaterThanOrEqual(1);
  expect(submissionResponses[0]).toMatchObject({
    status: 200,
    body: { accepted: true },
  });

  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page
    .getByRole("button", { name: "$1,500+/month", exact: true })
    .click();

  await expect(page.getByText("Book Free Audit Call")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('iframe[src*="cal.com"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect.poll(() => submissionResponses.length).toBe(2);
  expect(submissionResponses.map(({ status }) => status)).toEqual([200, 200]);
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

  const submit = await enterContactDetails(page);
  await submit.click();

  await expect(page.getByRole("alert")).toContainText(
    "We couldn't submit your details yet",
  );
  expect(funnelRequests).toEqual([]);
  await expect(page.getByText("Book Free Audit Call")).toHaveCount(0);
});
