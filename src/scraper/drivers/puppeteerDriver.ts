// src/scraper/drivers/puppeteerDriver.ts
import puppeteer, { Browser, Page } from "puppeteer";
import { pageSleep } from "../../utils/wait";


export class PuppeteerDriver {
  private browser!: Browser;

  async launch(headless: boolean = true) {
    const executablePath = this.findChromeExecutable();

    this.browser = await puppeteer.launch({
        executablePath,
      headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }

  async newPage(): Promise<Page> {
    if (!this.browser) throw new Error("Browser not launched");
    const page = await this.browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    // Be a bit generous with timeouts
    page.setDefaultNavigationTimeout(45_000);
    page.setDefaultTimeout(30_000);
    return page;
  }

  async close() {
    if (this.browser) await this.browser.close();
  }

  // Scrolls down until no new content appears (for lazy/infinite grids)
  async autoScroll(page: Page, maxSteps = 20, stepPx = 1500, waitMs = 700) {
    let lastHeight = await page.evaluate("document.body.scrollHeight");
    for (let i = 0; i < maxSteps; i++) {
      await page.evaluate((px) => window.scrollBy(0, px), stepPx);
      await pageSleep(page, waitMs);
      const newHeight = await page.evaluate("document.body.scrollHeight");
      if (newHeight === lastHeight) break;
      lastHeight = newHeight;
    }
  }

  async getGalleryName(page: Page, fallbackUrl: string) {
    // Try og:title → h1 → title → URL segment
    // commented as I prefer the h1 title for my test case
    // const og = await page.$eval('meta[property="og:title"]', el => (el as HTMLMetaElement).content).catch(() => null);
    // if (og && og.trim()) return sanitizeName(og);

    const h1 = await page.$eval('h1', el => (el.textContent || "").trim()).catch(() => null);
    if (h1 && h1.trim()) return sanitizeName(h1);

    const title = await page.title().catch(() => "");
    if (title && title.trim()) return sanitizeName(title);

    try {
      const u = new URL(fallbackUrl);
      const parts = u.pathname.split("/").filter(Boolean);
      const last = parts.pop() || u.hostname;
      return sanitizeName(decodeURIComponent(last));
    } catch {
      return sanitizeName(fallbackUrl.replace(/https?:\/\//, ""));
    }
  }


  /**
   * Try to find Chrome executable in common locations
   */
  private findChromeExecutable(): string {
    const platform = process.platform;

    // Common Chrome/Chromium paths by platform
    const executablePaths: { [key: string]: string[] } = {
      darwin: [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
      ],
      win32: [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Chromium\\Application\\chrome.exe",
      ],
      linux: [
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome-stable",
      ],
    };

    const paths = executablePaths[platform] || executablePaths.linux;
    console.log("🚀 Chrome Executable Paths:", paths);

    // Try to find an existing Chrome installation
    const fs = require("fs");
    for (const path of paths) {
      try {
        if (fs.existsSync(path)) {
          console.log(`Found Chrome at: ${path}`);
          console.log("🚀 Existing:", path);
          return path;
        }
      } catch (e) {
        // Continue to next path
      }
    }

    throw new Error(
      `Chrome/Chromium executable not found. Please either:\n` +
        `1. Install Google Chrome or Chromium\n` +
        `2. Install 'puppeteer' package: npm install puppeteer --save-dev\n` +
        `3. Specify executablePath in PDFGeneratorConfig:\n` +
        `   new PDFGenerator({ puppeteer: { executablePath: '/path/to/chrome' } })`
    );
  }

}

function sanitizeName(s: string) {
  const cleaned = s.replace(/[<>:"/\\|?*\x00-\x1F]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 120);
}
