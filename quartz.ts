import { componentRegistry } from "./quartz/components"
import { AliasRedirects } from "./quartz/plugins/emitters/aliasRedirects"
import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"

componentRegistry.setOptionOverrides("explorer", {
  filterFn: () => true,
  folderDefaultState: "open",
  folderClickBehavior: "collapse",
  mapFn: (node: { displayName?: string }) => {
    if (!node.displayName) {
      return node
    }

    const withoutPrefix = node.displayName.replace(/^\d{2}_/, "")
    const normalized = /^[0-9a-z_-]+$/.test(withoutPrefix)
      ? withoutPrefix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
      : withoutPrefix.trim()

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

const aliasRedirectIdx = config.plugins.emitters.findIndex(
  (emitter) => emitter.name === "AliasRedirects",
)
if (aliasRedirectIdx >= 0) {
  config.plugins.emitters.splice(aliasRedirectIdx, 1, AliasRedirects())
}

export default config
export const layout = await loadQuartzLayout()
