import { randomUUID } from "node:crypto"
import { access, copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import { ResumeArtifactStorage, StoredResumeFiles } from "../../application/ports/resume-artifact-storage.js"
import { sha256 } from "../../application/resume-artifact-identity.js"

async function exists(filePath: string): Promise<boolean> {
  try { await access(filePath); return true } catch { return false }
}

async function removeIfPresent(filePath: string): Promise<void> {
  try { await unlink(filePath) } catch {}
}

function safeSegment(value: string): string {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 80) || "resume"
}

interface PendingCommit {
  tempPath: string
  targetPath: string
  backupPath: string
  hadTarget: boolean
  committed: boolean
}

async function commitTogether(pending: PendingCommit[]): Promise<void> {
  try {
    for (const item of pending) {
      if (item.hadTarget) await rename(item.targetPath, item.backupPath)
    }
    for (const item of pending) {
      await rename(item.tempPath, item.targetPath)
      item.committed = true
    }
    await Promise.all(pending.map((item) => removeIfPresent(item.backupPath)))
  } catch (error) {
    await Promise.all(pending.map(async (item) => {
      if (item.committed) await removeIfPresent(item.targetPath)
      if (item.hadTarget && await exists(item.backupPath)) {
        try { await rename(item.backupPath, item.targetPath) } catch {}
      }
      await removeIfPresent(item.tempPath)
    }))
    throw error
  }
}

export class LocalResumeArtifactStorage implements ResumeArtifactStorage {
  constructor(private readonly root = path.resolve("artifacts/resumes")) {}

  resolveOutputPath(input: { requestedPath?: string; jobDescriptionId: string; language: string; length: string; identity: string; extension: string }): string {
    if (input.requestedPath) {
      const resolved = path.resolve(input.requestedPath)
      if (path.extname(resolved).toLocaleLowerCase("en") !== input.extension) throw new Error(`Output path must use ${input.extension} for the selected format.`)
      return resolved
    }
    const fileName = `resume-${safeSegment(input.jobDescriptionId)}-${safeSegment(input.language)}-${safeSegment(input.length)}-${input.identity.slice(0, 12)}${input.extension}`
    return path.join(this.root, fileName)
  }

  async write(input: { outputPath: string; artifact: Uint8Array; manifest: Uint8Array; force: boolean }): Promise<StoredResumeFiles> {
    const artifactPath = path.resolve(input.outputPath)
    const manifestPath = `${artifactPath}.manifest.json`
    await mkdir(path.dirname(artifactPath), { recursive: true })
    if (!input.force && await exists(artifactPath)) {
      const current = await readFile(artifactPath)
      if (sha256(current) !== sha256(input.artifact)) throw new Error(`Output already exists with different content: ${artifactPath}. Use --force to replace it.`)
    }
    if (!input.force && await exists(manifestPath)) {
      const current = await readFile(manifestPath)
      if (sha256(current) !== sha256(input.manifest)) throw new Error(`Manifest already exists with different content: ${manifestPath}. Use --force to replace it.`)
    }
    const suffix = `.tmp-${process.pid}-${randomUUID()}`
    const artifactTemp = `${artifactPath}${suffix}`
    const manifestTemp = `${manifestPath}${suffix}`
    const pending: PendingCommit[] = [
      { tempPath: artifactTemp, targetPath: artifactPath, backupPath: `${artifactPath}${suffix}.backup`, hadTarget: await exists(artifactPath), committed: false },
      { tempPath: manifestTemp, targetPath: manifestPath, backupPath: `${manifestPath}${suffix}.backup`, hadTarget: await exists(manifestPath), committed: false }
    ]
    try {
      await writeFile(artifactTemp, input.artifact, { flag: "wx" })
      await writeFile(manifestTemp, input.manifest, { flag: "wx" })
      await commitTogether(pending)
      return { artifactPath, manifestPath }
    } catch (error) {
      await Promise.all(pending.map((item) => removeIfPresent(item.tempPath)))
      throw error
    }
  }

  async readArtifact(filePath: string): Promise<Uint8Array | undefined> {
    try { return await readFile(filePath) } catch { return undefined }
  }

  async materialize(input: { sourceArtifactPath: string; sourceManifestPath: string; outputPath: string; checksum: string; force: boolean }): Promise<StoredResumeFiles> {
    const source = await readFile(input.sourceArtifactPath)
    if (sha256(source) !== input.checksum) throw new Error(`Cached resume artifact checksum mismatch: ${input.sourceArtifactPath}. Re-run with --force.`)
    const outputPath = path.resolve(input.outputPath)
    const manifestPath = `${outputPath}.manifest.json`
    await mkdir(path.dirname(outputPath), { recursive: true })
    const suffix = `.tmp-${process.pid}-${randomUUID()}`
    const pending: PendingCommit[] = []
    try {
      for (const [sourcePath, targetPath] of [[input.sourceArtifactPath, outputPath], [input.sourceManifestPath, manifestPath]] as const) {
        if (!input.force && await exists(targetPath)) {
          const [existing, incoming] = await Promise.all([readFile(targetPath), readFile(sourcePath)])
          if (sha256(existing) !== sha256(incoming)) throw new Error(`Output already exists with different content: ${targetPath}. Use --force to replace it.`)
          continue
        }
        const tempPath = `${targetPath}${suffix}`
        await copyFile(sourcePath, tempPath)
        pending.push({ tempPath, targetPath, backupPath: `${targetPath}${suffix}.backup`, hadTarget: await exists(targetPath), committed: false })
      }
      await commitTogether(pending)
    } catch (error) {
      await Promise.all(pending.map((item) => removeIfPresent(item.tempPath)))
      throw error
    }
    return { artifactPath: outputPath, manifestPath }
  }

  async remove(files: StoredResumeFiles): Promise<void> {
    await Promise.all([removeIfPresent(files.artifactPath), removeIfPresent(files.manifestPath)])
  }
}
