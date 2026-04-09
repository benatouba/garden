# Digital Garden (Quartz)

This folder contains the Quartz-powered digital garden for `garden.benrlschmidt.de`.

The garden is deployed as a separate Netlify site from the main Vue profile website and is styled to match the same brand direction.

Quartz upstream is pinned as a git submodule:

- `garden/_quartz-upstream` (tracking branch `v4`)

Garden-specific code and content stay outside the submodule:

- `garden/quartz.config.ts`
- `garden/quartz.layout.ts`
- `garden/custom/*`
- `garden/scripts/*`
- `garden/content/*`

The path `garden/quartz` is a symlink to `garden/_quartz-upstream/quartz` so Quartz docs/examples still work while engine updates come from the submodule.

## Stack

- Quartz v4
- Markdown + Obsidian-compatible wikilinks
- Node.js 22+

## Local Development

From the repository root:

```bash
npm ci --prefix garden
npm run dev:vivere --prefix garden
```

Quartz will start a local preview server at `http://localhost:8080`.

To run Quartz directly without the staged source wrapper (debugging only):

```bash
npm run quartz:local --prefix garden -- build -d ../.quartz-source-vivere/content --serve
```

## Content Workflow

- Publishable notes live in `garden/content`.
- Use frontmatter keys: `title`, `description`, `date`, `tags`, optional `aliases`, optional `draft`.
- Keep notes evergreen and heavily interlinked.
- Use stable filenames once notes are public.

### Build Directly from `../vivere` or GitHub (No Duplication)

Recommended workflow: Quartz builds directly from your Obsidian source vault using a staged project source, so your notes are not duplicated.

From repository root:

```bash
npm run build:vivere --prefix garden
npm run dev:vivere --prefix garden
```

What this does:

- Reads notes from `../vivere` by default.
- If `../vivere` is not present (for example on Netlify), it clones from `https://github.com/benatouba/vivere.git`.
- Uses frontmatter classification in source notes:
  - `publish: public` -> included in Quartz build
  - `publish: private` -> excluded
- Excludes unclassified notes by default and writes a review queue in `<source>/_garden/publish-review-queue.txt`.
- Stages a temporary Quartz source in `../.quartz-source-vivere/` and runs the upstream Quartz engine from there.

Optional env vars:

- `OBSIDIAN_SOURCE_DIR`: explicit local source path
- `OBSIDIAN_SOURCE_GIT_URL`: remote source repo URL
- `OBSIDIAN_SOURCE_GIT_REF`: branch or tag to pull (default `main`)
- `OBSIDIAN_SOURCE_GIT_TOKEN`: GitHub token for private repository clone (required on Netlify for private `vivere`)

Helper files are generated in `../vivere/_garden/`:

- `classification-public-template.md`
- `classification-private-template.md`

When cloning from GitHub fallback, helper files are written under `../.obsidian-source-vivere/_garden/`.

### Optional Materialized Sync

If you still want a copied sync (for offline snapshots), you can use:

```bash
npm run sync:notes --prefix garden
```

This copies only `publish: public` notes into `garden/content/notes/`.

Ignored paths are configured in `garden/quartz.config.ts`:

- `private`
- `templates`
- `daily`
- `attachments/private`
- `.obsidian`

## Deploy to Netlify (Subdomain)

Create a second Netlify site for this repo and configure:

- Package directory: `garden`
- Build command: from `garden/netlify.toml` -> `bash ./scripts/netlify-build.sh`
- Publish directory: `public`
- Node version: `22`
- Environment variables:
  - `OBSIDIAN_SOURCE_GIT_URL=https://github.com/benatouba/vivere.git`
  - `OBSIDIAN_SOURCE_GIT_REF=main`
  - `OBSIDIAN_SOURCE_GIT_TOKEN=<GitHub token with repo read access>`

The Netlify build script installs dependencies and then runs `npm run build:vivere`.

### Remove local copied notes

To rely only on source-of-truth notes from `../vivere` or GitHub clone fallback, keep `garden/content/notes` empty (or remove it). The build stage is generated dynamically from the source repository.

### Auto-update from `vivere` pushes

Netlify only rebuilds when this repository changes, so add a GitHub Action in `vivere` that calls a Netlify build hook on every push.

1. In Netlify site settings, create a Build hook (for branch `main`).
2. In `benatouba/vivere` add repository secret `NETLIFY_BUILD_HOOK_URL` with that hook URL.
3. In `benatouba/vivere`, add workflow `.github/workflows/trigger-garden-netlify.yml`:

```yaml
name: Trigger Garden Netlify Deploy

on:
  push:
    branches: [main]
  schedule:
    - cron: "17 */6 * * *"
  workflow_dispatch:

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Validate build hook secret exists
        if: ${{ secrets.NETLIFY_BUILD_HOOK_URL == '' }}
        run: |
          echo "NETLIFY_BUILD_HOOK_URL is not configured in repository secrets."
          exit 1
      - name: Trigger Netlify build hook
        run: curl -fsS -X POST "$NETLIFY_BUILD_HOOK_URL"
        env:
          NETLIFY_BUILD_HOOK_URL: ${{ secrets.NETLIFY_BUILD_HOOK_URL }}
```

You can also schedule regular refresh deploys by extending this workflow with `on.schedule`.

Then add the custom domain:

- `garden.benrlschmidt.de`

Quartz emits a `CNAME` file automatically based on `baseUrl`.

## Useful Commands

From repository root:

```bash
npm run build:vivere --prefix garden
npm run dev:vivere --prefix garden
npm run quartz --prefix garden -- build
npm run sync:notes --prefix garden
npm run quartz:local --prefix garden -- build -d ../.quartz-source-vivere/content
npm run check --prefix garden
```

## Updating Quartz Submodule

From repository root:

```bash
git submodule update --remote --merge garden/_quartz-upstream
```

Then verify:

```bash
npm run check --prefix garden
npm run build:vivere --prefix garden
```
