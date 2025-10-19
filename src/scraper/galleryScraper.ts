// src/scraper/galleryScraper.ts
import { logStep } from "../utils/logger";

export type ScrapeResult = {
  galleryName: string;
  totalFound: number;
  totalDownloaded: number;
  errors: string[];
};

export class GalleryScraper {
  // Later we’ll inject Puppeteer browser/page here
  constructor(private opts: {
    downloadDir: string;
    headless: boolean;
    skipExisting: boolean;
    maxPerGallery?: number;
  }) {}

  async scrape(url: string): Promise<ScrapeResult> {
    // ---- STUB IMPLEMENTATION ----
    // Derive a fake gallery name from URL for now (to demonstrate logs)
    const galleryName = this.deriveNameFromUrl(url);

    logStep("processing url", url);
    logStep("gallery name", galleryName);
    logStep("creating folder", galleryName);

    // Simulate downloading a few images
    const fakeImages = ["img_123456.jpg", "img_123457.jpg", "img_123458.jpg"];
    for (const img of fakeImages) {
      logStep("downloading image", img);
      await this.sleep(100); // simulate time per image
    }

    const result: ScrapeResult = {
      galleryName,
      totalFound: fakeImages.length,
      totalDownloaded: fakeImages.length,
      errors: [],
    };

    logStep(
      `total images downloaded for gallery '${galleryName}'`,
      result.totalDownloaded
    );

    return result;
  }

  // ------------- helpers -------------
  private deriveNameFromUrl(url: string): string {
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] || u.hostname;
      return decodeURIComponent(last).replace(/[_-]/g, " ");
    } catch {
      // If URL parsing fails, fall back to raw string sanitized
      return url.replace(/https?:\/\//, "").replace(/[/?#].*$/, "");
    }
  }

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}
