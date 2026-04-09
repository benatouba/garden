# Quartz Garden

This is a standard Quartz v4 setup with a custom layout/theme and a simple note sync step.

Notes are pulled from the private repository `https://github.com/benatouba/vivere.git` into `content/` before each build.

The entry note is `content/index.md` (from `index.md` in `benatouba/vivere`).

`content/` is intentionally ignored in git (except `content/index.md`) so notes are never committed in this repository.

## Setup

1. Install dependencies:

```bash
npm ci
```

2. Create `.env` from `.env.example` and set your GitHub token:

```bash
cp .env.example .env
```

Required `.env` variables:

- `OBSIDIAN_SOURCE_GIT_URL` (default: `https://github.com/benatouba/vivere.git`)
- `OBSIDIAN_SOURCE_GIT_REF` (default: `main`)
- `OBSIDIAN_SOURCE_GIT_TOKEN` (required for private repo access)
- `OBSIDIAN_SOURCE_SUBDIR` (optional, default `.`)
- `OBSIDIAN_SOURCE_ENTRY_NOTE` (optional, default `index.md`; falls back to `_index.md` and is copied to `content/index.md`)

Token requirements:

- Fine-grained PAT: access to repo `benatouba/vivere` with `Contents: Read`
- Classic PAT: `repo` scope

## Local Development

If you use devenv:

```bash
devenv shell
```

Useful devenv tasks:

- `devenv tasks run garden:sync-notes`
- `devenv tasks run garden:build`
- `devenv tasks run garden:dev`

Sync notes and start Quartz dev server:

```bash
npm run dev
```

Build production output:

```bash
npm run build
```

`npm run build` includes a security check that fails the build if alias redirects in `public/` point to notes marked `publish: private` or `publish: false`.

Sync only:

```bash
npm run sync:notes
```

## Netlify Deployment

This repository is configured for Netlify with `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `public`
- Node version: `22`

In Netlify site settings, add environment variables:

- `OBSIDIAN_SOURCE_GIT_URL=https://github.com/benatouba/vivere.git`
- `OBSIDIAN_SOURCE_GIT_REF=main`
- `OBSIDIAN_SOURCE_GIT_TOKEN=<your token>`
- Optional: `OBSIDIAN_SOURCE_SUBDIR=.`
- Optional: `OBSIDIAN_SOURCE_ENTRY_NOTE=index.md`

## GitHub Action Security Guard

This repository includes `.github/workflows/security-private-notes.yml`.

- It runs on every push and pull request.
- It executes `npm run build`, which includes the private-note publication guard.
- Add these repository secrets for CI builds:
  - `OBSIDIAN_SOURCE_GIT_URL`
  - `OBSIDIAN_SOURCE_GIT_REF`
  - `OBSIDIAN_SOURCE_GIT_TOKEN`
  - `OBSIDIAN_SOURCE_SUBDIR` (optional)
  - `OBSIDIAN_SOURCE_ENTRY_NOTE` (optional)

Important: Quartz file discovery is configured to ignore `.gitignore` rules for build input, so pulled notes in `content/` are still indexed and published.

## Custom Domain (GoDaddy -> Netlify)

For `garden.benrlschmidt.de` in GoDaddy DNS:

- Type: `CNAME`
- Name: `garden`
- Value: `vivere-garden.netlify.app`

Remove conflicting records (`A`, `AAAA`, or another `CNAME`) for host `garden`.

Then add `garden.benrlschmidt.de` in Netlify Domain settings and wait for SSL.
