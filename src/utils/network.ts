// src/utils/network.ts
import { createWriteStream } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { filenameFromUrl, ensureExtension } from "./filename";

export async function downloadToFile(
  url: string,
  destDir: string,
  preserveName = true
): Promise<{ path: string; size: number }> {
  mkdirSync(destDir, { recursive: true });

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  // Determine filename
  let name = preserveName ? filenameFromUrl(res.url || url) : "image";
  // Try content-disposition
  const cd = res.headers.get("content-disposition");
  if (cd) {
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd);
    const fname = decodeURIComponent(m?.[1] || m?.[2] || "");
    if (fname) name = fname;
  }
  name = ensureExtension(name, res.headers.get("content-type") || undefined);

  const outPath = resolve(destDir, name);
  const file = createWriteStream(outPath);
  await streamToFile(res.body as any, file);
  const size = Number(file.bytesWritten);
  return { path: outPath, size };
}

function streamToFile(readable: ReadableStream<Uint8Array>, file: NodeJS.WritableStream) {
  return new Promise<void>((resolve, reject) => {
    const nodeStream = (readable as any).pipeTo
      ? webToNode(readable).pipe(file)
      : (readable as any).pipe(file); // Node 18+ fetch uses web streams
    file.on("finish", () => resolve());
    file.on("error", (e) => reject(e));
  });
}

function webToNode(readable: ReadableStream<Uint8Array>) {
  const { Readable } = require("node:stream");
  const nodeReadable = Readable.from(iterateReadable(readable));
  return nodeReadable;
}

async function* iterateReadable(readable: ReadableStream<Uint8Array>) {
  const reader = readable.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
