import { QuartzFilterPlugin } from "../types"

const normalizePublishValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim().toLowerCase()
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  return ""
}

export const BlockPrivateNotes: QuartzFilterPlugin = () => ({
  name: "BlockPrivateNotes",
  shouldPublish(_ctx, [_tree, vfile]) {
    // Explicit allowlist: a note is only published when it opts in via
    // `publish: public` (or `publish: true`). Missing or unknown values stay private.
    const publishValue = normalizePublishValue(vfile.data?.frontmatter?.publish)
    return publishValue === "public" || publishValue === "true"
  },
})
