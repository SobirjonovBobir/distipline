import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.SHOT_OUT || "/cursor/stores/bc-209370d1-cae0-44bd-9b77-53feee857bcb/media";
const EMAIL = `di13-mobile-${Date.now()}@example.com`;
const PASS = "testpass123";

await fs.mkdir(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

async function clickHas(page, selector, text) {
  const loc = page.locator(selector).filter({ hasText: text }).first();
  if ((await loc.count()) === 0) return false;
  await loc.click();
  await page.waitForTimeout(650);
  return true;
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  // Auth via request API so Set-Cookie is captured reliably
  const signup = await context.request.post(`${BASE}/api/auth/signup`, {
    data: { email: EMAIL, password: PASS, displayName: "DI13 Mobile" },
  });
  console.log("auth", signup.status(), await signup.json().catch(() => ({})));
  if (!signup.ok()) throw new Error("signup failed");

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(() => localStorage.setItem("distipline-install-dismiss", "1"));
  await page.waitForSelector(".app-frame", { timeout: 45000 });
  await page.waitForTimeout(500);

  const seed = await page.evaluate(async () => {
    const pad = (n) => String(n).padStart(2, "0");
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = new Date();
    const t = iso(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const statuses = [];
    for (const body of [
      { title: "Ertalab yugurish", scheduleType: "daily", startDate: t, notes: "DI-13" },
      { title: "Kitob o‘qish", scheduleType: "weekly", startDate: t, weekdays: "1,3,5", notes: "" },
      {
        title: "Ertangi reja",
        scheduleType: "once",
        startDate: iso(tomorrow),
        endDate: iso(tomorrow),
        notes: "",
      },
    ]) {
      statuses.push((await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status);
    }
    statuses.push(
      (
        await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: t, mood: "good", body: "Mobil UX sinovi", gratitude: "Sog‘lik" }),
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
            amount: 45000,
            category: "Oziq-ovqat",
            note: "Nonushta",
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
            kind: "income",
            amount: 2000000,
            category: "Maosh",
            note: "",
            occurredOn: t,
          }),
        })
      ).status,
    );
    statuses.push(
      (
        await fetch("/api/focus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "pomodoro",
            plannedSeconds: 1500,
            elapsedSeconds: 1500,
            status: "completed",
          }),
        })
      ).status,
    );
    return statuses;
  });
  console.log("seed", seed);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".app-frame", { timeout: 45000 });
  await page.waitForTimeout(900);

  await shot(page, "50-mobile-home.png");
  await clickHas(page, ".mobile-nav-btn", "Vazifa");
  await shot(page, "51-mobile-tasks.png");
  await clickHas(page, "button", "+ Yangi");
  await page.waitForTimeout(500);
  await shot(page, "52-mobile-task-sheet.png");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await clickHas(page, ".mobile-nav-btn", "Kal");
  await shot(page, "53-mobile-calendar.png");
  await clickHas(page, ".mobile-nav-btn", "Stat");
  await shot(page, "54-mobile-stats.png");
  await clickHas(page, ".mobile-nav-btn", "Ko‘proq");
  await shot(page, "55-mobile-more.png");
  await clickHas(page, ".more-item", "Pul");
  await page.waitForTimeout(700);
  await shot(page, "56-mobile-cash.png");
  await clickHas(page, ".mobile-nav-btn", "Ko‘proq");
  await clickHas(page, ".more-item", "Maslahat");
  await shot(page, "57-mobile-insights.png");
  await clickHas(page, ".mobile-nav-btn", "Ko‘proq");
  await clickHas(page, ".more-item", "Kundalik");
  await shot(page, "58-mobile-journal.png");
  await clickHas(page, ".mobile-nav-btn", "Ko‘proq");
  await clickHas(page, ".more-item", "Focus");
  await shot(page, "59-mobile-focus.png");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(".app-frame", { timeout: 45000 });
  await page.waitForTimeout(700);
  await shot(page, "60-desktop-home-spirit.png");
  console.log("done", EMAIL);
} finally {
  await browser.close();
}
