// src/utils/wait.ts
import type { Page } from "puppeteer";

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function pageSleep(page: Page, ms: number) {
  await page.evaluate(
    (t) => new Promise<void>((res) => setTimeout(res, t)),
    ms
  );
}


export async function waitForNetworkIdle(
  page: Page,
  idleMs = 800,
  timeoutMs = 10_000
) {
  let inflight = 0;
  let idleResolve!: () => void;
  let idleTimer: NodeJS.Timeout | null = null;

  const onRequest = () => {
    inflight++;
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };
  const onSettled = () => {
    inflight = Math.max(0, inflight - 1);
    if (inflight === 0 && !idleTimer) {
      idleTimer = setTimeout(() => idleResolve(), idleMs);
    }
  };

  await new Promise<void>((resolve, reject) => {
    idleResolve = resolve;

    const to = setTimeout(() => {
      cleanup();
      reject(new Error(`waitForNetworkIdle timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(to);
      if (idleTimer) clearTimeout(idleTimer);
      page.off("request", onRequest);
      page.off("requestfinished", onSettled);
      page.off("requestfailed", onSettled);
    }

    page.on("request", onRequest);
    page.on("requestfinished", onSettled);
    page.on("requestfailed", onSettled);

    // If already idle, start the idle timer immediately
    if (inflight === 0) {
      idleTimer = setTimeout(() => {
        cleanup();
        resolve();
      }, idleMs);
    }

    // Ensure cleanup when resolved
    (async () => {
      try {
        await new Promise<void>((r) => (idleResolve = () => { cleanup(); r(); }));
      } catch {
        cleanup();
      }
    })();
  });
}