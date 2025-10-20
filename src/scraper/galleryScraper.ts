// src/scraper/galleryScraper.ts
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PuppeteerDriver } from "./drivers/puppeteerDriver";
import { genericStrategy, nextButtonStrategy  } from "./strategies";
import { logStep } from "../utils/logger";
import { downloadToFile } from "../utils/network";
import { filenameFromUrl } from "../utils/filename";

export type ScrapeResult = {
  galleryName: string;
  totalFound: number;
  totalDownloaded: number;
  errors: string[];
};

export class GalleryScraper {
  constructor(
    private opts: {
      downloadDir: string;
      headless: boolean;
      skipExisting: boolean;
      maxPerGallery?: number;
      strategy?: string;
    }
  ) {}

  async scrape(url: string): Promise<ScrapeResult> {
    logStep("processing url", url);

    const driver = new PuppeteerDriver();
    await driver.launch(this.opts.headless);
    const page = await driver.newPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      const galleryName = await driver.getGalleryName(page, url);
      logStep("gallery name", galleryName);

      const galleryPath = resolve(this.opts.downloadDir, galleryName);
      logStep("creating folder", galleryName);
      mkdirSync(galleryPath, { recursive: true });

      let totalFound = 0;
      let totalDownloaded = 0;
      const errors: string[] = [];

      if (this.opts.strategy === "next") {
        // Your requested flow: click image -> HD -> download -> back -> #photobitrighta
        const res = await nextButtonStrategy(page, galleryPath, {
          maxPerGallery: this.opts.maxPerGallery,
          skipExisting: this.opts.skipExisting,
        });
        totalFound = res.totalFound;
        totalDownloaded = res.totalDownloaded;
        errors.push(...res.errors);
      } else {
        // Generic fallback: scan page and download largest seen
        await driver.autoScroll(page);
        const all = await genericStrategy(page);
        const limited = this.opts.maxPerGallery ? all.slice(0, this.opts.maxPerGallery) : all;

        for (const imgUrl of limited) {
          const fname = filenameFromUrl(imgUrl);
          if (this.opts.skipExisting && existsSync(resolve(galleryPath, fname))) {
            continue;
          }
          try {
            logStep("downloading image", fname);
            await downloadToFile(imgUrl, galleryPath, true);
            totalDownloaded++;
          } catch (e: any) {
            errors.push(`${fname} ← ${imgUrl} :: ${e?.message || e}`);
          }
        }
        totalFound = limited.length;
      }

      logStep(
        `total images downloaded for gallery '${galleryName}'`,
        totalDownloaded
      );

      return { galleryName, totalFound, totalDownloaded, errors };
    } finally {
      await driver.close();
    }
  }
}