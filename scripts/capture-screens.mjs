import puppeteer from "puppeteer-core";
import fs from "node:fs/promises";
import path from "node:path";

const OUT = process.argv[2] || "B:\\discipline-shots";
const BASE = "http://127.0.0.1:3000";
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
await fs.mkdir(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

async function login(page) {
  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(async () => {
    localStorage.setItem("distipline-install-dismiss", "1");
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "di9-cash@example.com", password: "testpass123" }),
    });
  });
  await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".app-frame", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 800));
}

async function clickText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = (await page.evaluate((el) => el.textContent || "", h)).trim();
    if (t.includes(text)) {
      await h.click();
      await new Promise((r) => setTimeout(r, 700));
      return true;
    }
  }
  return false;
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900 },
  userDataDir: "B:\\chrome-disc-profile",
});

try {
  const page = await browser.newPage();
  await login(page);
  await shot(page, "30-desktop-home.png");
  await clickText(page, ".nav-item", "Vazifalar");
  await shot(page, "31-desktop-tasks.png");
  const created = await clickText(page, "button", "+ Yangi") || (await clickText(page, "button", "Yangi"));
  if (created) {
    await new Promise((r) => setTimeout(r, 400));
    await shot(page, "32-desktop-task-sheet.png");
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 300));
  }
  await clickText(page, ".nav-item", "Statistika");
  await shot(page, "33-desktop-stats.png");
  await clickText(page, ".nav-item", "Pul nazorati");
  await new Promise((r) => setTimeout(r, 900));
  await shot(page, "34-desktop-cash.png");

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector(".app-frame", { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 800));
  await shot(page, "35-mobile-home-nav.png");
  await clickText(page, ".mobile-nav-btn", "Vazifa");
  await shot(page, "36-mobile-tasks.png");
  await clickText(page, ".mobile-nav-btn", "Kal");
  await shot(page, "37-mobile-calendar.png");
  await clickText(page, ".mobile-nav-btn", "Stat");
  await shot(page, "38-mobile-stats.png");
  await clickText(page, ".mobile-nav-btn", "Ko‘proq");
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, "39-mobile-more.png");
  await clickText(page, ".more-item", "Pul");
  await new Promise((r) => setTimeout(r, 900));
  await shot(page, "40-mobile-cash.png");
  await clickText(page, ".mobile-nav-btn", "Ko‘proq");
  await clickText(page, ".more-item", "Focus");
  await new Promise((r) => setTimeout(r, 500));
  await shot(page, "41-mobile-focus.png");
  await clickText(page, ".mobile-nav-btn", "Ko‘proq");
  await clickText(page, ".more-item", "Sozlamalar");
  await new Promise((r) => setTimeout(r, 500));
  await shot(page, "42-mobile-settings-notify.png");
} finally {
  await browser.close();
}
console.log("done");
