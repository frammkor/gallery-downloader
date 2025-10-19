// src/types/cli.ts
export type CliOptions = {
  url?: string;
  input?: string; // path to JSON file
  headless?: boolean;
  concurrency?: number;
  downloadDir?: string;
  skipExisting?: boolean;
  maxPerGallery?: number;
};

export type UrlListFile =
  | string[]                            // ["https://…", "https://…"]
  | { urls: string[] }                  // { "urls": ["…"] }
  | { galleries: string[] }             // { "galleries": ["…"] }
  | { items: ({ url: string } | string)[] }; // { "items": ["…", {"url":"…"}] }
