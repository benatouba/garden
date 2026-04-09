import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

const explorerMapFn = (node: { displayName: string }) => {
  const withoutPrefix = node.displayName.replace(/^\d{2}_/, "")
  if (/^[0-9a-z_-]+$/.test(withoutPrefix)) {
    const normalized = withoutPrefix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
    if (normalized) {
      node.displayName = normalized
    }
    return
  }

  const trimmed = withoutPrefix.trim()
  if (trimmed) {
    node.displayName = trimmed
  }
}

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [
    Component.Flex({
      components: [
        {
          Component: Component.Breadcrumbs({
            rootName: "Garden",
          }),
          grow: true,
        },
      ],
    }),
  ],
  afterBody: [],
  footer: Component.Footer({
    links: {
      Website: "https://benrlschmidt.de",
      GitHub: "https://github.com/benatouba",
      ORCID: "https://orcid.org/0000-0002-9669-3360",
      LinkedIn: "https://www.linkedin.com/in/dr-benjamin-schmidt/",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [Component.ArticleTitle(), Component.ContentMeta(), Component.TagList()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
      ],
    }),
    Component.Explorer({
      mapFn: explorerMapFn,
      filterFn: () => true,
      folderDefaultState: "open",
      folderClickBehavior: "collapse",
    }),
    Component.RecentNotes({
      title: "Recent Notes",
      limit: 4,
      showTags: true,
      linkToMore: false,
      filter: (f) => f.slug !== "index",
    }),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
      ],
    }),
    Component.Explorer({
      mapFn: explorerMapFn,
      filterFn: () => true,
      folderDefaultState: "open",
      folderClickBehavior: "collapse",
    }),
    Component.RecentNotes({
      title: "Recent Notes",
      limit: 4,
      showTags: true,
      linkToMore: false,
      filter: (f) => f.slug !== "index",
    }),
  ],
  right: [],
}
