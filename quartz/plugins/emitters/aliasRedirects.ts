import fs from "node:fs/promises"
import path from "node:path"
import type { VFile } from "vfile"

import type { QuartzEmitterPlugin } from "../types"
import { joinSegments, simplifySlug, resolveRelative, isRelativeURL } from "../../util/path"
import type { BuildCtx } from "../../util/ctx"
import type { FilePath, FullSlug } from "../../util/path"

const write = async (
  ctx: BuildCtx,
  slug: FullSlug,
  ext: string,
  content: string,
): Promise<FilePath> => {
  const pathToPage = joinSegments(ctx.argv.output, slug + ext) as FilePath
  const dir = path.dirname(pathToPage)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(pathToPage, content)
  return pathToPage
}

const normalizeAliasSlug = (ogSlug: FullSlug, aliasTarget: string): FullSlug => {
  const rawAlias = isRelativeURL(aliasTarget)
    ? path.posix.normalize(path.posix.join(ogSlug, "..", aliasTarget))
    : aliasTarget

  return simplifySlug(rawAlias as FullSlug)
}

async function* processFile(ctx: BuildCtx, file: VFile) {
  const ogSlug = simplifySlug(file.data.slug as FullSlug)
  const rawAliases = (file.data as Record<string, unknown>).aliases
  const aliases = Array.isArray(rawAliases) ? rawAliases : []
  const seen = new Set<string>()

  for (const aliasTarget of aliases) {
    if (typeof aliasTarget !== "string" || aliasTarget.trim().length === 0) {
      continue
    }

    const aliasTargetSlug = normalizeAliasSlug(ogSlug, aliasTarget)
    if (!aliasTargetSlug || aliasTargetSlug === ogSlug || seen.has(aliasTargetSlug)) {
      continue
    }

    seen.add(aliasTargetSlug)

    const redirUrl = resolveRelative(aliasTargetSlug, ogSlug)
    yield write(
      ctx,
      aliasTargetSlug,
      ".html",
      `
        <!DOCTYPE html>
        <html lang="en-us">
        <head>
        <title>${ogSlug}</title>
        <link rel="canonical" href="${redirUrl}">
        <meta name="robots" content="noindex">
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="0; url=${redirUrl}">
        </head>
        </html>
        `,
    )
  }
}

export const AliasRedirects: QuartzEmitterPlugin = () => ({
  name: "AliasRedirects",
  async *emit(ctx, content) {
    for (const [_tree, file] of content) {
      yield* processFile(ctx, file)
    }
  },
  async *partialEmit(ctx, _content, _resources, changeEvents) {
    for (const changeEvent of changeEvents) {
      if (!changeEvent.file) continue
      if (changeEvent.type === "add" || changeEvent.type === "change") {
        yield* processFile(ctx, changeEvent.file)
      }
    }
  },
})
