import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const headers =
  "encounter_id,arrival_at_utc,first_provider_at_utc,provider_status\n";
async function loadDemo(page: Page) {
  await page.getByRole("button", { name: "Load Synthetic Demo" }).click();
  await expect(
    page.getByRole("button", { name: "Run Analysis", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Run Analysis", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Key calculated indicators" }),
  ).toBeVisible();
}
async function upload(page: Page, text: string, name = "fixture.csv") {
  await page
    .getByLabel("Upload CSV", { exact: true })
    .setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(text) });
}
async function configure(page: Page, a = "2026-10-05", b = "2026-10-12") {
  await page.getByLabel("Period A start").fill(a);
  await page.getByLabel("Period B start").fill(b);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Run Analysis", exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
});

test("empty state, keyboard access and explicitly unavailable future actions", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { name: "Emergency Department Operations", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Key calculated indicators" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "A clear view begins with your data" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Run Analysis", exact: true }),
  ).toBeDisabled();
  for (const label of [
    "What-If Scenario",
    "Generate Report",
    "Export Summary (PDF)",
  ]) {
    await expect(
      page.getByRole("region", { name: "Analysis actions" }).getByRole("button", {
        name: new RegExp(label.replace(/[()]/g, "\\$&")),
      }),
    ).toBeDisabled();
  }
  for (const label of ["Operational Alerts", "AI Analysis", "What-If Scenarios", "Reports"]) {
    await expect(page.getByRole("navigation", { name: "Main navigation", includeHidden: true }).getByRole("button", {includeHidden: true, name: new RegExp("^" + label + ".*Planned")})).toBeDisabled();
  }
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to dashboard" }),
  ).toBeFocused();
});

test("demo values, chart interaction, quality evidence and screenshots", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loadDemo(page);
  const cards = page.getByRole("region", { name: "Key calculated indicators" });
  await expect(cards).toContainText("1,400");
  await expect(cards).toContainText("Period A: 700 · Period B: 700");
  await expect(page.getByLabel("Period A start")).toHaveValue("2026-10-05");
  await expect(page.getByLabel("Period B start")).toHaveValue("2026-10-12");
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(page.locator(".finding-panel")).toContainText("70.0");
  await expect(page.locator(".explanation")).toContainText("1,190");
  await expect(cards).toContainText("80.0");
  await expect(cards).toContainText("+10.0 min");
  await expect(cards).toContainText("85.0%");
  await expect(cards).toContainText("100.0%");
  await expect(cards).toContainText("210 timing exclusions");
  await expect(page.locator(".finding-panel")).toContainText("+14.3%");
  await expect(page.locator(".finding-panel")).toContainText("+10.0");
  await expect(page.locator(".evidence-status")).toContainText("Unchanged");
  await expect(page.locator(".evidence-status")).toContainText("100.0% among seen");
  await expect(page.locator(".evidence-status")).toContainText("Declared · unverified");
  await expect(page.locator(".evidence-status")).toContainText("Coverage not independently verified");
  for (const title of ["AI Explanation", "Recommended Actions", "Operational Status", "Comparison Finding"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  if (testInfo.project.name.startsWith("desktop")) {
    const bounds = await page.locator(".kpi").evaluateAll(items => items.map(item => {
      const r = item.getBoundingClientRect(); return { y: r.y, bottom: r.bottom };
    }));
    expect(new Set(bounds.map(r => r.y)).size).toBe(1);
    const lowerY = await page.locator(".explanation-grid > section").evaluateAll(items => items.map(item => item.getBoundingClientRect().y));
    expect(new Set(lowerY).size).toBe(1);
    const action = await page.locator(".action-area").boundingBox();
    const data = await page.locator("#data").boundingBox();
    expect(action!.y + action!.height).toBeLessThanOrEqual(data!.y);
    expect(action!.y + action!.height).toBeLessThan(1024);
  }
  await mkdir("docs/screenshots", { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${testInfo.project.name}-phase4-acceptance.png`,
    fullPage: testInfo.project.name.startsWith("mobile"),
    scale: "css",
  });
  await page
    .getByRole("button", { name: "Inspect Period A median: 70.0 minutes" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".chart-inspection")).toContainText("595 eligible");
  await page.getByText("View accessible data table", { exact: true }).click();
  await expect(page.getByRole("table").first()).toContainText("595");
  await page.getByText("View accessible data table", { exact: true }).click();
  await page.getByRole("button", { name: "Daily counts", exact: true }).click();
  await page
    .getByRole("button", {
      name: "A, 2026-10-05: 100 supplied encounters",
      exact: true,
    })
    .click();
  await expect(page.locator(".chart-inspection")).toContainText(
    "100 accepted supplied encounters",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screenshots/${testInfo.project.name}-phase4-acceptance-daily.png`,
    fullPage: true,
    scale: "css",
  });
  await page
    .getByText("Timing exclusions and denominator evidence", { exact: true })
    .click();
  await expect(page.getByRole("table").last()).toContainText("not seen");
  await page
    .getByText("Dataset identity, coverage & limitations", { exact: true })
    .click();
  await expect(page.locator(".provenance")).toContainText(
    "5cafd9e244b8b48d729b78176449df5fce37bbbcc13ce1dd2f38bbf77602a0a2",
  );
  expect(errors).toEqual([]);
});

test("changing dates clears results and overlapping periods block calculation", async ({
  page,
}) => {
  await loadDemo(page);
  await page.getByRole("link", { name: /Two 7-day periods/ }).click();
  await expect(page.locator("#data")).toBeInViewport();
  await page.getByLabel("Period B start").fill("2026-10-08");
  await expect(
    page.getByRole("region", { name: "Key calculated indicators" }),
  ).toHaveCount(0);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Run Analysis", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Run Analysis", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("must not overlap");
  await configure(page);
  await expect(
    page.getByRole("region", { name: "Key calculated indicators" }),
  ).toContainText("1,400");
});

test("fatal replacement upload clears all results and dates; recovery requires new confirmation", async ({
  page,
}) => {
  await loadDemo(page);
  await upload(page, "bad,headers\na,b");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "required encounter headers",
  );
  await expect(
    page.getByRole("region", { name: "Key calculated indicators" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Period A start")).toHaveValue("");
  await upload(
    page,
    headers +
      "a,2026-10-05T12:00:00Z,2026-10-05T12:10:00Z,seen\nb,2026-10-12T12:00:00Z,2026-10-12T12:30:00Z,seen",
  );
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await configure(page);
  await expect(
    page.getByRole("region", { name: "Key calculated indicators" }),
  ).toContainText("30.0");
  await expect(page.locator(".evidence-status")).toContainText(
    "Unverified",
  );
  await expect(page.locator(".demo-notice")).toHaveCount(0);
});

test("uploaded CSV stays local, header-only and all-quarantined states are honest", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });
  await upload(page, headers);
  await configure(page);
  await expect(page.locator(".empty-notice")).toContainText(
    "No countable encounters",
  );
  await expect(
    page.getByRole("region", { name: "Key calculated indicators" }),
  ).toContainText("Unavailable");
  await upload(
    page,
    headers +
      "dup,2026-10-05T12:00:00Z,,unknown\ndup,2026-10-12T12:00:00Z,,unknown",
  );
  await expect(page.getByLabel("Period A start")).toHaveValue("");
  await configure(page);
  await expect(page.locator(".quality-summary")).toContainText(
    "Duplicate quarantine2",
  );
  await expect(page.locator(".empty-notice")).toBeVisible();
  expect(requests).toEqual([]);
  await page.reload();
  await expect(page.getByLabel("Period A start")).toHaveValue("");
});

test("oversized upload rejects before analysis", async ({ page }) => {
  await upload(page, "x".repeat(2 * 1024 * 1024 + 1));
  await expect(page.getByRole("main").getByRole("alert")).toContainText("2 MiB limit");
  await expect(
    page.getByRole("button", { name: "Run Analysis", exact: true }),
  ).toBeDisabled();
});

test("loading a replacement demo immediately clears evidence and disables analysis", async ({ page }) => {
  await loadDemo(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/demo/csv", async route => { await gate; await route.continue(); });
  await page.getByRole("button", { name: "Load Synthetic Demo" }).click();
  await expect(page.getByRole("region", { name: "Key calculated indicators" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Processing…" })).toBeDisabled();
  await expect(page.locator(".status-line")).toContainText("Loading and reproducing");
  release();
  await expect(page.getByRole("button", { name: "Run Analysis", exact: true })).toBeEnabled();
});

test("tampered demo bytes cannot acquire synthetic verification", async ({ page }) => {
  await page.route("**/demo/csv", route => route.fulfill({ body: headers, contentType: "text/csv" }));
  await page.getByRole("button", { name: "Load Synthetic Demo" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("reproduction mismatch");
  await expect(page.getByRole("button", { name: "Run Analysis", exact: true })).toBeDisabled();
  await expect(page.locator(".demo-notice")).toHaveCount(0);
});

test("demo network failure has a visible recovery path", async ({ page }) => {
  await page.route("**/demo/csv", (route) =>
    route.fulfill({ status: 500, body: "unavailable" }),
  );
  await page.getByRole("button", { name: "Load Synthetic Demo" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("could not be loaded");
  await page.unroute("**/demo/csv");
  await loadDemo(page);
});

test("responsive layout and mobile navigation at narrow widths", async ({
  page,
}, testInfo) => {
  await loadDemo(page);
  const widths = testInfo.project.name.startsWith("mobile")
    ? [320, 375, 768]
    : [1024, 1440, 1536];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1024 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width === 1440 || width === 768) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `docs/screenshots/phase4-acceptance-${width}.png`, fullPage: width === 768, scale: "css" });
    }
  }
  if (testInfo.project.name.startsWith("mobile")) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Data Upload" }).click();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).not.toBeVisible();
  }
});

test("mixed record defects reconcile, malformed CSV rejects, and uploads make no requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  // Independent expected counts: six rows = two quarantined + one invalid arrival + three accepted.
  // Accepted timings: A [10] (one seen timestamp missing), B [30]; two of three eligible/populated.
  const mixed = headers + [
    "a,2026-10-05T12:00:00Z,2026-10-05T12:10:00Z,seen",
    "b,2026-10-12T12:00:00Z,2026-10-12T12:30:00Z,seen",
    "dup,2026-10-05T12:00:00Z,,unknown",
    "dup,2026-10-12T12:00:00Z,,unknown",
    "missing,2026-10-05T13:00:00Z,,seen",
    "invalid,not-a-date,,unknown",
  ].join("\n");
  await upload(page, mixed);
  await configure(page);
  await expect(page.locator(".kpi-value").first()).toHaveText("3");
  await expect(page.locator(".kpi-grid")).toContainText("66.7%");
  await expect(page.locator(".finding-panel")).toContainText("+20.0-minute");
  await expect(page.locator(".quality-summary")).toContainText("Duplicate quarantine2");
  await expect(page.locator(".quality-summary")).toContainText("Unusable arrival1");
  await page.getByText("Record-level diagnostics (nonexclusive)", { exact: true }).click();
  await page.locator(".diagnostics summary").filter({ hasText: /duplicate/ }).click();
  await expect(page.locator(".diagnostics")).toContainText("Logical records: 4, 5");
  await page.getByText("View accessible data table", { exact: true }).click();
  await expect(page.getByRole("region", {name:"Chart data table"})).toContainText("10.0");
  await expect(page.getByRole("region", {name:"Chart data table"})).toContainText("30.0");
  for (const bad of [headers + '"unterminated', headers + "wrong,2026-10-05T00:00:00Z,seen"]) {
    await upload(page, bad);
    await expect(page.locator(".error-panel")).toBeVisible();
    await expect(page.locator(".error-panel")).toContainText("Previous analytical results have been cleared");
    await expect(page.locator(".kpi-grid")).toHaveCount(0);
    await expect(page.getByRole("button", {name:"Run Analysis",exact:true})).toBeDisabled();
  }
  expect(requests).toEqual([]);
});

test("late demo response cannot replace a newer uploaded source", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/demo/csv", async route => { await gate; await route.continue(); });
  await page.getByRole("button", {name:"Load Synthetic Demo"}).click();
  // Exercise the asynchronous replacement guard directly; the UI normally disables uploads while busy.
  await page.getByLabel("Upload CSV", {exact:true}).evaluate(el => el.removeAttribute("disabled"));
  await upload(page, headers + "new,2026-10-05T00:00:00Z,2026-10-05T00:05:00Z,seen", "new-source.csv");
  const finished = page.waitForResponse("**/demo/csv");
  release();
  await finished;
  await configure(page);
  await expect(page.locator(".data-top")).toContainText("new-source.csv");
  await expect(page.locator(".demo-notice")).toHaveCount(0);
  await expect(page.locator(".kpi-value").first()).toHaveText("1");
  await expect(page.getByLabel("Period A start")).toHaveValue("2026-10-05");
});

test("confirmation changes clear evidence and nonadjacent periods remain explicit", async ({ page }) => {
  await loadDemo(page);
  await page.getByRole("checkbox").uncheck();
  await expect(page.locator(".kpi-grid")).toHaveCount(0);
  await expect(page.getByRole("button", {name:"Run Analysis",exact:true})).toBeDisabled();
  await page.getByLabel("Period B start").fill("2026-10-26");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", {name:"Run Analysis",exact:true}).click();
  await expect(page.locator(".kpi-grid")).toContainText("Period A: 700 · Period B: 0");
  await expect(page.locator(".finding-panel")).toContainText("Median comparison unavailable");
  await expect(page.locator(".finding-panel")).toContainText("no eligible timing observations");
  await expect(page.locator(".finding-panel")).not.toContainText("Unavailable-minute");
  await expect(page.locator(".evidence-status")).not.toContainText("Unavailable min observed");
  await page.getByLabel("Period A start").fill("");
  await expect(page.locator(".kpi-grid")).toHaveCount(0);
  await expect(page.getByRole("button", {name:"Run Analysis",exact:true})).toBeDisabled();
});

test("mobile menu, touch targets and expanded evidence are keyboard accessible", async ({ page }) => {
  await page.setViewportSize({width:375,height:812});
  const menu = page.getByRole("button", {name:"Toggle navigation"});
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", {name:"FlowGuard AI Hospital Operations Intelligence"})).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded","false");
  const menuBox = await menu.boundingBox();
  expect(menuBox!.height).toBeGreaterThanOrEqual(44);
  expect(menuBox!.width).toBeGreaterThanOrEqual(44);
  await loadDemo(page);
  for (const label of ["View accessible data table","Timing exclusions and denominator evidence","Record-level diagnostics (nonexclusive)","Dataset identity, coverage & limitations"]) {
    const control = page.getByText(label,{exact:true});
    await control.focus();
    await page.keyboard.press("Enter");
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const table = page.getByRole("region",{name:"Chart data table"});
  await table.focus();
  await expect(table).toBeFocused();
  expect(await table.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe("solid");
  await page.keyboard.press("ArrowRight");
  await expect.poll(()=>table.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
  await expect(page.locator(".provenance")).toContainText("Not independently verified");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole("button",{name:"Daily counts",exact:true}).click();
  const bars=await page.locator(".day-bar").evaluateAll(els=>els.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})));
  expect(bars.every(b=>b.w>=44 && b.h>=44)).toBe(true);
  const last=page.getByRole("button",{name:"B, 2026-10-18: 100 supplied encounters",exact:true});
  await last.focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".chart-inspection")).toContainText("2026-10-18");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:375,height:568});
  await page.evaluate(()=>window.scrollTo(0,0));
  await menu.click();
  await page.getByRole("link",{name:"About",exact:true}).focus();
  await expect(page.getByRole("link",{name:"About",exact:true})).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
});
