// src/utils/filename.ts
export function sanitizeFilename(name: string) {
  const base = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, " ").trim();
  return base || "file";
}

export function filenameFromUrl(u: string): string {
  try {
    const url = new URL(u);
    const pathname = url.pathname;
    const last = pathname.split("/").filter(Boolean).pop() || "image";
    // Drop query; keep extension if present
    const clean = last.replace(/(\.[a-z0-9]+)?(\?.*)?$/i, "$1");
    return sanitizeFilename(clean);
  } catch {
    // Fallback
    const guessed = u.replace(/[?#].*$/, "").split("/").pop() || "image";
    return sanitizeFilename(guessed);
  }
}

export function ensureExtension(name: string, mime?: string) {
  if (/\.[a-z0-9]+$/i.test(name)) return name;
  if (!mime) return name;
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
  };
  return name + (map[mime] || "");
}
