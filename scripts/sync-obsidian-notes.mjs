#!/usr/bin/env node

import { promises as fs } from "node:fs"
import path from "node:path"

const SOURCE_ROOT = path.resolve(process.env.OBSIDIAN_SOURCE_DIR ?? "../vivere")
const TARGET_ROOT = path.resolve("./content")
const SYNC_ROOT = path.join(TARGET_ROOT, "notes")

const SOURCE_IGNORE_DIRS = new Set([
  ".git",
  ".obsidian",
  ".trash",
  "assets",
  "calendar",
  "css",
  "export",
  "Excalidraw",
  "templates",
  "track",
  "work",
])

const SOURCE_IGNORE_PREFIXES = [".", "_"]

const NOTE_CLASSIFICATION_PRIVATE = "private"
const NOTE_CLASSIFICATION_PUBLIC = "public"

const ALLOWED_CLASSIFICATIONS = new Set([NOTE_CLASSIFICATION_PRIVATE, NOTE_CLASSIFICATION_PUBLIC])

const OPS = {
  copied: 0,
  skippedUnclassified: 0,
  skippedPrivate: 0,
  deletedStale: 0,
  templatesCreated: 0,
}

const toPosixPath = (value) => value.split(path.sep).join("/")

const isMarkdown = (filePath) => filePath.toLowerCase().endsWith(".md")

const shouldIgnorePathSegment = (segment) => {
  if (SOURCE_IGNORE_DIRS.has(segment)) {
    return true
  }

  return SOURCE_IGNORE_PREFIXES.some((prefix) => segment.startsWith(prefix))
}

const readFrontmatter = (raw) => {
  const normalized = raw.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: null, body: raw }
  }

  const end = normalized.indexOf("\n---\n", 4)
  if (end === -1) {
    return { frontmatter: null, body: raw }
  }

  const frontmatter = normalized.slice(4, end).trim()
  const body = normalized.slice(end + 5)

  return { frontmatter, body }
}

const parseYamlScalar = (value) => value.trim().replace(/^['"]|['"]$/g, "")

const parseFrontmatterObject = (frontmatter) => {
  const result = {}
  const lines = frontmatter.split("\n")

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (!match) {
      continue
    }

    const key = match[1]
    const rest = match[2].trim()

    if (!rest) {
      const listValues = []
      let lookahead = index + 1

      while (lookahead < lines.length) {
        const candidate = lines[lookahead]
        const candidateTrimmed = candidate.trim()

        if (!candidateTrimmed) {
          lookahead += 1
          continue
        }

        if (!candidate.startsWith("  - ")) {
          break
        }

        listValues.push(parseYamlScalar(candidateTrimmed.slice(2)))
        lookahead += 1
      }

      if (listValues.length > 0) {
        result[key] = listValues
        index = lookahead - 1
      }

      continue
    }

    if (rest === "[]") {
      result[key] = []
      continue
    }

    if (rest === "true") {
      result[key] = true
      continue
    }

    if (rest === "false") {
      result[key] = false
      continue
    }

    result[key] = parseYamlScalar(rest)
  }

  return result
}

const stringifyFrontmatterObject = (data) => {
  const lines = []

  const writeScalar = (key, value) => {
    lines.push(`${key}: ${value}`)
  }

  const writeList = (key, values) => {
    if (!Array.isArray(values) || values.length === 0) {
      lines.push(`${key}: []`)
      return
    }

    lines.push(`${key}:`)
    for (const value of values) {
      lines.push(`  - ${value}`)
    }
  }

  const orderedKeys = [
    "title",
    "description",
    "date",
    "tags",
    "aliases",
    "publish",
    "draft",
    "obsidian_source",
  ]

  for (const key of orderedKeys) {
    if (!(key in data)) {
      continue
    }

    const value = data[key]
    if (Array.isArray(value)) {
      writeList(key, value)
      continue
    }

    if (typeof value === "boolean") {
      writeScalar(key, value ? "true" : "false")
      continue
    }

    writeScalar(key, String(value))
  }

  for (const [key, value] of Object.entries(data)) {
    if (orderedKeys.includes(key)) {
      continue
    }

    if (Array.isArray(value)) {
      writeList(
        key,
        value.map((entry) => String(entry)),
      )
      continue
    }

    if (typeof value === "boolean") {
      writeScalar(key, value ? "true" : "false")
      continue
    }

    writeScalar(key, String(value))
  }

  return `---\n${lines.join("\n")}\n---\n`
}

const getClassification = (frontmatterObject) => {
  if (!frontmatterObject) {
    return null
  }

  const candidate = frontmatterObject.publish
  if (typeof candidate !== "string") {
    return null
  }

  const normalized = candidate.toLowerCase()
  if (!ALLOWED_CLASSIFICATIONS.has(normalized)) {
    return null
  }

  return normalized
}

const ensureFrontmatter = (relativePath, parsed) => {
  const frontmatterObject = parseFrontmatterObject(parsed.frontmatter ?? "")
  const sourcePath = toPosixPath(relativePath)

  const titleFromFile = path
    .basename(relativePath, path.extname(relativePath))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!frontmatterObject.title) {
    frontmatterObject.title = titleFromFile || "Untitled"
  }

  if (!frontmatterObject.description) {
    frontmatterObject.description = ""
  }

  if (!frontmatterObject.date) {
    frontmatterObject.date = new Date().toISOString().slice(0, 10)
  }

  if (!Array.isArray(frontmatterObject.tags)) {
    frontmatterObject.tags = []
  }

  if (!("aliases" in frontmatterObject)) {
    frontmatterObject.aliases = []
  }

  frontmatterObject.obsidian_source = sourcePath

  if (frontmatterObject.publish === NOTE_CLASSIFICATION_PRIVATE) {
    frontmatterObject.draft = true
  }

  const nextFrontmatter = stringifyFrontmatterObject(frontmatterObject)
  const body = parsed.body.startsWith("\n") ? parsed.body.slice(1) : parsed.body
  const sanitizedBody = body.length > 0 ? body : ""

  return {
    frontmatterObject,
    nextContent: `${nextFrontmatter}\n${sanitizedBody}`.trimEnd() + "\n",
  }
}

const walkDirectory = async (rootDir) => {
  const markdownFiles = []
  const stack = [rootDir]

  while (stack.length > 0) {
    const currentDir = stack.pop()
    const entries = await fs.readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)
      const relativePath = path.relative(rootDir, absolutePath)
      const relativeSegments = relativePath.split(path.sep)

      if (relativeSegments.some(shouldIgnorePathSegment)) {
        continue
      }

      if (entry.isDirectory()) {
        stack.push(absolutePath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      if (!isMarkdown(entry.name)) {
        continue
      }

      markdownFiles.push(relativePath)
    }
  }

  return markdownFiles.sort((a, b) => a.localeCompare(b))
}

const ensureDirectory = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true })
}

const removeMissingTargets = async (existingTargetFiles, expectedTargets) => {
  for (const targetFile of existingTargetFiles) {
    if (expectedTargets.has(targetFile)) {
      continue
    }

    const absolutePath = path.join(SYNC_ROOT, targetFile)
    await fs.rm(absolutePath, { force: true })
    OPS.deletedStale += 1
  }
}

const listExistingTargetMarkdown = async () => {
  try {
    await fs.access(SYNC_ROOT)
  } catch {
    return []
  }

  const root = SYNC_ROOT
  const stack = [root]
  const files = []

  while (stack.length > 0) {
    const current = stack.pop()
    const entries = await fs.readdir(current, { withFileTypes: true })

    for (const entry of entries) {
      const absolute = path.join(current, entry.name)
      const relative = path.relative(root, absolute)

      if (entry.isDirectory()) {
        stack.push(absolute)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      if (!isMarkdown(entry.name)) {
        continue
      }

      files.push(relative)
    }
  }

  return files
}

const createClassificationTemplates = async (unclassifiedRelativePaths) => {
  const metadataDir = path.join(SOURCE_ROOT, "_garden")
  await ensureDirectory(metadataDir)

  const publicTemplatePath = path.join(metadataDir, "classification-public-template.md")
  const privateTemplatePath = path.join(metadataDir, "classification-private-template.md")
  const reviewQueuePath = path.join(metadataDir, "publish-review-queue.txt")

  const publicTemplate = `---\npublish: public\n---\n`
  const privateTemplate = `---\npublish: private\n---\n`

  await fs.writeFile(publicTemplatePath, publicTemplate, "utf8")
  await fs.writeFile(privateTemplatePath, privateTemplate, "utf8")

  const queueLines = [
    "# Notes missing `publish: public|private`",
    "# Add one of the following frontmatter keys to each note:",
    "#   publish: public",
    "#   publish: private",
    "",
    ...unclassifiedRelativePaths.map((entry) => toPosixPath(entry)),
  ]

  await fs.writeFile(reviewQueuePath, `${queueLines.join("\n")}\n`, "utf8")
  OPS.templatesCreated = 3
}

const syncNotes = async () => {
  const sourceStats = await fs.stat(SOURCE_ROOT)
  if (!sourceStats.isDirectory()) {
    throw new Error(`Source path is not a directory: ${SOURCE_ROOT}`)
  }

  await ensureDirectory(SYNC_ROOT)

  const sourceFiles = await walkDirectory(SOURCE_ROOT)
  const expectedTargets = new Set()
  const unclassifiedNotes = []

  for (const relativeFilePath of sourceFiles) {
    const absoluteSourcePath = path.join(SOURCE_ROOT, relativeFilePath)
    const sourceContent = await fs.readFile(absoluteSourcePath, "utf8")
    const parsed = readFrontmatter(sourceContent)
    const { frontmatterObject, nextContent } = ensureFrontmatter(relativeFilePath, parsed)

    const classification = getClassification(frontmatterObject)

    if (classification === null) {
      OPS.skippedUnclassified += 1
      unclassifiedNotes.push(relativeFilePath)
      continue
    }

    if (classification === NOTE_CLASSIFICATION_PRIVATE) {
      OPS.skippedPrivate += 1
      continue
    }

    const targetPath = path.join(SYNC_ROOT, relativeFilePath)
    expectedTargets.add(relativeFilePath)

    await ensureDirectory(path.dirname(targetPath))
    await fs.writeFile(targetPath, nextContent, "utf8")
    OPS.copied += 1
  }

  if (unclassifiedNotes.length > 0) {
    await createClassificationTemplates(unclassifiedNotes)
  }

  const existingTargetFiles = await listExistingTargetMarkdown()
  await removeMissingTargets(existingTargetFiles, expectedTargets)
}

const printReport = () => {
  console.log("Obsidian sync complete.")
  console.log(`- source: ${SOURCE_ROOT}`)
  console.log(`- target: ${SYNC_ROOT}`)
  console.log(`- copied public notes: ${OPS.copied}`)
  console.log(`- skipped unclassified notes: ${OPS.skippedUnclassified}`)
  console.log(`- skipped private notes: ${OPS.skippedPrivate}`)
  console.log(`- deleted stale target notes: ${OPS.deletedStale}`)

  if (OPS.templatesCreated > 0) {
    const metadataDir = path.join(SOURCE_ROOT, "_garden")
    console.log(`- wrote classification helper files: ${OPS.templatesCreated}`)
    console.log(
      `- review queue: ${toPosixPath(path.join(metadataDir, "publish-review-queue.txt"))}`,
    )
  }

  console.log(
    "Classification rule: add frontmatter `publish: public` or `publish: private` in Obsidian notes.",
  )
}

try {
  await syncNotes()
  printReport()
} catch (error) {
  console.error("Obsidian sync failed:")
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
