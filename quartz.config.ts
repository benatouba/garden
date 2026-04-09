import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Digital Garden",
    pageTitleSuffix: " | Dr. Benjamin Schmidt",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: "garden.benrlschmidt.de",
    ignorePatterns: [
      "private",
      "templates",
      "daily",
      "attachments/private",
      "assets",
      "calendar",
      "css",
      "export",
      "Excalidraw",
      "track",
      "work",
      "Day Planners~dev",
      "journal",
      "home",
      "org",
      "neorg",
      "soga",
      "textgenerator",
      "literature",
      "steuer",
      "_inbox",
      "_moc",
      "202*.md",
      "*.pdf",
      "*.docx",
      "*.csv",
      ".obsidian",
    ],
    defaultDateType: "published",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Source Sans 3",
        body: "Source Sans 3",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: "#0f172a",
          lightgray: "#1e293b",
          gray: "#64748b",
          darkgray: "#e2e8f0",
          dark: "#f8fafc",
          secondary: "#22d3ee",
          tertiary: "#67e8f9",
          highlight: "rgba(34, 211, 238, 0.15)",
          textHighlight: "rgba(34, 211, 238, 0.3)",
        },
        darkMode: {
          light: "#0f172a",
          lightgray: "#1e293b",
          gray: "#64748b",
          darkgray: "#e2e8f0",
          dark: "#f8fafc",
          secondary: "#22d3ee",
          tertiary: "#67e8f9",
          highlight: "rgba(34, 211, 238, 0.15)",
          textHighlight: "rgba(34, 211, 238, 0.3)",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "nearest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts(), Plugin.BlockPrivateNotes()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.CNAME(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
    ],
  },
}

export default config
