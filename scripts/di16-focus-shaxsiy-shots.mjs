import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.SHOT_OUT || "/cursor/stores/bc-209370d1-cae0-44bd-9b77-53feee857bcb/media";
const EMAIL = `di16-${Date.now()}@example.com`;
const PASS = "testpass123";

await fs.mkdir(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = { focusPause: false, personalFilter: false, eyeMask: false, errors: [] };

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => results.errors.push(String(e)));

  const signup = await context.request.post(`${BASE}/api/auth/signup`, {
    data: { email: EMAIL, password: PASS, displayName: "DI16 Test" },
  });
  console.log("auth", signup.status());
  if (!signup.ok()) throw new Error("signup failed");

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(() => localStorage.setItem("distipline-install-dismiss", "1"));
  await page.waitForSelector(".app-frame", { timeout: 45000 });

  // Seed: public task + personal task + personal cash
  const seed = await page.evaluate(async () => {
    const pad = (n) => String(n).padStart(2, "0");
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const t = iso(new Date());
    const catsRes = await fetch("/api/categories");
    const cats = (await catsRes.json()).categories || [];
    const personal = cats.find((c) => String(c.name).toLowerCase().includes("shaxsiy"));
    const ish = cats.find((c) => c.name === "Ish") || cats[0];
    const statuses = [];
    statuses.push(
      (
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Ochiq ish vazifasi",
            scheduleType: "once",
            startDate: t,
            endDate: t,
            categoryId: ish?.id || "",
            notes: "public",
          }),
        })
      ).status,
    );
    statuses.push(
      (
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Maxfiy shaxsiy vazifa",
            scheduleType: "once",
            startDate: t,
            endDate: t,
            categoryId: personal?.id || "",
            notes: "secret-note-999",
          }),
        })
      ).status,
    );
    statuses.push(
      (
        await fetch("/api/cash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "transaction",
            kind: "expense",
            amount: 777000,
            category: "Shaxsiy",
            note: "maxfiy xarajat",
            occurredOn: t,
          }),
        })
      ).status,
    );
    statuses.push(
      (
        await fetch("/api/cash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "transaction",
            kind: "expense",
            amount: 25000,
            category: "Oziq-ovqat",
            note: "non",
            occurredOn: t,
          }),
        })
      ).status,
    );
    return { statuses, personalId: personal?.id, cats: cats.map((c) => c.name) };
  });
  console.log("seed", seed);

  // Reload tasks for today
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-frame", { timeout: 45000 });
  await page.waitForTimeout(800);

  // --- Focus pause/resume ---
  await page.locator(".mobile-nav-btn").filter({ hasText: "Ko‘proq" }).click();
  await page.waitForTimeout(400);
  await page.locator(".more-item").filter({ hasText: "Focus" }).click();
  await page.waitForSelector(".focus-clock", { timeout: 15000 });
  await page.locator("button").filter({ hasText: "Boshlash" }).click();
  await page.waitForTimeout(2200);
  const runningText = await page.locator(".focus-clock").innerText();
  await page.locator("button").filter({ hasText: "Pauza" }).click();
  await page.waitForTimeout(400);
  const pausedText = await page.locator(".focus-clock").innerText();
  await page.waitForTimeout(1500);
  const stillPaused = await page.locator(".focus-clock").innerText();
  const resumeBtn = page.locator("button").filter({ hasText: "Davom etish" });
  const hasResume = (await resumeBtn.count()) > 0;
  await resumeBtn.click();
  await page.waitForTimeout(1200);
  const afterResume = await page.locator(".focus-clock").innerText();
  results.focusPause =
    runningText !== "25:00" &&
    pausedText === stillPaused &&
    pausedText !== "25:00" &&
    hasResume &&
    afterResume !== "25:00";
  console.log("focus", { runningText, pausedText, stillPaused, afterResume, hasResume, ok: results.focusPause });
  await shot(page, "61-mobile-focus-pause.png");

  // --- Tasks list should NOT show personal ---
  await page.locator(".mobile-nav-btn").filter({ hasText: "Vazifa" }).click();
  await page.waitForTimeout(700);
  const tasksBody = await page.locator(".mobile-tasks").innerText();
  results.personalFilter =
    tasksBody.includes("Ochiq ish vazifasi") && !tasksBody.includes("Maxfiy shaxsiy vazifa");
  console.log("tasks filter", results.personalFilter, tasksBody.slice(0, 200));
  await shot(page, "62-mobile-tasks-no-personal.png");

  // --- Cash list should NOT show personal tx ---
  await page.locator(".mobile-nav-btn").filter({ hasText: "Ko‘proq" }).click();
  await page.waitForTimeout(400);
  await page.locator(".more-item").filter({ hasText: "Pul" }).click();
  await page.waitForTimeout(800);
  await page.locator(".cash-tab").filter({ hasText: "Tarix" }).click();
  await page.waitForTimeout(500);
  const cashBody = await page.locator(".cash-module").innerText();
  const cashOk = cashBody.includes("Oziq-ovqat") && !cashBody.includes("maxfiy xarajat") && !/777\s?000/.test(cashBody);
  results.personalFilter = results.personalFilter && cashOk;
  console.log("cash filter", cashOk);
  await shot(page, "63-mobile-cash-no-personal.png");

  // --- Personal vault + eye ---
  await page.locator(".mobile-nav-btn").filter({ hasText: "Ko‘proq" }).click();
  await page.waitForTimeout(400);
  await page.locator(".more-item").filter({ hasText: "Shaxsiy" }).click();
  await page.waitForTimeout(900);
  await shot(page, "64-mobile-shaxsiy-hidden.png");
  const vaultHidden = await page.locator(".personal-vault").innerText();
  const hiddenHasBlur = (await page.locator(".personal-vault .privacy-mask").count()) > 0;
  await page.locator(".eye-toggle").click();
  await page.waitForTimeout(700);
  const vaultShown = await page.locator(".personal-vault").innerText();
  results.eyeMask =
    hiddenHasBlur &&
    vaultHidden.includes("Shaxsiy") &&
    vaultShown.includes("Maxfiy shaxsiy vazifa") &&
    (await page.locator(".personal-vault .privacy-mask").count()) === 0;
  console.log("eye", { hiddenHasBlur, eyeOk: results.eyeMask });
  await shot(page, "64b-mobile-shaxsiy-shown.png");

  console.log("RESULTS", JSON.stringify(results, null, 2));
  if (!results.focusPause || !results.personalFilter || !results.eyeMask) {
    process.exitCode = 2;
  }
} finally {
  await browser.close();
}
