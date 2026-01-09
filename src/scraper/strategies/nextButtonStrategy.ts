import type { Page } from "puppeteer";
import { pageSleep } from "../../utils/wait";
import { downloadToFile } from "../../utils/network";
import { filenameFromUrl } from "../../utils/filename";
import { logStep } from "../../utils/logger";

/** Resolve absolute URL safely. */
function toAbsoluteUrl(u: string, base: string): string | null {
  try {
    if (u.startsWith("//")) return new URL(`https:${u}`).toString();
    return new URL(u, base).toString();
  } catch {
    return null;
  }
}

/** Extract the HD image href from the parent anchor of the main photo. */
async function getHdHref(page: Page): Promise<string | null> {
  const base = page.url();
  const href = await page.evaluate(() => {
    // primary: <a class="photohref"><img class="mainphoto"/></a>
    const a1 = document.querySelector('a.photohref[href] > img.mainphoto')?.parentElement as HTMLAnchorElement | null;
    if (a1 && a1.href) return a1.getAttribute("href");

    // tolerate class typo: mainfoto
    const a2 = document.querySelector('a.photohref[href] > img.mainfoto')?.parentElement as HTMLAnchorElement | null;
    if (a2 && a2.href) return a2.getAttribute("href");

    // fallback: any img.mainphoto/mainfoto and closest anchor
    const img = (document.querySelector('img.mainphoto') || document.querySelector('img.mainfoto')) as HTMLImageElement | null;
    const a3 = img?.closest("a[href]") as HTMLAnchorElement | null;
    if (a3 && a3.href) return a3.getAttribute("href");

    return null;
  });

  if (!href) return null;
  return toAbsoluteUrl(href, base);
}

/** Click the “Next” button (id="photobitrighta"). Returns false if not found. */
async function clickNext(page: Page): Promise<boolean> {
  const next = await page.$('#photobitrighta');
  if (!next) return false;
  await next.click({ delay: 20 });
  return true;
}

/** Wait until the HD href changes (or time out). */
async function waitForHdHrefChange(page: Page, prevHref: string | null, timeoutMs = 8000) {
  if (!prevHref) {
    // if we didn’t have a previous href, just give the page a moment
    await page.waitForNetworkIdle({ idleTime: 500, timeout: timeoutMs }).catch(() => {});
    await pageSleep(page, 250);
    return;
  }
  await page.waitForFunction(
    async (oldHref) => {
      const img = (document.querySelector('a.photohref[href] > img.mainphoto') ||
                   document.querySelector('a.photohref[href] > img.mainfoto') ||
                   document.querySelector('img.mainphoto') ||
                   document.querySelector('img.mainfoto')) as HTMLImageElement | null;
      const a = img?.closest("a[href]") as HTMLAnchorElement | null;
      const cur = a?.getAttribute("href") || "";
      return cur && cur !== oldHref;
    },
    { timeout: timeoutMs },
    prevHref
  ).catch(() => {});
  await pageSleep(page, 200);
}

async function getGalleryTotal(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const galleryString = document.querySelector('#gridphoto-gallery-link > span');
    if (!galleryString) return 1;

    const text = galleryString.textContent || '';
    // Match the number after "of" (e.g., "Pic 1 of 128" -> captures "128")
    const match = text.match(/of\s+(\d+)/);

    return match ? parseInt(match[1], 10) : 1;
  });
}
export default async function runNextButtonStrategy(
  page: Page,
  galleryPath: string,
  opts: { maxPerGallery?: number; skipExisting: boolean }
): Promise<{ totalFound: number; totalDownloaded: number; errors: string[], expectedTotal: number }> {
  let totalFound = 0;
  let totalDownloaded = 0;
  const errors: string[] = [];
  const seenUrl = new Set<string>();

  const expectedTotal = await getGalleryTotal(page);
  let consecutiveDuplicates = 0; // Add counter for stuck detection
  let lastHref: string | null = null;

  while (true) {
    const hdHref = await getHdHref(page);
    if (!hdHref) {
      logStep("warning", "No HD href found, stopping");
      break;
    }

    // Detect if we're stuck on the same image
    if (hdHref === lastHref) {
      consecutiveDuplicates++;
      if (consecutiveDuplicates >= 3) {
        logStep("warning", `Stuck on same image (${hdHref}), stopping`);
        break;
      }
    } else {
      consecutiveDuplicates = 0;
      lastHref = hdHref;
    }

    // Download (skip duplicates)
    if (!seenUrl.has(hdHref)) {
      seenUrl.add(hdHref);
      totalFound++;
      const fname = filenameFromUrl(hdHref);
      logStep("downloading image", `${totalFound}/${expectedTotal} - ${fname}`);
      try {
        await downloadToFile(hdHref, galleryPath, true);
        totalDownloaded++;
      } catch (e: any) {
        errors.push(`${fname} ← ${hdHref} :: ${e?.message || e}`);
      }
    }

    // Check if we've reached the expected total
    if (totalFound >= expectedTotal) {
      logStep("success", `Reached expected total (${expectedTotal})`);
      break;
    }

    // Respect optional cap
    if (opts.maxPerGallery && totalDownloaded >= opts.maxPerGallery) break;

    // Click Next
    const hasNext = await clickNext(page);
    if (!hasNext) {
      logStep("info", "No next button found, stopping");
      break;
    }

    // Wait for href change
    await waitForHdHrefChange(page, hdHref, 10_000);
  }

  // Warn if we didn't get all images
  if (totalFound < expectedTotal) {
    logStep("warning", `Only found ${totalFound}/${expectedTotal} images`);
  }

  return { totalFound, totalDownloaded, errors, expectedTotal };
}