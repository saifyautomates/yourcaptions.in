/**
 * ProjectView controls smoke — yourcaptions.com
 *
 * Verifies from a fresh ProjectView load that the core video overlay
 * controls all respond:
 *   1. Replace media button opens the OS file chooser.
 *   2. Three-dot "More tools" toggle reveals the extra chips (Sync / Fit / Margin / Debug / Download).
 *   3. Play/Pause button flips its aria-label + <video>.paused state.
 *   4. Voice mute/unmute button flips its aria-label + <video>.muted state.
 *   5. Fullscreen button click fires without a console error.
 *
 * Every test reloads the ProjectView route first so we're always exercising
 * the initial mount, not stale state from a previous scenario.
 *
 * Required env:
 *   BASE_URL          – defaults to https://yourcaptions.com
 *   TEST_EMAIL        – account with at least one project
 *   TEST_PASSWORD     – password for TEST_EMAIL
 * Optional env:
 *   TEST_PROJECT_ID   – skip project discovery and jump straight to this id
 *
 * Run:
 *   BASE_URL=... TEST_EMAIL=... TEST_PASSWORD=... \
 *     npx playwright test tests/e2e/project-view-controls.spec.ts
 */
import { test, expect, Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://yourcaptions.com";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID ?? "";

const HAVE_CREDS = Boolean(TEST_EMAIL && TEST_PASSWORD);

async function signIn(page: Page) {
  await page.goto(`${BASE_URL}/signin`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/you@example\.com/i).fill(TEST_EMAIL);
  await page.getByPlaceholder(/your password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard(?!\/project)/, { timeout: 20_000 });
}

async function resolveProjectUrl(page: Page): Promise<string> {
  if (TEST_PROJECT_ID) return `${BASE_URL}/dashboard/project/${TEST_PROJECT_ID}`;

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
  // Click the first project card — Dashboard.tsx wires the whole card
  // to `navigate(/dashboard/project/:id)`, so clicking it is enough.
  const firstCard = page.locator("[role='button'], button").filter({ hasText: /./ }).first();
  await page.waitForURL(/\/dashboard\/project\/[^/]+/, { timeout: 15_000 }).catch(() => {});
  if (!/\/dashboard\/project\//.test(page.url())) {
    // Fall back: any anchor/card leading into a project route.
    const card = page
      .locator("a[href*='/dashboard/project/'], [data-project-id]")
      .first();
    if (await card.count()) {
      await card.click();
    } else {
      await firstCard.click({ trial: false }).catch(() => {});
    }
    await page.waitForURL(/\/dashboard\/project\/[^/]+/, { timeout: 15_000 });
  }
  return page.url();
}

async function openProjectFresh(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  // Wait for the video element to attach — controls are only meaningful once it mounts.
  await page.locator("video").first().waitFor({ state: "attached", timeout: 20_000 });
  // Wait for either play/pause button to appear (bottom control bar mounted).
  await expect(
    page.getByRole("button", { name: /play video|pause video/i }).first(),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("ProjectView video controls", () => {
  test.skip(!HAVE_CREDS, "TEST_EMAIL / TEST_PASSWORD not set");

  let projectUrl = "";

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page);
    projectUrl = await resolveProjectUrl(page);
    await ctx.storageState({ path: "tests/e2e/.project-view-auth.json" });
    await ctx.close();
  });

  test.beforeEach(async ({ browser }, testInfo) => {
    testInfo.attach; // no-op, keeps types happy
    // Re-use the saved storage state so each test runs against a *fresh* load.
    // We attach it via context reuse in each test's own fixture below.
  });

  async function newAuthedPage(browser: import("@playwright/test").Browser) {
    const ctx = await browser.newContext({ storageState: "tests/e2e/.project-view-auth.json" });
    const page = await ctx.newPage();
    // Surface any page errors so a failing control is easy to diagnose.
    page.on("pageerror", (err) => console.error("[pageerror]", err.message));
    return { ctx, page };
  }

  test("replace media button opens the OS file chooser", async ({ browser }) => {
    const { ctx, page } = await newAuthedPage(browser);
    try {
      await openProjectFresh(page, projectUrl);
      const replaceBtn = page.getByRole("button", { name: /^replace media$/i });
      await expect(replaceBtn).toBeVisible();
      const chooser = page.waitForEvent("filechooser", { timeout: 5_000 });
      await replaceBtn.click();
      const fc = await chooser;
      expect(fc, "expected replace to trigger a file chooser").toBeTruthy();
    } finally {
      await ctx.close();
    }
  });

  test("three-dot 'More tools' toggle reveals the extra chips", async ({ browser }) => {
    const { ctx, page } = await newAuthedPage(browser);
    try {
      await openProjectFresh(page, projectUrl);
      const kebab = page.getByRole("button", { name: /^more tools$/i });
      await expect(kebab).toBeVisible();

      // Chips are absent before the toggle.
      await expect(page.getByRole("button", { name: /^sync smoothing$/i })).toHaveCount(0);
      await kebab.click();
      // At least the Sync chip must appear once the menu opens.
      await expect(page.getByRole("button", { name: /^sync smoothing$/i })).toBeVisible();
      // Close again → chips gone.
      await kebab.click();
      await expect(page.getByRole("button", { name: /^sync smoothing$/i })).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test("play/pause toggles both aria-label and <video>.paused", async ({ browser }) => {
    const { ctx, page } = await newAuthedPage(browser);
    try {
      await openProjectFresh(page, projectUrl);
      const video = page.locator("video").first();
      // The video starts paused.
      expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);

      const playBtn = page.getByRole("button", { name: /^play video$/i }).first();
      await expect(playBtn).toBeVisible();
      await playBtn.click();

      // aria-label flips to "Pause video" once playback starts.
      await expect(
        page.getByRole("button", { name: /^pause video$/i }).first(),
      ).toBeVisible({ timeout: 5_000 });
      await expect
        .poll(async () => video.evaluate((v: HTMLVideoElement) => v.paused), { timeout: 5_000 })
        .toBe(false);

      // Toggle back.
      await page.getByRole("button", { name: /^pause video$/i }).first().click();
      await expect(
        page.getByRole("button", { name: /^play video$/i }).first(),
      ).toBeVisible({ timeout: 5_000 });
      await expect
        .poll(async () => video.evaluate((v: HTMLVideoElement) => v.paused), { timeout: 5_000 })
        .toBe(true);
    } finally {
      await ctx.close();
    }
  });

  test("voice mute/unmute toggles both aria-label and <video>.muted", async ({ browser }) => {
    const { ctx, page } = await newAuthedPage(browser);
    try {
      await openProjectFresh(page, projectUrl);
      const video = page.locator("video").first();
      const initial = await video.evaluate((v: HTMLVideoElement) => v.muted);

      // Whatever the starting state, the button's aria-label must match.
      const startName = initial ? /^unmute video$/i : /^mute video$/i;
      const flippedName = initial ? /^mute video$/i : /^unmute video$/i;

      const btn = page.getByRole("button", { name: startName });
      await expect(btn).toBeVisible();
      await btn.click();

      await expect(page.getByRole("button", { name: flippedName })).toBeVisible({ timeout: 5_000 });
      await expect
        .poll(async () => video.evaluate((v: HTMLVideoElement) => v.muted), { timeout: 5_000 })
        .toBe(!initial);

      // Flip back — leaves the project in its original mute state.
      await page.getByRole("button", { name: flippedName }).click();
      await expect(page.getByRole("button", { name: startName })).toBeVisible({ timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });

  test("fullscreen button click fires without a console/page error", async ({ browser }) => {
    const { ctx, page } = await newAuthedPage(browser);
    const consoleErrors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    try {
      await openProjectFresh(page, projectUrl);
      const btn = page.getByRole("button", { name: /^fullscreen$|^exit fullscreen$/i });
      await expect(btn).toBeVisible();
      await btn.click();
      // Headless Chromium often rejects requestFullscreen, but the handler
      // must not throw a runtime error — that's what we're validating.
      await page.waitForTimeout(300);

      const runtime = pageErrors.filter((m) => /fullscreen|is not a function|undefined/i.test(m));
      expect(runtime, `page errors: ${runtime.join(" | ")}`).toEqual([]);
      const runtimeConsole = consoleErrors.filter(
        (m) => /uncaught|typeerror|referenceerror/i.test(m),
      );
      expect(runtimeConsole, `console errors: ${runtimeConsole.join(" | ")}`).toEqual([]);
    } finally {
      await ctx.close();
    }
  });

  test("every control leaves editor state consistent (label + enabled + media)", async ({ browser }) => {
    const { ctx, page } = await newAuthedPage(browser);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    try {
      await openProjectFresh(page, projectUrl);
      const video = page.locator("video").first();

      const readState = () =>
        video.evaluate((v: HTMLVideoElement) => ({
          paused: v.paused,
          muted: v.muted,
          readyState: v.readyState,
          currentTime: v.currentTime,
        }));

      // ─── Play / Pause ────────────────────────────────────────────────
      const playBtn = page.getByRole("button", { name: /^play video$/i }).first();
      await expect(playBtn).toBeVisible();
      await expect(playBtn).toBeEnabled();
      const before = await readState();
      expect(before.paused).toBe(true);

      await playBtn.click();
      const pauseBtn = page.getByRole("button", { name: /^pause video$/i }).first();
      await expect(pauseBtn).toBeVisible({ timeout: 5_000 });
      await expect(pauseBtn).toBeEnabled();
      await expect
        .poll(async () => (await readState()).paused, { timeout: 5_000 })
        .toBe(false);
      // Playback actually advanced the media clock.
      await page.waitForTimeout(400);
      await expect
        .poll(async () => (await readState()).currentTime, { timeout: 3_000 })
        .toBeGreaterThan(before.currentTime);

      await pauseBtn.click();
      await expect(page.getByRole("button", { name: /^play video$/i }).first())
        .toBeVisible({ timeout: 5_000 });
      await expect
        .poll(async () => (await readState()).paused, { timeout: 5_000 })
        .toBe(true);
      const stopped = (await readState()).currentTime;
      await page.waitForTimeout(400);
      expect((await readState()).currentTime).toBeCloseTo(stopped, 1);

      // ─── Mute / Unmute ───────────────────────────────────────────────
      const initialMuted = (await readState()).muted;
      const muteName = initialMuted ? /^unmute video$/i : /^mute video$/i;
      const flipped = initialMuted ? /^mute video$/i : /^unmute video$/i;

      const muteBtn = page.getByRole("button", { name: muteName });
      await expect(muteBtn).toBeVisible();
      await expect(muteBtn).toBeEnabled();
      await muteBtn.click();
      await expect(page.getByRole("button", { name: flipped })).toBeVisible({ timeout: 5_000 });
      await expect
        .poll(async () => (await readState()).muted, { timeout: 5_000 })
        .toBe(!initialMuted);

      await page.getByRole("button", { name: flipped }).click();
      await expect(page.getByRole("button", { name: muteName })).toBeVisible({ timeout: 5_000 });
      await expect
        .poll(async () => (await readState()).muted, { timeout: 5_000 })
        .toBe(initialMuted);

      // ─── Fullscreen ──────────────────────────────────────────────────
      const fsBtn = page.getByRole("button", { name: /^fullscreen$|^exit fullscreen$/i });
      await expect(fsBtn).toBeVisible();
      await expect(fsBtn).toBeEnabled();
      const fsBefore = await page.evaluate(() => !!document.fullscreenElement);
      await fsBtn.click();
      await page.waitForTimeout(400);
      const fsAfter = await page.evaluate(() => !!document.fullscreenElement);
      // The button's label must match document.fullscreenElement — even when
      // headless Chromium rejects the request (state simply doesn't change).
      const expectedName = fsAfter ? /^exit fullscreen$/i : /^fullscreen$/i;
      await expect(page.getByRole("button", { name: expectedName })).toBeVisible();
      if (fsAfter && !fsBefore) {
        await page.getByRole("button", { name: /^exit fullscreen$/i }).click();
        await page.waitForTimeout(200);
      }

      // ─── Replace media (idle → enabled, not currently uploading) ─────
      const replaceBtn = page.getByRole("button", { name: /^replace media$/i });
      await expect(replaceBtn).toBeVisible();
      await expect(replaceBtn).toBeEnabled();

      // ─── Three-dot / More tools ──────────────────────────────────────
      const kebab = page.getByRole("button", { name: /^more tools$/i });
      await expect(kebab).toBeVisible();
      await expect(kebab).toBeEnabled();
      await expect(page.getByRole("button", { name: /^sync smoothing$/i })).toHaveCount(0);
      await kebab.click();
      await expect(page.getByRole("button", { name: /^sync smoothing$/i })).toBeVisible();
      await kebab.click();
      await expect(page.getByRole("button", { name: /^sync smoothing$/i })).toHaveCount(0);

      const runtime = pageErrors.filter((m) => /is not a function|undefined|typeerror/i.test(m));
      expect(runtime, `page errors: ${runtime.join(" | ")}`).toEqual([]);
    } finally {
      await ctx.close();
    }
  });

  // ─── Per-chip verification ───────────────────────────────────────────
  // Each chip revealed by the three-dot "More tools" toggle is checked
  // for the specific UI change or network request it is supposed to
  // trigger. Chips are opened fresh for every scenario so we test the
  // real hover → open → interact flow, not stale state.
  test("three-dot chip: Sync opens the offset/drift popover and reflects value in chip label", async ({ browser }) => {
    const { ctx, page } = await newAuthedPage(browser);
    try {
      await openProjectFresh(page, projectUrl);
      await page.getByRole("button", { name: /^more tools$/i }).click();

      const sync = page.getByRole("button", { name: /^sync smoothing$/i });
      await expect(sync).toBeVisible();
      await sync.click();
      // Popover title.
      await expect(page.getByText(/^Sync smoothing$/)).toBeVisible();

      // Enable + change offset via the range slider.
      const enable = page.locator("input[type='checkbox']").first();
      if (!(await enable.isChecked())) await enable.check();
      const offset = page.locator("input[type='range']").first();
      await offset.evaluate((el: HTMLInputElement) => {
        el.value = "120";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      // Chip label should now embed the offset (e.g. "Sync +120ms").
      await expect(sync).toContainText(/Sync\s*\+?120ms/i, { timeout: 3_000 });
    } finally {
      await ctx.close();
    }
  });

  test("three-dot chip: Fit toggles fit-to-video state (class flips between active / inactive)", async ({ browser }) => {
    const { ctx, page } = await newAuthedPage(browser);
    try {
      await openProjectFresh(page, projectUrl);
      await page.getByRole("button", { name: /^more tools$/i }).click();

      const fit = page.getByRole("button", { name: /^toggle fit to video$/i });
      await expect(fit).toBeVisible();
      const initialTitle = (await fit.getAttribute("title")) ?? "";
      const initialActive = /Fit to video:\s*ON/i.test(initialTitle);
      await fit.click();
      // Title must flip ON⇄OFF after the click.
      await expect
        .poll(async () => /Fit to video:\s*ON/i.test((await fit.getAttribute("title")) ?? ""), {
          timeout: 3_000,
        })
        .toBe(!initialActive);
      // Flip back so the project is left in its original state.
      await fit.click();
    } finally {
      await ctx.close();
    }
  });

  test("three-dot chip: Margin opens slider and updates the chip label", async ({ browser }) => {
    const { ctx, page } = await newAuthedPage(browser);
    try {
      await openProjectFresh(page, projectUrl);
      await page.getByRole("button", { name: /^more tools$/i }).click();

      const margin = page.getByRole("button", { name: /^safe margin$/i });
      await expect(margin).toBeVisible();
      const startText = (await margin.textContent()) ?? "";
      await margin.click();

      // Popover slider (input[type=range] scoped inside the margin popover).
      const slider = page.locator("input[type='range']").last();
      await expect(slider).toBeVisible();
      await slider.evaluate((el: HTMLInputElement) => {
        el.value = "12";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await expect(margin).toContainText(/Margin\s*12%/, { timeout: 3_000 });
      expect(startText).not.toMatch(/Margin\s*12%/);
    } finally {
      await ctx.close();
    }
  });

  test("three-dot chip: Debug toggles the on-canvas debug overlay", async ({ browser }) => {
    const { ctx, page } = await newAuthedPage(browser);
    try {
      await openProjectFresh(page, projectUrl);
      await page.getByRole("button", { name: /^more tools$/i }).click();

      const debug = page.getByRole("button", { name: /^toggle debug overlay$/i });
      await expect(debug).toBeVisible();
      // Overlay text ("margin X% · fit …") is only rendered when the flag is on.
      const overlayLine = page.getByText(/margin\s+\d+%\s*·\s*fit\s+(on|off)/i);
      await expect(overlayLine).toHaveCount(0);
      await debug.click();
      await expect(overlayLine.first()).toBeVisible({ timeout: 3_000 });
      await debug.click();
      await expect(overlayLine).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test("three-dot chip: Download triggers export (meter-export request or in-flight UI)", async ({ browser }) => {
    const { ctx, page } = await newAuthedPage(browser);
    try {
      await openProjectFresh(page, projectUrl);
      await page.getByRole("button", { name: /^more tools$/i }).click();

      const dl = page.getByRole("button", { name: /^download captioned video$/i });
      await expect(dl).toBeVisible();
      await expect(dl).toBeEnabled();

      // Two acceptable signals that the chip is wired:
      //   1. a network request to the export gating function, or
      //   2. the chip enters its in-flight state (aria-busy / "Exporting…").
      const netFired = page
        .waitForRequest((req) => /\/functions\/v1\/meter-export/.test(req.url()), {
          timeout: 6_000,
        })
        .then(() => "net" as const)
        .catch(() => null);
      const uiFlipped = page
        .waitForFunction(
          () => {
            const b = document.querySelector(
              'button[aria-label="Download captioned video"]',
            ) as HTMLButtonElement | null;
            return !!b && (b.getAttribute("aria-busy") === "true" || /exporting/i.test(b.textContent ?? ""));
          },
          undefined,
          { timeout: 6_000 },
        )
        .then(() => "ui" as const)
        .catch(() => null);

      await dl.click();
      const signal = await Promise.race([netFired, uiFlipped]);
      expect(signal, "expected Download chip to either fire meter-export or show an in-flight state").not.toBeNull();
    } finally {
      await ctx.close();
    }
  });

  test("Download chip: click triggers a download and surfaces a success or error toast", async ({ browser }) => {
    const { ctx, page } = await newAuthedPage(browser);
    try {
      await openProjectFresh(page, projectUrl);
      await page.getByRole("button", { name: /^more tools$/i }).click();

      const dl = page.getByRole("button", { name: /^download captioned video$/i });
      await expect(dl).toBeVisible();
      await expect(dl).toBeEnabled();

      // Signal 1: an actual browser download event (file save-as fired).
      const downloadEvt = page
        .waitForEvent("download", { timeout: 60_000 })
        .then((d) => ({ kind: "download" as const, name: d.suggestedFilename() }))
        .catch(() => null);

      // Signal 2: a Sonner success toast (e.g. "Downloaded", "Exported", "Rendered").
      const successToast = page
        .locator('[data-sonner-toast][data-type="success"]')
        .filter({ hasText: /download|export|render|saved/i })
        .first()
        .waitFor({ state: "visible", timeout: 60_000 })
        .then(() => ({ kind: "success" as const }))
        .catch(() => null);

      // Signal 3: a Sonner error toast (out of credits, meter failure, etc.) —
      // still counts as the UI having reached a terminal, user-visible state.
      const errorToast = page
        .locator('[data-sonner-toast][data-type="error"]')
        .first()
        .waitFor({ state: "visible", timeout: 60_000 })
        .then(async (h) => {
          const text = (await page.locator('[data-sonner-toast][data-type="error"]').first().innerText()).trim();
          return { kind: "error" as const, text };
        })
        .catch(() => null);

      // Meanwhile, verify the chip enters an in-flight state right after the click.
      const inflight = page
        .waitForFunction(
          () => {
            const b = document.querySelector(
              'button[aria-label="Download captioned video"]',
            ) as HTMLButtonElement | null;
            return !!b && (b.getAttribute("aria-busy") === "true" || /exporting|rendering|preparing/i.test(b.textContent ?? ""));
          },
          undefined,
          { timeout: 10_000 },
        )
        .then(() => true)
        .catch(() => false);

      await dl.click();

      // The chip should visibly acknowledge the click before any terminal state resolves.
      expect(await inflight, "Download chip never entered an in-flight state after click").toBe(true);

      const result = await Promise.race([downloadEvt, successToast, errorToast]);
      expect(
        result,
        "expected Download click to end in a browser download, a success toast, or an explicit error toast",
      ).not.toBeNull();

      if (result?.kind === "download") {
        expect(result.name, "download filename should be non-empty").toBeTruthy();
      }
      if (result?.kind === "error") {
        // Error toasts must carry a human-readable reason, not an empty bubble.
        expect(result.text.length, "error toast should have descriptive text").toBeGreaterThan(0);
      }

      // Regardless of success or error, the chip must eventually leave its in-flight state
      // so the user can retry — no permanently-stuck spinner.
      await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const b = document.querySelector(
                'button[aria-label="Download captioned video"]',
              ) as HTMLButtonElement | null;
              return b?.getAttribute("aria-busy") ?? "false";
            }),
          { timeout: 90_000 },
        )
        .not.toBe("true");
    } finally {
      await ctx.close();
    }
  });

  test("Download chip: downloads the expected media with the correct export filename", async ({ browser }) => {
    // Filename rule (see src/lib/quickExport.ts):
    //   `${(title || "captioned-video").replace(/[^\w\-]+/g, "_")}-${resolution}.mp4`
    // The chip in the More-tools tray fires the default 1-click 1080p export.
    const sanitize = (t: string) => (t || "captioned-video").replace(/[^\w\-]+/g, "_");

    const { ctx, page } = await newAuthedPage(browser);
    try {
      await openProjectFresh(page, projectUrl);

      // Read the visible project title from the TopBar <h1>, then compute the
      // expected filename so the assertion has zero coupling to internal state.
      const rawTitle = (await page.locator("h1").first().innerText()).trim();
      const title = rawTitle && rawTitle !== "Untitled" ? rawTitle : "captioned-video";
      const expectedName = `${sanitize(title)}-1080p.mp4`;
      const expectedRegex = new RegExp(`^${sanitize(title)}-1080p\\.mp4$`);

      await page.getByRole("button", { name: /^more tools$/i }).click();
      const dl = page.getByRole("button", { name: /^download captioned video$/i });
      await expect(dl).toBeVisible();
      await expect(dl).toBeEnabled();

      // Real encodes can take a while; the download event fires as soon as
      // triggerDownload() creates the object-URL anchor click.
      const downloadPromise = page.waitForEvent("download", { timeout: 180_000 });
      await dl.click();

      const download = await downloadPromise;
      const suggested = download.suggestedFilename();

      // 1) Naming rules — sanitized title + resolution + .mp4 extension.
      expect(suggested, `suggested filename '${suggested}' should end in .mp4`).toMatch(/\.mp4$/i);
      expect(suggested, `suggested filename '${suggested}' should carry -1080p tag`).toMatch(/-1080p\.mp4$/i);
      expect(suggested, `filename should contain no unsanitised chars`).toMatch(/^[\w\-]+\.mp4$/);
      expect(suggested).toMatch(expectedRegex);
      expect(suggested).toBe(expectedName);

      // 2) The download must resolve to a real, non-empty MP4 payload on disk.
      const savePath = `/tmp/browser/download-${Date.now()}.mp4`;
      await download.saveAs(savePath);
      const size = await page.evaluate(() => 0); // no-op to keep parity
      const fs = await import("node:fs/promises");
      const stat = await fs.stat(savePath);
      expect(size).toBe(0);
      expect(stat.size, "downloaded file should be non-empty").toBeGreaterThan(1024);

      // 3) Sanity-check the container: MP4 files start with an 'ftyp' box at offset 4.
      const fh = await fs.open(savePath, "r");
      const head = Buffer.alloc(12);
      await fh.read(head, 0, 12, 0);
      await fh.close();
      expect(head.slice(4, 8).toString("ascii"), `first bytes were ${head.toString("hex")}`).toBe("ftyp");
    } finally {
      await ctx.close();
    }
  });
});
