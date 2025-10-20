// src/scraper/strategies/genericStrategy.ts
import type { Page } from "puppeteer";

// Parse srcset="url1 320w, url2 1024w, ..."
function pickLargestFromSrcset(srcset: string): string | null {
  const parts = srcset
    .split(",")
    .map((p) => p.trim())
    .map((p) => {
      const m = p.match(/(.+)\s+(\d+)w$/);
      if (m) return { url: m[1].trim(), w: Number(m[2]) };
      return { url: p, w: 0 };
    });
  if (!parts.length) return null;
  parts.sort((a, b) => b.w - a.w);
  return parts[0].url;
}

export default async function discoverImageUrls(page: Page): Promise<string[]> {
  // Collect from <img> and from <a href="...ext"> pointing to images
  const urls = await page.evaluate(() => {
    const set = new Set<string>();

    // From <img>
    for (const img of Array.from(document.querySelectorAll("img"))) {
      const src = img.getAttribute("src") || "";
      const srcset = img.getAttribute("srcset") || "";
      if (srcset) {
        set.add(srcset); // placeholder; will be expanded outside
      } else if (src) {
        set.add(src);
      }
    }

    // From <a> links that look like direct images
    const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|avif)(\?.*)?$/i;
    for (const a of Array.from(document.querySelectorAll("a[href]"))) {
      const href = a.getAttribute("href") || "";
      if (IMAGE_EXT.test(href)) set.add(href);
    }

    return Array.from(set);
  });

  // Expand any srcset entries to the largest one
  const out: string[] = [];
  for (const u of urls) {
    if (u.includes(" ") && u.includes(",")) {
      const big = pickLargestFromSrcset(u);
      if (big) out.push(big);
    } else {
      out.push(u);
    }
  }

  // Normalize to absolute URLs using page URL
  const base = await page.url();
  const normalized = out.map((u) => toAbsoluteUrl(u, base)).filter(Boolean) as string[];

  // Deduplicate
  return Array.from(new Set(normalized));
}

function toAbsoluteUrl(u: string, base: string): string | null {
  try {
    // Some sites use //cdn.domain.com/...
    if (u.startsWith("//")) return new URL(`https:${u}`).toString();
    return new URL(u, base).toString();
  } catch {
    return null;
  }
}
