# Gallery Downloader (TypeScript + Puppeteer)

Local-only tool to download all full-resolution images from given gallery URLs.
This repo currently contains the folder/module structure only—no implementation yet.

## Folders
- `src/` TypeScript source
  - `cli/` CLI entry and argument parsing
  - `config/` runtime configuration, defaults
  - `scraper/` scraping engine
    - `drivers/` browser drivers (Puppeteer)
    - `strategies/` generic + per-site strategies
  - `utils/` helpers (network, filenames, parsing, etc.)
  - `types/` shared TypeScript types
- `bin/` CLI launchers
- `downloads/` output images (gitignored)
- `logs/` run logs and reports (gitignored)
- `tests/` tests and fixtures

## Next Steps
- Initialize package.json, TypeScript, and Puppeteer.
- Implement CLI + engine.

## Run
`npx tsc`
`bin/download-galleries --input ./urls.json --strategy next --headless false`