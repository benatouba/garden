import { componentRegistry } from "./quartz/components"
import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { BlockPrivateNotes } from "./quartz/plugins/filters/publish"

const normalizeExplorerName = (value: string): string => {
  const withoutPrefix = value.replace(/^\d{2}_/, "")

  if (/^[0-9a-z_-]+$/.test(withoutPrefix)) {
    return withoutPrefix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
  }

  return withoutPrefix.trim()
}

componentRegistry.setOptionOverrides("explorer", {
  filterFn: () => true,
  folderDefaultState: "open",
  folderClickBehavior: "collapse",
  mapFn: (node: { displayName?: string }) => {
    if (!node.displayName) {
      return node
    }

    const normalized = normalizeExplorerName(node.displayName)
    if (normalized) {
      node.displayName = normalized
    }

    return node
  },
})

componentRegistry.setOptionOverrides("recent-notes", {
  filter: (file: { slug?: string }) => file.slug !== "index",
})

const config = await loadQuartzConfig()
config.plugins.filters.push(BlockPrivateNotes())

export default config
export const layout = await loadQuartzLayout()
