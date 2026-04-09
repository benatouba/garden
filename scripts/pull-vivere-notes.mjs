#!/usr/bin/env node

import { execFile } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"

const ROOT_DIR = path.resolve(".")
const ENV_FILE = path.join(ROOT_DIR, ".env")
const CONTENT_DIR = path.join(ROOT_DIR, "content")
const CLONE_DIR = path.join(ROOT_DIR, ".quartz-cache", "vivere-source")

const DEFAULT_GIT_URL = "https://github.com/benatouba/vivere.git"
const DEFAULT_GIT_REF = "main"

const IGNORE_ROOT_ENTRIES = new Set([".git", ".github", ".obsidian", ".trash", "node_modules"])
const IGNORE_PREFIXES = [".", "_"]
const IGNORE_PATH_SEGMENTS = new Set([
  "private",
  "templates",
  "daily",
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
  "attachments",
  "_garden",
])

const execFileAsync = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr })
        return
      }

      resolve({ stdout, stderr })
    })
  })

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const ensureDirectory = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true })
}

const safeErrorText = (text, token) => {
  if (!text) {
    return ""
  }

  if (!token) {
    return text
  }

  return text.split(token).join("[redacted]")
}

const loadDotEnvFile = async (filePath) => {
  if (!(await pathExists(filePath))) {
    return
  }

  const raw = await fs.readFile(filePath, "utf8")
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, equalsIndex).trim()
    if (!key) {
      continue
    }

    const existing = process.env[key]
    if (typeof existing === "string" && existing.length > 0) {
      continue
    }

    let value = trimmed.slice(equalsIndex + 1).trim()
    value = value.replace(/^['"]|['"]$/g, "")
    process.env[key] = value
  }
}

const isGitHubHttpsUrl = (value) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "github.com"
  } catch {
    return false
  }
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

const toGitHubBasicAuthHeader = (token) => {
  const encoded = Buffer.from(`x-access-token:${token}`, "utf8").toString("base64")
  return `AUTHORIZATION: basic ${encoded}`
}

const cloneRepository = async ({ gitUrl, gitRef, targetDir, token, cwd }) => {
  await fs.rm(targetDir, { recursive: true, force: true })
  await ensureDirectory(path.dirname(targetDir))

  const cloneArgs = ["clone", "--depth", "1", "--branch", gitRef]
  const attempts = []

  if (token && isGitHubHttpsUrl(gitUrl)) {
    const parsed = new URL(gitUrl)
    attempts.push({
      mode: "github-header-auth",
      args: [
        "-c",
        `http.${parsed.origin}/.extraheader=${toGitHubBasicAuthHeader(token)}`,
        ...cloneArgs,
        gitUrl,
        targetDir,
      ],
    })
  }

  attempts.push({
    mode: token ? "tokenized-url-auth" : "anonymous",
    args: [...cloneArgs, withTokenizedGitUrl(gitUrl, token), targetDir],
  })

  const failures = []
  for (const attempt of attempts) {
    try {
      await execFileAsync("git", attempt.args, {
        cwd,
        env: process.env,
      })
      return
    } catch (result) {
      const stdout = safeErrorText(result?.stdout ?? "", token)
      const stderr = safeErrorText(result?.stderr ?? "", token)
      failures.push({
        mode: attempt.mode,
        details: `${stdout}${stderr}`.trim(),
      })
    }
  }

  const details = failures
    .map((entry) => {
      if (!entry.details) {
        return `- ${entry.mode}: git clone failed without additional details`
      }

      const lines = entry.details.split(/\r?\n/).filter(Boolean)
      return `- ${entry.mode}: ${lines.slice(-4).join(" | ")}`
    })
    .join("\n")

  throw new Error(`Failed to clone ${gitUrl}\n${details}`)
}

const copyTree = async (srcDir, destDir, relative = "") => {
  const currentSrc = path.join(srcDir, relative)
  const entries = await fs.readdir(currentSrc, { withFileTypes: true })
  let copiedFiles = 0

  for (const entry of entries) {
    if (relative.length === 0 && IGNORE_ROOT_ENTRIES.has(entry.name)) {
      continue
    }

    if (entry.name.startsWith(".")) {
      continue
    }

    const nextRelative = relative ? path.join(relative, entry.name) : entry.name
    const pathSegments = nextRelative.split(path.sep)
    if (
      pathSegments.some(
        (segment) =>
          IGNORE_PATH_SEGMENTS.has(segment) ||
          IGNORE_PREFIXES.some((prefix) => segment.startsWith(prefix)),
      )
    ) {
      continue
    }

    if (/^202\d/.test(entry.name)) {
      continue
    }

    if (/\.(pdf|docx|csv)$/i.test(entry.name)) {
      continue
    }

    const srcPath = path.join(srcDir, nextRelative)
    const destPath = path.join(destDir, nextRelative)

    if (entry.isDirectory()) {
      await ensureDirectory(destPath)
      copiedFiles += await copyTree(srcDir, destDir, nextRelative)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    await ensureDirectory(path.dirname(destPath))
    await fs.copyFile(srcPath, destPath)
    copiedFiles += 1
  }

  return copiedFiles
}

try {
  await loadDotEnvFile(ENV_FILE)

  const gitUrl = (process.env.OBSIDIAN_SOURCE_GIT_URL ?? DEFAULT_GIT_URL).trim()
  const gitRef = (process.env.OBSIDIAN_SOURCE_GIT_REF ?? DEFAULT_GIT_REF).trim()
  const gitTokenRaw = process.env.OBSIDIAN_SOURCE_GIT_TOKEN ?? process.env.GITHUB_TOKEN ?? ""
  const gitToken = gitTokenRaw.trim().length > 0 ? gitTokenRaw.trim() : null
  const sourceSubdirRaw = (process.env.OBSIDIAN_SOURCE_SUBDIR ?? ".").trim()
  const sourceSubdir = sourceSubdirRaw === "" ? "." : sourceSubdirRaw
  const entryNoteFileName = (process.env.OBSIDIAN_SOURCE_ENTRY_NOTE ?? "index.md").trim()

  await cloneRepository({
    gitUrl,
    gitRef,
    targetDir: CLONE_DIR,
    token: gitToken,
    cwd: ROOT_DIR,
  })

  const sourceRoot = path.resolve(CLONE_DIR, sourceSubdir)
  if (!(await pathExists(sourceRoot))) {
    throw new Error(`Source subdirectory does not exist in repository: ${sourceSubdir}`)
  }

  await fs.rm(CONTENT_DIR, { recursive: true, force: true })
  await ensureDirectory(CONTENT_DIR)

  const copiedFiles = await copyTree(sourceRoot, CONTENT_DIR)
  const entryNote = path.join(CONTENT_DIR, entryNoteFileName)
  if (!(await pathExists(entryNote))) {
    throw new Error(
      `Missing entry note: ${entryNoteFileName} was not found at ${sourceSubdir === "." ? "repository root" : sourceSubdir}`,
    )
  }

  console.log("Vivere notes synced.")
  console.log(`- source repo: ${gitUrl}`)
  console.log(`- source ref: ${gitRef}`)
  console.log(`- source path: ${sourceSubdir}`)
  console.log(`- copied files: ${copiedFiles}`)
  console.log(`- content dir: ${CONTENT_DIR}`)
  console.log(`- entry note: content/${entryNoteFileName}`)
} catch (error) {
  console.error("Failed to sync notes from vivere repository.")
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
