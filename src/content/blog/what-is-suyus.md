---
title: "What is Suyus? Developer portfolios written in Markdown"
description: "Suyus gives any GitHub user a portfolio page at suy.us/p/<username>, made from one Markdown file submitted by pull request. Here's what it is, how it works, and why it's built this way."
pubDate: 2026-11-19
tags: ["suyus", "portfolio", "markdown", "astro", "github-actions"]
---

Most developers I know have a half-finished portfolio site somewhere: a template they forked once, a framework they'd now rather not upgrade, a domain they forgot to renew. Writing about your own work is hard enough without also maintaining the website it lives on.

[Suyus](https://suy.us) (pronounced *soo-yoos*) is my answer to that. Any GitHub user can get a portfolio page at `https://suy.us/p/<github-username>` by submitting **one Markdown file**. No account to create, no builder to learn, no hosting to pay for. This post covers what it is, how a submission works, and the decisions behind it.

## The idea

A portfolio is mostly structured data (name, role, experience, skills, projects) plus a few paragraphs about yourself. That fits neatly into a Markdown file with frontmatter:

```markdown
---
name: Octo Cat
github: octocat
headline: Platform Engineer · CI/CD & Kubernetes
role: DevOps Engineer at Example Corp
location: Kuala Lumpur, Malaysia
skills:
  - name: Platform
    items: [Kubernetes, Terraform, GitHub Actions]
---

I build CI/CD pipelines and the platforms they run on...
```

The frontmatter becomes the page's header, experience timeline, skills and project cards. The Markdown body becomes the **About me** section. Suyus handles the layout, dark mode, mobile view and share previews, so every page looks good without anyone touching CSS.

## How you add yours

Everything happens on GitHub:

1. Fork the [Suyus repository](https://github.com/saifulnizamnordin/suyus).
2. Copy `templates/portfolio.md` to `src/content/portfolios/<your-github-username>.md`, using your username in lowercase.
3. Fill it in, and delete any optional sections you don't need.
4. Open a pull request.

Once the checks pass and the PR is merged, your page is live. The full guide is in [SUBMISSION.md](https://github.com/saifulnizamnordin/suyus/blob/main/SUBMISSION.md).

Editing later works the same way: change your file, open another PR. Your portfolio has a full version history for free.

## What keeps it safe

Letting anyone submit content to a shared site needs some guard rails. Each pull request runs a validation workflow that checks:

- the file name matches the PR author's GitHub username, so nobody can create or edit someone else's page
- the frontmatter matches the schema, so a typo fails the check instead of breaking the site
- the whole site still builds

Two other things run quietly in the background.

**Usernames can change; account IDs can't.** Each portfolio stores the owner's numeric GitHub ID. A daily job follows those IDs and opens a pull request when someone renames their account, so `/p/old-name` redirects to `/p/new-name` instead of going stale.

**Emails aren't published in plain text.** A public repo would hand every address straight to spammers. Instead you run `npm run encrypt-email -- you@example.com` and put the encrypted value in your file. When a visitor clicks **Email**, a small Cloudflare Worker decrypts it only after a [Turnstile](https://www.cloudflare.com/products/turnstile/) check.

## Showcases: when Markdown isn't enough

Some work is easier to show than describe: a pipeline you sped up, a simulation, a before/after toggle. For that, Suyus has **showcases**: small React components that appear at the top of your portfolio section.

Each showcase lives in your own folder, `src/showcases/<your-username>/<name>/`, and the PR check only lets you touch that folder. It also statically blocks network calls, raw HTML, `eval` and imports outside a short allow-list. That's a first pass, not a sandbox, so every showcase is still read by hand before it's merged.

## Finding people

The [Browse page](https://suy.us/p) lists everyone, with search by name, role, skill or company and filters for skill and country. The filters live in the URL, so a search like `/p?q=devops&skill=Kubernetes` can be shared as a link.

## The stack

Suyus is the same kind of site as this blog:

- **[Astro](https://astro.build)** builds every page to static HTML, with each portfolio file loaded through a content collection and validated against a schema at build time.
- **[React](https://react.dev)** and **[shadcn/ui](https://ui.shadcn.com)** handle the interactive parts: search, the share menu and showcases.
- **GitHub Actions** validates submissions, syncs usernames and deploys to **GitHub Pages** on every merge to `main`.

There's no database and no server to keep alive. The repository *is* the database, and pull requests are the admin panel.

## A name and a logo

The name is short, easy to say and fits a short domain: suy.us. The logo is a geometric S cut from two parallel strokes on an indigo square. Logos, colours and usage rules are on the [media kit page](https://suy.us/brand) if you want to write about it.

## Wrap-up

Suyus is for developers who would rather write about their work than maintain a website for it. If you have a GitHub account and ten minutes, [read the submission guide](https://github.com/saifulnizamnordin/suyus/blob/main/SUBMISSION.md) and add yours. I'd like to see what you've built.
