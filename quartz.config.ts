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
          light: "#1e1e2e",
          lightgray: "#313244",
          gray: "#7f849c",
          darkgray: "#cdd6f4",
          dark: "#f5e0dc",
          secondary: "#fab387",
          tertiary: "#f9e2af",
          highlight: "rgba(250, 179, 135, 0.2)",
          textHighlight: "rgba(249, 226, 175, 0.35)",
        },
        darkMode: {
          light: "#1e1e2e",
          lightgray: "#313244",
          gray: "#7f849c",
          darkgray: "#cdd6f4",
          dark: "#f5e0dc",
          secondary: "#fab387",
          tertiary: "#f9e2af",
          highlight: "rgba(250, 179, 135, 0.2)",
          textHighlight: "rgba(249, 226, 175, 0.35)",
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
