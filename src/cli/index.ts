// src/cli/index.ts
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { GalleryScraper } from "../scraper/galleryScraper";
import { log, logStep } from "../utils/logger";
import { CliOptions, UrlListFile } from "../types/cli";

function parseArgs(argv: string[]): CliOptions {
  // Minimal, dependency-free parsing
  const opts: CliOptions = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url" || a === "-u") {
      opts.url = argv[++i];
    } else if (a === "--input" || a === "-i") {
      opts.input = argv[++i];
    } else if (a === "--headless") {
      const v = argv[++i];
      opts.headless = v === "false" ? false : true;
    } else if (a === "--concurrency" || a === "-c") {
      opts.concurrency = Number(argv[++i] ?? "4");
    } else if (a === "--downloadDir" || a === "-d") {
      opts.downloadDir = argv[++i];
    } else if (a === "--skipExisting") {
      const v = argv[++i];
      opts.skipExisting = v === "false" ? false : true;
    } else if (a === "--maxPerGallery") {
      opts.maxPerGallery = Number(argv[++i] ?? "0") || undefined;
    } else if (a === "--help" || a === "-h") {
      printHelpAndExit();
    } else if (a === "--strategy") {
      const v = (argv[++i] || "").toLowerCase();
      opts.strategy = v ?? 'generic';
    } else {
      // ignore unknowns for now
    }
  }
  return opts;
}

function printHelpAndExit(code = 0) {
  console.log(`
Usage:
  download-galleries --url <URL>
  download-galleries --input <file.json>

Options:
  --url, -u            Single gallery URL to process
  --input, -i          JSON file with list of URLs
  --headless           Run headless browser (default: true)
  --concurrency, -c    Parallel galleries to process (default: 4)
  --downloadDir, -d    Root download directory (default: downloads)
  --skipExisting       Skip already-downloaded files (default: true)
  --maxPerGallery      Limit number of images per gallery (default: unlimited)
  --help, -h           Show this help
  `);
  process.exit(code);
}

function ensureValidInput(opts: CliOptions) {
  if (!opts.url && !opts.input) {
    console.error("Error: Provide either --url or --input.");
    printHelpAndExit(1);
  }
}

function isValidUrl(maybe: string): boolean {
  try {
    new URL(maybe);
    return true;
  } catch {
    return false;
  }
}

function readUrlListFromJson(path: string): string[] {
  const filePath = resolve(process.cwd(), path);
  if (!existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }
  const raw = readFileSync(filePath, "utf8");
  const data: UrlListFile = JSON.parse(raw);

  // Normalize various shapes into a string[]
  if (Array.isArray(data)) return data;
  if ("urls" in data && Array.isArray(data.urls)) return data.urls;
  if ("galleries" in data && Array.isArray(data.galleries)) return data.galleries;
  if ("items" in data && Array.isArray(data.items)) {
    return data.items.map((x) => (typeof x === "string" ? x : x.url)).filter(Boolean);
  }

  throw new Error("JSON format not recognized. Use an array, {urls:[]}, {galleries:[]}, or {items:[...]}.");
}

async function main() {
  const opts = parseArgs(process.argv);
  ensureValidInput(opts);

  const headless = opts.headless ?? true;
  const concurrency = opts.concurrency ?? 4;
  const downloadDir = opts.downloadDir ?? "downloads";
  const skipExisting = opts.skipExisting ?? true;

  // Build URL list
  let urls: string[] = [];
  if (opts.url) urls = [opts.url];
  if (opts.input) urls = readUrlListFromJson(opts.input);

  // Validate URLs upfront
  urls = urls.filter((u) => {
    const ok = isValidUrl(u);
    if (!ok) console.error(`Skipping invalid URL: ${u}`);
    return ok;
  });

  if (urls.length === 0) {
    console.error("No valid URLs to process.");
    process.exit(1);
  }

  log(`Starting run with ${urls.length} URL(s). Strategy=${opts.strategy}, Concurrency=${concurrency}, headless=${headless}`);

  // Simple concurrency control (round-robin worker pool)
  const scraperFactory = () =>
    new GalleryScraper({
      downloadDir,
      headless,
      skipExisting,
      maxPerGallery: opts.maxPerGallery,
      strategy: opts.strategy
    });

  let active = 0;
  let index = 0;
  let resolved = 0;
  const errors: { url: string; error: string }[] = [];

  await new Promise<void>((resolveAll) => {
    const kick = () => {
      while (active < concurrency && index < urls.length) {
        const url = urls[index++];
        active++;

        const scraper = scraperFactory();
        scraper
          .scrape(url)
          .catch((err) => {
            errors.push({ url, error: err?.message || String(err) });
            logStep("error processing url", url);
          })
          .finally(() => {
            active--;
            resolved++;
            if (resolved === urls.length) {
              resolveAll();
            } else {
              kick();
            }
          });
      }
    };
    kick();
  });

  // Summary
  if (errors.length) {
    log(`Completed with ${errors.length} error(s).`);
    errors.forEach((e) => log(`  - ${e.url}: ${e.error}`));
  } else {
    log("Completed successfully.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
