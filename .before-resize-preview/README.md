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

## Search visibility

The public founder profile is `https://wellnessdiary.org/about/`. Its full biography, name heading, canonical URL, and `ProfilePage` / `Person` structured data are included in `public/about/index.html`, so they are available without JavaScript. The homepage and Contact page identify the same founder using `https://wellnessdiary.org/about/#founder`.

Keep the public HTML metadata and the React fallback in `src/App.tsx` consistent when editing the biography. Update the affected URL's `lastmod` in `public/sitemap.xml` when its public content changes, rather than on every build.

After deploying to Cloudflare:

1. Confirm `/about/` displays Rungphob Lertvilaivithaya as the founder and the correct page title.
2. In Google Search Console, inspect `https://wellnessdiary.org/about/`, choose **Test live URL**, then **Request indexing**. Do the same for the homepage and Contact page after changes.
3. Submit `https://wellnessdiary.org/sitemap.xml` in **Sitemaps** if it has not already been submitted successfully.
4. Link to the About page from genuine personal profiles or another website you manage. Only add `sameAs` structured-data links for verified profiles of the same person.

Google controls inclusion and ranking; deployment and an indexing request do not guarantee placement. See [Google's recrawl guidance](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl) and [profile page guidance](https://developers.google.com/search/docs/appearance/structured-data/profile-page).

## Typography

`public/typography.css` is the shared source for the journal, games, and static About / Contact pages.

- Use Lora, regular (400) or semibold (600). Headings and body copy use regular; controls and emphasis use semibold. Selected intimate quotes use Lora italic at regular weight. The regular and semibold styles share one locally served WOFF2 file (about 38 kB), with a small local italic file for quotes; no third-party font requests are needed.
- Use the named font roles (`--font-body`, `--font-control`, `--font-heading`, etc.) and size tokens. Do not add individual pixel sizes, fluid font sizes, or extra weights in components.
- The interface size scale is 13, 14, 16, 20, 24, 32, 48, and 72px, expressed in rem. The home cover title uses an intentional 80px display size (56px on mobile) and page titles step down on mobile.
- Page-turn snapshots embed the same font and weights; their public font data is cached in memory, separately from journal content.

Lora is by [Cyreal](https://www.cyreal.org/fonts/lora/), distributed under the SIL Open Font License in `public/fonts/Lora-OFL.txt`. The unmodified Latin WOFF2 comes from Google Fonts. See [the typography review](docs/typography-review.md) for the commercial references and selection rationale.
