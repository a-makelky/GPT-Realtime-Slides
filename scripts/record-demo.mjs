import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.DEMO_BASE_URL || "http://127.0.0.1:4173/";
const outputDir = resolve(process.env.DEMO_OUTPUT_DIR || "demo-output");
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outputDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const video = page.video();

await page.goto(baseUrl, { waitUntil: "networkidle" });
await hold(8_000);
await page.keyboard.press("ArrowRight");
await hold(7_000);
await page.keyboard.press("ArrowRight");
await hold(7_000);
await page.getByRole("button", { name: "Toggle speaker notes" }).click();
await hold(7_000);
await page.getByRole("button", { name: "Toggle speaker notes" }).click();

const command = page.getByRole("textbox", { name: "Deck command" });
await command.fill("go to slide 6");
await page.getByRole("button", { name: "Run command" }).click();
await hold(8_000);
await page.getByRole("button", { name: "Show live audience results" }).click();
await hold(13_000);
await page.getByRole("button", { name: "Close audience results" }).click();

await page.goto(new URL("participate?phase=entrance", baseUrl).href, { waitUntil: "networkidle" });
await hold(12_000);
await page.goto(baseUrl, { waitUntil: "networkidle" });
await command.fill("show audience results");
await page.getByRole("button", { name: "Run command" }).click();
await hold(10_000);
await page.getByRole("button", { name: "Close audience results" }).click();
await command.fill("go to slide 5");
await page.getByRole("button", { name: "Run command" }).click();
await hold(14_000);
await command.fill("go to slide 8");
await page.getByRole("button", { name: "Run command" }).click();
await hold(12_000);
await page.keyboard.press("End");
await hold(14_000);

await page.close();
await context.close();
await browser.close();
const recordedPath = await video.path();
console.log(recordedPath);

function hold(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
