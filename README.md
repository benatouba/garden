# Quartz Garden

This is a standard Quartz v4 setup with a custom layout/theme and a simple note sync step.

Notes are pulled from the private repository `https://github.com/benatouba/vivere.git` into `content/` before each build.

The entry note is `content/index.md` (from `index.md` in `benatouba/vivere`).

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

Token requirements:

- Fine-grained PAT: access to repo `benatouba/vivere` with `Contents: Read`
- Classic PAT: `repo` scope

## Local Development

Sync notes and start Quartz dev server:

```bash
npm run dev
```

Build production output:

```bash
npm run build
```

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

## Custom Domain (GoDaddy -> Netlify)

For `garden.benrlschmidt.de` in GoDaddy DNS:

- Type: `CNAME`
- Name: `garden`
- Value: `vivere-garden.netlify.app`

Remove conflicting records (`A`, `AAAA`, or another `CNAME`) for host `garden`.

Then add `garden.benrlschmidt.de` in Netlify Domain settings and wait for SSL.
