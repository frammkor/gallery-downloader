// src/scraper/galleryScraper.ts
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PuppeteerDriver } from "./drivers/puppeteerDriver";
import { discoverImageUrls } from "./strategies/genericStrategy";
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

      // Load as much content as possible
      await driver.autoScroll(page);

      // Discover candidate image URLs
      const all = await discoverImageUrls(page);
      console.log("🚀 ~ galleryScraper.ts:49 ~ GalleryScraper ~ scrape ~ all:", all)
      const limited = this.opts.maxPerGallery ? all.slice(0, this.opts.maxPerGallery) : all;

      let downloaded = 0;
      const errors: string[] = [];

      for (const imgUrl of limited) {
        const fname = filenameFromUrl(imgUrl);
        // If skipping existing, check first
        if (this.opts.skipExisting && existsSync(resolve(galleryPath, fname))) {
          continue;
        }

        try {
          logStep("downloading image", fname);
        //   await downloadToFile(imgUrl, galleryPath, true);
          downloaded++;
        } catch (e: any) {
          errors.push(`${fname} ← ${imgUrl} :: ${e?.message || e}`);
        }
      }

      logStep(
        `total images downloaded for gallery '${galleryName}'`,
        downloaded
      );

      return {
        galleryName,
        totalFound: limited.length,
        totalDownloaded: downloaded,
        errors,
      };
    } finally {
      await driver.close();
    }
  }
}
