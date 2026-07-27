#!/usr/bin/env node

import matter from "gray-matter"
import { promises as fs } from "node:fs"
import path from "node:path"

const ROOT_DIR = path.resolve(".")
const CONTENT_DIR = path.join(ROOT_DIR, "content")
const PUBLIC_DIR = path.join(ROOT_DIR, "public")

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const fileExists = async (targetPath) => {
  try {
    const stats = await fs.stat(targetPath)
    return stats.isFile()
  } catch {
    return false
  }
}

const getFileExtension = (value) => value.match(/\.[A-Za-z0-9]+$/)?.[0]

const stripSlashes = (value, onlyStripPrefix = false) => {
  let nextValue = value
  if (nextValue.startsWith("/")) {
    nextValue = nextValue.substring(1)
  }

  if (!onlyStripPrefix && nextValue.endsWith("/")) {
    nextValue = nextValue.slice(0, -1)
  }

  return nextValue
}

const sluggify = (value) =>
  value
    .split("/")
    .map((segment) =>
      segment
        .replace(/\s/g, "-")
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/\?/g, "")
        .replace(/#/g, ""),
    )
    .join("/")
    .replace(/\/$/, "")

const slugifyFilePath = (filePath) => {
  const normalizedFilePath = stripSlashes(filePath)
  let ext = getFileExtension(normalizedFilePath)
  const withoutFileExt = normalizedFilePath.replace(new RegExp((ext ?? "") + "$"), "")
  if ([".md", ".html", undefined].includes(ext)) {
    ext = ""
  }

  let slug = sluggify(withoutFileExt)
  if (slug === "_index" || slug.endsWith("/_index")) {
    slug = slug.replace(/_index$/, "index")
  }

  return slug + ext
}

const normalizePublishValue = (value) => {
  if (typeof value === "string") {
    return value.trim().toLowerCase()
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  return ""
}

const isPrivatePublishValue = (value) => {
  const normalized = normalizePublishValue(value)
  return normalized === "private" || normalized === "false"
}

const walkMarkdownFiles = async (dirPath, relative = "") => {
  const currentDir = path.join(dirPath, relative)
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  let files = []

  for (const entry of entries) {
    const nextRelative = relative ? path.join(relative, entry.name) : entry.name
    if (entry.isDirectory()) {
      files = files.concat(await walkMarkdownFiles(dirPath, nextRelative))
      continue
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path.join(dirPath, nextRelative))
    }
  }

  return files
}

const normalizeUrlLikeSlug = (value) => {
  if (typeof value !== "string") {
    return null
  }

  let normalized = value.trim()
  if (normalized.length === 0) {
    return null
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return null
  }

  normalized = normalized.replace(/^\.\//, "")
  normalized = normalized.replace(/^\/+/, "")
  normalized = normalized.split("#", 1)[0]
  normalized = normalized.split("?", 1)[0]
  normalized = normalized.replace(/\/+$/, "")

  if (normalized.length === 0) {
    return "index"
  }

  if (normalized.endsWith(".html")) {
    normalized = normalized.slice(0, -5)
  }

  if (normalized.endsWith("/index")) {
    normalized = normalized.slice(0, -6)
  }

  return normalized.length === 0 ? "index" : normalized
}

const extractCanonicalSlug = (html) => {
  const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)
  if (!canonicalMatch) {
    return null
  }

  return normalizeUrlLikeSlug(canonicalMatch[1])
}

const walkHtmlFiles = async (dirPath, relative = "") => {
  const currentDir = path.join(dirPath, relative)
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  let files = []

  for (const entry of entries) {
    const nextRelative = relative ? path.join(relative, entry.name) : entry.name
    if (entry.isDirectory()) {
      files = files.concat(await walkHtmlFiles(dirPath, nextRelative))
      continue
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(path.join(dirPath, nextRelative))
    }
  }

  return files
}

const collectAliasRedirects = async () => {
  if (!(await pathExists(PUBLIC_DIR))) {
    return new Map()
  }

  const htmlFiles = await walkHtmlFiles(PUBLIC_DIR)
  const aliasRedirects = new Map()

  for (const filePath of htmlFiles) {
    const html = await fs.readFile(filePath, "utf8")
    if (!html.includes('http-equiv="refresh"') || !html.includes('name="robots"')) {
      continue
    }

    const canonicalSlug = extractCanonicalSlug(html)
    if (!canonicalSlug) {
      continue
    }

    const relativePath = path.relative(PUBLIC_DIR, filePath).split(path.sep).join("/")
    const aliasSlug = normalizeUrlLikeSlug(relativePath)
    if (!aliasSlug) {
      continue
    }

    aliasRedirects.set(aliasSlug, canonicalSlug)
  }

  return aliasRedirects
}

const escapeHtmlEntities = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const extractHtmlTitle = (html) => html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null

// A private note must never have an emitted page. Notes are emitted at
// public/<slug>.html. Folders additionally emit listing pages at
// <folder>/index.html, which collides with the output path of a filtered
// <folder>/index.md note, so those are only flagged when the emitted page
// carries the private note's own title.
const findEmittedPrivatePages = async (privateNotes) => {
  const violations = []

  for (const { slug, relativePath, title } of privateNotes) {
    const outputPath = path.join(PUBLIC_DIR, `${slug}.html`)
    if (!(await fileExists(outputPath))) {
      continue
    }

    const html = await fs.readFile(outputPath, "utf8")

    // Alias redirect pages of other (public) notes can share this slug. They
    // contain no note content and are covered by the alias-redirect check.
    if (html.includes('http-equiv="refresh"') && html.includes('name="robots"')) {
      continue
    }

    if (slug === "index" || slug.endsWith("/index")) {
      const pageTitle = extractHtmlTitle(html)
      const noteTitle =
        typeof title === "string" && title.trim().length > 0
          ? escapeHtmlEntities(title.trim())
          : null
      if (pageTitle && noteTitle && !pageTitle.includes(noteTitle)) {
        continue
      }
    }

    violations.push({
      note: relativePath,
      slug,
      outputPath: path.join("public", `${slug}.html`),
    })
  }

  return violations
}

try {
  if (!(await pathExists(CONTENT_DIR))) {
    throw new Error("Missing content directory. Run note sync before this security check.")
  }

  if (!(await pathExists(PUBLIC_DIR))) {
    throw new Error("Missing public directory. Run the Quartz build before this security check.")
  }

  if (!(await pathExists(path.join(PUBLIC_DIR, "index.html")))) {
    throw new Error(
      "Missing public/index.html: the build emitted no entry page. " +
        "This usually means every note was filtered out (e.g. plugins failed to " +
        "instantiate, so frontmatter was unavailable to the publish filter). " +
        "Check the build log for plugin failures.",
    )
  }

  const aliasRedirects = await collectAliasRedirects()
  const markdownFiles = await walkMarkdownFiles(CONTENT_DIR)
  const privateNotes = []
  const privateSlugs = new Map()

  for (const filePath of markdownFiles) {
    const source = await fs.readFile(filePath, "utf8")
    const frontmatter = matter(source).data ?? {}
    if (!isPrivatePublishValue(frontmatter.publish)) {
      continue
    }

    const relativePath = path.relative(CONTENT_DIR, filePath).split(path.sep).join("/")
    const primarySlug = slugifyFilePath(relativePath)
    privateNotes.push({ slug: primarySlug, relativePath, title: frontmatter.title })
    privateSlugs.set(primarySlug, relativePath)
  }

  const aliasViolations = []
  for (const [aliasSlug, canonicalSlug] of aliasRedirects.entries()) {
    const privateSource =
      privateSlugs.get(canonicalSlug) ?? privateSlugs.get(`${canonicalSlug}/index`)
    if (!privateSource) {
      continue
    }

    aliasViolations.push({
      note: privateSource,
      aliasSlug,
      canonicalSlug,
      outputPath: path.join("public", `${aliasSlug}.html`),
    })
  }

  const emittedViolations = await findEmittedPrivatePages(privateNotes)

  if (emittedViolations.length > 0) {
    console.error("Security check failed: pages were emitted for private notes.")
    for (const violation of emittedViolations.slice(0, 50)) {
      console.error(`- ${violation.note} -> ${violation.outputPath} (slug: ${violation.slug})`)
    }

    if (emittedViolations.length > 50) {
      console.error(`...and ${emittedViolations.length - 50} more.`)
    }
  }

  if (aliasViolations.length > 0) {
    console.error("Security check failed: alias redirects for private notes were emitted.")
    for (const violation of aliasViolations.slice(0, 50)) {
      console.error(
        `- ${violation.note} -> ${violation.outputPath} (canonical: ${violation.canonicalSlug})`,
      )
    }

    if (aliasViolations.length > 50) {
      console.error(`...and ${aliasViolations.length - 50} more.`)
    }
  }

  if (emittedViolations.length > 0 || aliasViolations.length > 0) {
    process.exitCode = 1
  } else {
    console.log(
      `Security check passed: no pages or alias redirects were published for ${privateNotes.length} private notes.`,
    )
  }
} catch (error) {
  console.error("Security check failed.")
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
