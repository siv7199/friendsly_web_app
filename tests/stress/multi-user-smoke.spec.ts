import { expect, test, type Page } from "@playwright/test";

const fanEmail = process.env.E2E_FAN_EMAIL;
const fanPassword = process.env.E2E_FAN_PASSWORD;
const creatorEmail = process.env.E2E_CREATOR_EMAIL;
const creatorPassword = process.env.E2E_CREATOR_PASSWORD;
const creatorProfileId = process.env.E2E_CREATOR_PROFILE_ID;

async function signIn(page: Page, params: { email: string; password: string }) {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByLabel("Email").fill(params.email);
  await page.getByLabel("Password").fill(params.password);
  await page.getByRole("button", { name: "Sign In" }).last().click();
}

test.describe("watchable multi-user smoke", () => {
  test.skip(
    !fanEmail || !fanPassword || !creatorEmail || !creatorPassword || !creatorProfileId,
    "Set E2E_FAN_EMAIL, E2E_FAN_PASSWORD, E2E_CREATOR_EMAIL, E2E_CREATOR_PASSWORD, and E2E_CREATOR_PROFILE_ID."
  );

  test("fan and creator core surfaces load in separate visible sessions", async ({ browser }) => {
    const fanContext = await browser.newContext();
    const creatorContext = await browser.newContext();
    const fanPage = await fanContext.newPage();
    const creatorPage = await creatorContext.newPage();

    await Promise.all([
      signIn(fanPage, { email: fanEmail!, password: fanPassword! }),
      signIn(creatorPage, { email: creatorEmail!, password: creatorPassword! }),
    ]);

    await fanPage.waitForURL("**/discover", { timeout: 30000 });
    await creatorPage.waitForURL("**/dashboard", { timeout: 30000 });

    await expect(fanPage.getByText("Discover Creators")).toBeVisible();
    await expect(creatorPage.getByRole("button", { name: "Go Live" })).toBeVisible();

    await fanPage.goto(`/profile/${creatorProfileId}`);
    await expect(fanPage.getByText("Back to Discover")).toBeVisible();

    await creatorPage.goto("/calendar");
    await expect(creatorPage.getByText("Weekly Availability")).toBeVisible();

    await fanContext.close();
    await creatorContext.close();
  });
});
