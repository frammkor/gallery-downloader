// src/utils/logger.ts
export type LogFn = (msg: string) => void;

export const log: LogFn = (msg) => {
  const ts = new Date().toISOString();

  console.log(`[${ts}] ${msg}`);
};

export const logStep = (label: string, value?: string | number) => {
  if (value === undefined) {
    log(label);
  } else {
    log(`${label}: '${value}'`);
  }
};
