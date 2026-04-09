import { BuildCtx } from "../quartz/util/ctx"
import { QuartzFilterPlugin } from "../quartz/plugins/types"
import { ProcessedContent } from "../quartz/plugins/vfile"

type PublishClassification = "public" | "private" | null

const readClassification = (content: ProcessedContent): PublishClassification => {
  const value = content[1].data.frontmatter?.publish
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.toLowerCase()
  if (normalized === "public") {
    return "public"
  }

  if (normalized === "private") {
    return "private"
  }

  return null
}

const markDraftWhenPrivate = (content: ProcessedContent) => {
  const frontmatter = content[1].data.frontmatter
  if (!frontmatter) {
    return
  }

  if (frontmatter.publish === "private") {
    frontmatter.draft = true
  }
}

const LOGGED_MISSING = new Set<string>()

const maybeWarnMissingClassification = (ctx: BuildCtx, content: ProcessedContent) => {
  const slug = content[1].data.slug ?? content[1].data.filePath ?? "unknown"
  if (LOGGED_MISSING.has(slug)) {
    return
  }

  LOGGED_MISSING.add(slug)

  if (ctx.argv.verbose) {
    console.warn(`[publish-classification] missing publish field: ${slug}`)
  }
}

export const PublishClassificationFilter: QuartzFilterPlugin = () => ({
  name: "PublishClassificationFilter",
  shouldPublish(ctx: BuildCtx, content: ProcessedContent): boolean {
    markDraftWhenPrivate(content)

    const classification = readClassification(content)
    if (classification === "public") {
      return true
    }

    if (classification === "private") {
      return false
    }

    maybeWarnMissingClassification(ctx, content)
    return false
  },
})
