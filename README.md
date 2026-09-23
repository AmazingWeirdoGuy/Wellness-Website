# Wellness Diary

A private, self-guided wellness journal with check-ins, writing prompts, breathing, and kind words. Entries stay in the current browser session and are not sent to a server.

## Run locally

Requires Node.js 22 or newer and pnpm.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Build

```sh
pnpm build
pnpm preview
```

The static site is written to `dist/`. No database, API service, or environment variables are required.
