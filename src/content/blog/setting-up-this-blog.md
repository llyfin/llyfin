---
title: "Setting up this blog: Astro, Markdown and GitHub Pages"
description: "How llyf.in is built: Astro with React and shadcn/ui, posts as plain Markdown files, deployed to GitHub Pages by GitHub Actions on every push — plus the small gotchas along the way."
pubDate: 2026-10-10
tags: ["astro", "react", "shadcn", "github-actions", "github-pages"]
---

I wanted somewhere to write things down: fixes I'd otherwise forget, and notes on the infrastructure I work with. The requirements were simple. Posts should be plain Markdown files, the site should be fast, and publishing should work the way I'd deploy anything else: push to `main`, let CI build it, and have it go live automatically.

This post walks through the stack, the setup, and the few things that tripped me up.

## The stack

- **[Astro](https://astro.build)** — builds the whole site to static HTML. Pages ship with no JavaScript unless a component actually needs it.
- **[React](https://react.dev)** — only for the interactive bits: the theme toggle and the comments under each post.
- **[shadcn/ui](https://ui.shadcn.com)** — copy-in components on top of Tailwind CSS v4. The code lives in the repo, so I can change anything.
- **Markdown** — every post is a `.md` file in the repo.
- **GitHub Actions + GitHub Pages** — free hosting, deployed on every push.

## 1. Scaffold Astro

Everything is set up with `npx`, so there's nothing to install globally:

```sh
npx create-astro@latest llyfin --template minimal
cd llyfin
```

Then add React and Tailwind with Astro's integration command, which installs the packages and updates the config for you:

```sh
npx astro add react tailwind
```

## 2. Add shadcn/ui

shadcn needs an `@/*` import alias first. In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

Then initialise it and pull in the components you need:

```sh
npx shadcn@latest init
npx shadcn@latest add button
```

The components land in `src/components/ui/` as plain source files.

## 3. Posts as a content collection

Every Markdown file in `src/content/blog/` becomes a post. Astro's content collections handle the loading, and a schema validates each post's frontmatter:

```ts
// src/content.config.ts
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
})
```

Because the schema runs at build time, a typo in a date fails the build instead of quietly publishing a broken post. Drafts show up in `npm run dev` but never in production.

Posts are served from the root of the site, so `src/content/blog/my-post.md` becomes `/my-post/`. There's an RSS feed at `/rss.xml` too.

## 4. Islands: only hydrate what's interactive

This is what I like most about Astro. React components render to static HTML by default. To make one interactive in the browser, you opt in with a `client:` directive:

```astro
<ThemeToggle client:load />
<Comments client:visible slug={post.id} />
```

`client:visible` waits until the component scrolls into view before loading its JavaScript. The comments sit at the bottom of the post, so most readers never download that code unless they scroll down to it.

## 5. Code blocks that follow the theme

Astro highlights code with Shiki. It can emit both a light and a dark theme at once, as CSS variables, instead of hard-coding one:

```js
// astro.config.mjs
markdown: {
  shikiConfig: {
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  },
},
```

A few lines of CSS then pick the right set based on the `dark` class that the theme toggle puts on `<html>`:

```css
.astro-code,
.astro-code span {
  color: var(--shiki-light);
  background-color: var(--shiki-light-bg);
}

.dark .astro-code,
.dark .astro-code span {
  color: var(--shiki-dark);
  background-color: var(--shiki-dark-bg);
}
```

## 6. Deploy with GitHub Actions

The workflow at `.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist/` to GitHub Pages:

```yaml
on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

In the repo settings, **Settings → Pages → Source** has to be set to **GitHub Actions**.

## 7. Custom domain

To serve the site from `llyf.in` instead of `<username>.github.io`:

1. Add a `public/CNAME` file containing just `llyf.in`. Astro copies everything in `public/` into the build output, so it ships with every deploy.
2. Point the DNS at GitHub Pages. That means four `A` records on the apex:

   ```text
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

   (plus the matching `AAAA` records for IPv6), and a `CNAME` record from `www` to `<username>.github.io`.
3. Enter the domain under **Settings → Pages → Custom domain**, wait for the DNS check, then tick **Enforce HTTPS**.

Because the site is served from the root of a custom domain, Astro doesn't need a `base` path. Setting `site: "https://llyf.in"` in `astro.config.mjs` is enough.

## Gotchas I hit

**Lockfiles across operating systems.** I generate `package-lock.json` on Windows, but CI runs on Linux. Tools like Tailwind v4 and Lightning CSS ship native binaries per platform. Before pushing, it's worth checking that the lockfile lists the `linux-x64-gnu` packages too, or `npm ci` fails on the runner.

**Cloudflare proxy in front of GitHub Pages.** My domain's DNS lives on Cloudflare, and a proxied (orange-cloud) record pointing at the wrong origin gives a `523 Origin is unreachable`. Keep the records **DNS only** until GitHub has issued its certificate.

**Hydration and Radix components.** Some shadcn components are built on Radix and only finish rendering in the browser. In an Astro component that isn't hydrated, that code never runs. If something looks half-rendered on the static page, either give it a `client:` directive or use plain HTML instead.

## Writing a new post

Writing here is now just:

```sh
# create src/content/blog/my-new-post.md with frontmatter, then
git add . && git commit -m "Add my new post" && git push
```

A minute later it's live at `/my-new-post/`. That's the workflow I wanted.
