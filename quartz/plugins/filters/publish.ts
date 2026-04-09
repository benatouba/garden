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
    const publishValue = normalizePublishValue(vfile.data?.frontmatter?.publish)
    return publishValue !== "private" && publishValue !== "false"
  },
})
