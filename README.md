# llyf.in

Source for the blog at **https://llyf.in**.

Built with [Astro](https://astro.build), [React](https://react.dev) and [shadcn/ui](https://ui.shadcn.com) (Tailwind CSS v4). Posts are plain Markdown files.

## Development

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # output in ./dist
npm run preview
```

## Writing a post

Posts live in [`src/content/blog/`](src/content/blog/). Each `.md` file becomes a page at `/<file-name>/`, shows up on the home page, and is included in the RSS feed at `/rss.xml`.

```md
---
title: "My post title"
description: "One-sentence summary shown in the post list."
pubDate: 2026-10-25
updatedDate: 2026-10-26 # optional
tags: ["devops", "linux"]
draft: false # true = only visible in `npm run dev`
---

Post content in Markdown…
```

Frontmatter is validated at build time (see [`src/content.config.ts`](src/content.config.ts)), so a missing title or bad date fails the build instead of publishing a broken post.

## Comments

Each post has threaded comments backed by [PocketBase](https://pocketbase.io), keyed by the post's file name. The server URL defaults to `https://pb.llyf.in` and can be overridden with `PUBLIC_POCKETBASE_URL` (see [`src/lib/pocketbase.ts`](src/lib/pocketbase.ts)).

Renaming a post's file changes its slug, so comments on the old slug no longer appear under it.

## shadcn/ui

Add more components with:

```sh
npx shadcn@latest add <component>
```

## Deployment

Every push to `main` builds the site and deploys it to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It can also be run manually from the **Actions** tab.

### One-time GitHub Pages setup

1. **Settings → Pages → Build and deployment → Source**: choose **GitHub Actions**.
2. Push to `main` (or re-run the workflow) and wait for the **Deploy to GitHub Pages** run to finish.

### Custom domain: `llyf.in`

[`public/CNAME`](public/CNAME) contains `llyf.in` and is copied into every build.

**DNS records** for `llyf.in`:

| Type    | Name | Value                  |
| ------- | ---- | ---------------------- |
| `A`     | `@`  | `185.199.108.153`      |
| `A`     | `@`  | `185.199.109.153`      |
| `A`     | `@`  | `185.199.110.153`      |
| `A`     | `@`  | `185.199.111.153`      |
| `AAAA`  | `@`  | `2606:50c0:8000::153`  |
| `AAAA`  | `@`  | `2606:50c0:8001::153`  |
| `AAAA`  | `@`  | `2606:50c0:8002::153`  |
| `AAAA`  | `@`  | `2606:50c0:8003::153`  |
| `CNAME` | `www`| `llyfin.github.io`     |

Leave the `pb` record for PocketBase as it is. If the DNS is on Cloudflare, keep the GitHub Pages records **DNS only** (grey cloud) until the certificate is issued.

Then **Settings → Pages → Custom domain**: enter `llyf.in`, save, wait for the DNS check, and tick **Enforce HTTPS**.
