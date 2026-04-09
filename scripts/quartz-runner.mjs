#!/usr/bin/env node

import path from "node:path"
import { spawn, execFile } from "node:child_process"
import { promises as fs } from "node:fs"
import matter from "gray-matter"

const ROOT_DIR = path.resolve(".")
const SOURCE_ROOT = path.resolve(process.env.OBSIDIAN_SOURCE_DIR ?? "../vivere")
const SOURCE_GIT_URL =
  process.env.OBSIDIAN_SOURCE_GIT_URL ?? "https://github.com/benatouba/vivere.git"
const SOURCE_GIT_REF = process.env.OBSIDIAN_SOURCE_GIT_REF ?? "main"
const SOURCE_GIT_TOKEN = process.env.OBSIDIAN_SOURCE_GIT_TOKEN ?? process.env.GITHUB_TOKEN ?? null
const SOURCE_CLONE_ROOT = path.resolve(
  process.env.OBSIDIAN_SOURCE_CLONE_DIR ?? "../.obsidian-source-vivere",
)
const STAGE_ROOT = path.resolve(process.env.QUARTZ_STAGE_DIR ?? "../.quartz-source-vivere")
const QUARTZ_UPSTREAM_ROOT = path.resolve("./_quartz-upstream")
const QUARTZ_PROJECT_ROOT = process.env.QUARTZ_PROJECT_DIR
  ? path.resolve(process.env.QUARTZ_PROJECT_DIR)
  : null

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

const FALLBACK_INDEX_CONTENT = `---
title: Digital Garden
description: Entry note for the public knowledge garden.
publish: public
---

# Digital Garden

The source note \`index.md\` was not published, so this fallback home page is used.
`

const isQuartzProjectRoot = async (candidatePath) =>
  pathExists(path.join(candidatePath, "quartz", "bootstrap-cli.mjs"))

const resolveQuartzProjectRoot = async () => {
  if (QUARTZ_PROJECT_ROOT) {
    if (await isQuartzProjectRoot(QUARTZ_PROJECT_ROOT)) {
      return QUARTZ_PROJECT_ROOT
    }

    throw new Error(`QUARTZ_PROJECT_DIR does not point to a Quartz project: ${QUARTZ_PROJECT_ROOT}`)
  }

  if (await isQuartzProjectRoot(ROOT_DIR)) {
    return ROOT_DIR
  }

  if (await isQuartzProjectRoot(QUARTZ_UPSTREAM_ROOT)) {
    return QUARTZ_UPSTREAM_ROOT
  }

  throw new Error(
    `No Quartz project root found. Expected quartz/bootstrap-cli.mjs in ${ROOT_DIR} or ${QUARTZ_UPSTREAM_ROOT}.`,
  )
}

const slugToTitle = (value) => {
  const withoutPrefix = value.replace(/^\d{2}_/, "")
  const cleaned = withoutPrefix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
  if (!cleaned) {
    return value
  }

  return cleaned
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const ensureFileTitleFrontmatter = (rawContent, relativeFilePath) => {
  const parsed = matter(rawContent)
  const frontmatter = parsed.data ?? {}
  const fileStem = path.basename(relativeFilePath, path.extname(relativeFilePath))

  if (!frontmatter.title || `${frontmatter.title}`.trim() === "") {
    frontmatter.title = slugToTitle(fileStem)
  }

  return matter.stringify(parsed.content, frontmatter)
}

const execFileAsync = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error)
        return
      }

      resolve({ stdout, stderr })
    })
  })

const toPosixPath = (value) => value.split(path.sep).join("/")

const isMarkdown = (value) => value.toLowerCase().endsWith(".md")

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const readFrontmatter = (raw) => {
  const normalized = raw.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) {
    return null
  }

  const end = normalized.indexOf("\n---\n", 4)
  if (end === -1) {
    return null
  }

  return normalized.slice(4, end)
}

const readClassification = (rawFrontmatter) => {
  if (!rawFrontmatter) {
    return null
  }

  const match = rawFrontmatter.match(/^publish:\s*([^\n]+)$/m)
  if (!match) {
    return null
  }

  const value = match[1]
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase()
  if (value === NOTE_CLASSIFICATION_PUBLIC || value === NOTE_CLASSIFICATION_PRIVATE) {
    return value
  }

  return null
}

const withTokenizedGitUrl = (gitUrl, token) => {
  if (!token) {
    return gitUrl
  }

  try {
    const parsed = new URL(gitUrl)
    if (parsed.protocol !== "https:") {
      return gitUrl
    }

    parsed.username = "x-access-token"
    parsed.password = token
    return parsed.toString()
  } catch {
    return gitUrl
  }
}

const shouldIgnorePathSegment = (segment) => {
  if (SOURCE_IGNORE_DIRS.has(segment)) {
    return true
  }

  return SOURCE_IGNORE_PREFIXES.some((prefix) => segment.startsWith(prefix))
}

const ensureDirectory = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true })
}

const removeAndRecreateDirectory = async (dirPath) => {
  await fs.rm(dirPath, { recursive: true, force: true })
  await ensureDirectory(dirPath)
}

const walkMarkdownFiles = async (rootDir) => {
  const stack = [rootDir]
  const files = []

  while (stack.length > 0) {
    const current = stack.pop()
    const entries = await fs.readdir(current, { withFileTypes: true })

    for (const entry of entries) {
      const absolute = path.join(current, entry.name)
      const relative = path.relative(rootDir, absolute)
      const segments = relative.split(path.sep)

      if (segments.some(shouldIgnorePathSegment)) {
        continue
      }

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

  return files.sort((a, b) => a.localeCompare(b))
}

const copyTextFile = async (src, dest) => {
  await ensureDirectory(path.dirname(dest))
  await fs.copyFile(src, dest)
}

const copyDirectoryRecursive = async (srcDir, destDir, ignore = () => false) => {
  const entries = await fs.readdir(srcDir, { withFileTypes: true })
  await ensureDirectory(destDir)

  for (const entry of entries) {
    if (ignore(entry.name)) {
      continue
    }

    const src = path.join(srcDir, entry.name)
    const dest = path.join(destDir, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(src, dest, ignore)
      continue
    }

    if (entry.isFile()) {
      await fs.copyFile(src, dest)
    }
  }
}

const writeClassificationHelpers = async (sourceRoot, unclassifiedNotes) => {
  const metadataDir = path.join(sourceRoot, "_garden")
  await ensureDirectory(metadataDir)

  await fs.writeFile(
    path.join(metadataDir, "classification-public-template.md"),
    `---\npublish: public\n---\n`,
    "utf8",
  )

  await fs.writeFile(
    path.join(metadataDir, "classification-private-template.md"),
    `---\npublish: private\n---\n`,
    "utf8",
  )

  const queueLines = [
    "# Notes missing `publish: public|private`",
    "# Add one of the following frontmatter keys to each note:",
    "#   publish: public",
    "#   publish: private",
    "",
    ...(unclassifiedNotes.length === 0 ? ["# All notes in publish scope are classified."] : []),
    ...unclassifiedNotes.map((entry) => toPosixPath(entry)),
  ]

  await fs.writeFile(
    path.join(metadataDir, "publish-review-queue.txt"),
    `${queueLines.join("\n")}\n`,
    "utf8",
  )
}

const stageVivereNotes = async (sourceRoot) => {
  const sourceStats = await fs.stat(sourceRoot)
  if (!sourceStats.isDirectory()) {
    throw new Error(`Source path is not a directory: ${sourceRoot}`)
  }

  const contentRoot = path.join(STAGE_ROOT, "content")
  await removeAndRecreateDirectory(contentRoot)

  const sourceFiles = await walkMarkdownFiles(sourceRoot)

  const report = {
    linkedPublic: 0,
    skippedUnclassified: 0,
    skippedPrivate: 0,
    skippedInvalidFrontmatter: 0,
  }

  const unclassifiedNotes = []
  const invalidFrontmatterNotes = []
  let sourceIndexStatus = "missing"

  for (const relativeFilePath of sourceFiles) {
    const absoluteSourcePath = path.join(sourceRoot, relativeFilePath)
    const rawContent = await fs.readFile(absoluteSourcePath, "utf8")
    const rawFrontmatter = readFrontmatter(rawContent)
    const classification = readClassification(rawFrontmatter)
    const isSourceIndex = relativeFilePath === "index.md"

    if (classification === null) {
      report.skippedUnclassified += 1
      unclassifiedNotes.push(relativeFilePath)
      if (isSourceIndex) {
        sourceIndexStatus = "unclassified"
      }
      continue
    }

    if (classification === NOTE_CLASSIFICATION_PRIVATE) {
      report.skippedPrivate += 1
      if (isSourceIndex) {
        sourceIndexStatus = "private"
      }
      continue
    }

    let transformedContent
    try {
      transformedContent = ensureFileTitleFrontmatter(rawContent, relativeFilePath)
    } catch {
      report.skippedInvalidFrontmatter += 1
      invalidFrontmatterNotes.push(relativeFilePath)
      if (isSourceIndex) {
        sourceIndexStatus = "invalid-frontmatter"
      }
      continue
    }

    const absoluteStagePath = path.join(contentRoot, relativeFilePath)
    await ensureDirectory(path.dirname(absoluteStagePath))
    await fs.writeFile(absoluteStagePath, transformedContent, "utf8")
    report.linkedPublic += 1

    if (isSourceIndex) {
      sourceIndexStatus = "public"
    }
  }

  let stageIndexSource = "source-index"
  if (!(await pathExists(path.join(contentRoot, "index.md")))) {
    await fs.writeFile(path.join(contentRoot, "index.md"), FALLBACK_INDEX_CONTENT, "utf8")
    stageIndexSource = "fallback-index"
  }

  await writeClassificationHelpers(sourceRoot, unclassifiedNotes)

  return {
    report,
    unclassifiedNotes,
    invalidFrontmatterNotes,
    sourceIndexStatus,
    stageIndexSource,
  }
}

const resolveSourceRoot = async () => {
  if (await pathExists(SOURCE_ROOT)) {
    return SOURCE_ROOT
  }

  if (!SOURCE_GIT_URL) {
    throw new Error(
      `Obsidian source directory not found at ${SOURCE_ROOT}. Set OBSIDIAN_SOURCE_DIR or OBSIDIAN_SOURCE_GIT_URL.`,
    )
  }

  await fs.rm(SOURCE_CLONE_ROOT, { recursive: true, force: true })
  await ensureDirectory(path.dirname(SOURCE_CLONE_ROOT))

  const cloneUrl = withTokenizedGitUrl(SOURCE_GIT_URL, SOURCE_GIT_TOKEN)

  try {
    await execFileAsync(
      "git",
      ["clone", "--depth", "1", "--branch", SOURCE_GIT_REF, cloneUrl, SOURCE_CLONE_ROOT],
      {
        cwd: ROOT_DIR,
        env: process.env,
      },
    )
  } catch {
    throw new Error(
      `Failed to clone Obsidian source repository (${SOURCE_GIT_URL}). If this repository is private, set OBSIDIAN_SOURCE_GIT_TOKEN in Netlify environment variables.`,
    )
  }

  return SOURCE_CLONE_ROOT
}

const prepareStageProject = async (quartzProjectRoot) => {
  await removeAndRecreateDirectory(STAGE_ROOT)

  const ignoreList = new Set([
    "node_modules",
    "public",
    ".quartz-cache",
    ".git",
    "content",
    "_quartz-upstream",
    ".devenv",
    ".direnv",
  ])

  await copyDirectoryRecursive(quartzProjectRoot, STAGE_ROOT, (name) => ignoreList.has(name))

  if (quartzProjectRoot !== ROOT_DIR) {
    await copyTextFile(
      path.join(ROOT_DIR, "quartz.config.ts"),
      path.join(STAGE_ROOT, "quartz.config.ts"),
    )
    await copyTextFile(
      path.join(ROOT_DIR, "quartz.layout.ts"),
      path.join(STAGE_ROOT, "quartz.layout.ts"),
    )

    await copyDirectoryRecursive(path.join(ROOT_DIR, "custom"), path.join(STAGE_ROOT, "custom"))

    await copyTextFile(
      path.join(ROOT_DIR, "scripts", "sync-obsidian-notes.mjs"),
      path.join(STAGE_ROOT, "scripts", "sync-obsidian-notes.mjs"),
    )
  }

  const stageNodeModules = path.join(STAGE_ROOT, "node_modules")
  const rootNodeModules = path.join(ROOT_DIR, "node_modules")
  await fs.rm(stageNodeModules, { recursive: true, force: true })
  await fs.symlink(path.relative(STAGE_ROOT, rootNodeModules), stageNodeModules, "dir")
}

const ensureGitMetadataForDates = async (sourceRoot) => {
  const stageContentRoot = path.join(STAGE_ROOT, "content")
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: stageContentRoot,
      env: process.env,
    })
    return
  } catch {
    // continue with fallback
  }

  const sourceGitDir = path.join(sourceRoot, ".git")
  const stageGitDir = path.join(STAGE_ROOT, ".git")

  try {
    await fs.access(sourceGitDir)
    await fs.rm(stageGitDir, { recursive: true, force: true })
    await fs.symlink(path.relative(STAGE_ROOT, sourceGitDir), stageGitDir, "dir")
  } catch {
    // if this fails, Quartz falls back to filesystem dates
  }
}

const runQuartz = async (argv, sourceRoot) =>
  new Promise((resolve, reject) => {
    const quartzBin = path.join(STAGE_ROOT, "quartz", "bootstrap-cli.mjs")
    const args = [quartzBin, ...argv]
    const hasOutputArg = argv.some((arg) => {
      if (arg === "--output" || arg === "-o") {
        return true
      }

      if (arg.startsWith("--output=")) {
        return true
      }

      return arg.startsWith("-o") && arg.length > 2
    })

    if (!hasOutputArg) {
      args.push("--output", path.join(ROOT_DIR, "public"))
    }

    const child = spawn("node", args, {
      cwd: STAGE_ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        OBSIDIAN_SOURCE_DIR: sourceRoot,
        QUARTZ_STAGE_DIR: STAGE_ROOT,
      },
    })

    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Quartz command failed with exit code ${code ?? "unknown"}`))
    })
  })

const printStageReport = (stageResult, sourceRoot, quartzProjectRoot) => {
  console.log("Prepared Quartz stage from source notes.")
  console.log(`- source: ${sourceRoot}`)
  console.log(`- quartz project: ${quartzProjectRoot}`)
  console.log(`- stage: ${STAGE_ROOT}`)
  console.log(`- linked public notes: ${stageResult.report.linkedPublic}`)
  console.log(`- skipped unclassified notes: ${stageResult.report.skippedUnclassified}`)
  console.log(`- skipped private notes: ${stageResult.report.skippedPrivate}`)
  console.log(
    `- skipped invalid frontmatter notes: ${stageResult.report.skippedInvalidFrontmatter}`,
  )

  if (stageResult.stageIndexSource === "source-index") {
    console.log("- home note: source index.md")
  } else {
    console.log(
      `- home note: fallback index.md (source index status: ${stageResult.sourceIndexStatus})`,
    )
  }

  if (stageResult.unclassifiedNotes.length > 0) {
    console.log(
      `- review queue: ${toPosixPath(path.join(sourceRoot, "_garden", "publish-review-queue.txt"))}`,
    )
  }

  if (stageResult.invalidFrontmatterNotes.length > 0) {
    console.log("- invalid frontmatter notes (fix before publishing):")
    for (const filePath of stageResult.invalidFrontmatterNotes.slice(0, 20)) {
      console.log(`  - ${toPosixPath(filePath)}`)
    }
    if (stageResult.invalidFrontmatterNotes.length > 20) {
      console.log(`  - ...and ${stageResult.invalidFrontmatterNotes.length - 20} more`)
    }
  }
}

try {
  const commandArgs = process.argv.slice(2)
  const quartzProjectRoot = await resolveQuartzProjectRoot()
  const sourceRoot = await resolveSourceRoot()
  await prepareStageProject(quartzProjectRoot)
  const stageResult = await stageVivereNotes(sourceRoot)
  await ensureGitMetadataForDates(sourceRoot)
  printStageReport(stageResult, sourceRoot, quartzProjectRoot)
  await runQuartz(commandArgs, sourceRoot)
} catch (error) {
  console.error("Quartz runner failed:")
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
